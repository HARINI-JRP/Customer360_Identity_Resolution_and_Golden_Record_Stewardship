import pandas as pd
import os
import json
from datetime import date
from collections import defaultdict
from itertools import combinations

import snowflake.connector
from snowflake.connector import DictCursor
from dotenv import load_dotenv
from rapidfuzz import fuzz


# ============================================================
# 1. CONFIGURATION
# ============================================================

load_dotenv()

ALGORITHM_VERSION = "customer360_v1.1_name_compatibility"

# Preview first. Change to False only after reviewing results.
DRY_RUN = True

# Minimum fuzzy name similarity for a candidate.
FUZZY_NAME_THRESHOLD = 90

# Minimum name similarity when email/phone and DOB match.
CONTACT_NAME_THRESHOLD = 60

# Confidence bands.
HIGH_THRESHOLD = 95
MEDIUM_THRESHOLD = 75


# ============================================================
# 2. NORMALIZATION FUNCTIONS
# ============================================================

def normalize_text(value):
    if value is None:
        return ""

    return " ".join(str(value).strip().lower().split())


def normalize_email(value):
    return normalize_text(value)


def normalize_phone(value):
    if value is None:
        return ""

    return "".join(
        character
        for character in str(value)
        if character.isdigit()
    )


def normalize_dob(value):
    if value is None:
        return ""

    if isinstance(value, date):
        return value.isoformat()

    return str(value)[:10]


def parse_raw_data(value):
    if isinstance(value, dict):
        return value

    if not value:
        return {}

    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}


# ============================================================
# 3. CONNECT TO SNOWFLAKE
# ============================================================

def connect_snowflake():

    required_variables = [
        "SNOWFLAKE_ACCOUNT",
        "SNOWFLAKE_USER",
        "SNOWFLAKE_PASSWORD",
        "SNOWFLAKE_WAREHOUSE",
        "SNOWFLAKE_DATABASE",
        "SNOWFLAKE_SCHEMA"
    ]

    missing = [
        variable
        for variable in required_variables
        if not os.getenv(variable)
    ]

    if missing:
        raise ValueError(
            "Missing .env settings: " + ", ".join(missing)
        )

    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        role=os.getenv("SNOWFLAKE_ROLE") or None,
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        database=os.getenv("SNOWFLAKE_DATABASE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA")
    )


# ============================================================
# 4. LOAD SOURCE RECORDS
# ============================================================

def load_source_records(cursor):

    query = """
        SELECT
            sr.SOURCE_RECORD_ID,
            ss.SOURCE_SYSTEM_NAME,
            sr.SOURCE_CUSTOMER_ID,
            sr.CUSTOMER_NAME,
            sr.EMAIL,
            sr.PHONE,
            sr.DATE_OF_BIRTH,
            sr.ADDRESS,
            sr.POSTAL_CODE,
            TO_VARCHAR(sr.RAW_DATA) AS RAW_DATA_JSON

        FROM SOURCE_RECORD sr

        JOIN SOURCE_SYSTEM ss
            ON sr.SOURCE_SYSTEM_ID = ss.SOURCE_SYSTEM_ID

        ORDER BY sr.SOURCE_RECORD_ID
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    records = []

    for row in rows:

        raw_data = parse_raw_data(row["RAW_DATA_JSON"])

        records.append({

            "id": int(row["SOURCE_RECORD_ID"]),

            "source": row["SOURCE_SYSTEM_NAME"],

            "source_customer_id": row["SOURCE_CUSTOMER_ID"],

            "name": normalize_text(
                raw_data.get("customer_name_normalized")
                or row["CUSTOMER_NAME"]
            ),

            "email": normalize_email(
                raw_data.get("email_normalized")
                or row["EMAIL"]
            ),

            "phone": normalize_phone(
                raw_data.get("phone_normalized")
                or row["PHONE"]
            ),

            "dob": normalize_dob(
                row["DATE_OF_BIRTH"]
            ),

            "postal_code": normalize_text(
                raw_data.get("postal_code_normalized")
                or row["POSTAL_CODE"]
            ),

            "address": normalize_text(
                raw_data.get("address_normalized")
                or row["ADDRESS"]
            )

        })

    return records


# ============================================================
# 5. GENERATE POSSIBLE PAIRS USING BLOCKING
# ============================================================

def generate_possible_pairs(records):

    email_groups = defaultdict(list)
    phone_groups = defaultdict(list)
    dob_groups = defaultdict(list)

    for record in records:

        if record["email"]:
            email_groups[record["email"]].append(record)

        if record["phone"]:
            phone_groups[record["phone"]].append(record)

        if record["dob"]:
            dob_groups[record["dob"]].append(record)

    possible_pairs = {}

    def add_cross_source_pairs(group):

        for first, second in combinations(group, 2):

            # Never compare records from the same source.
            if first["source"] == second["source"]:
                continue

            id1, id2 = sorted((first["id"], second["id"]))

            possible_pairs[(id1, id2)] = (first, second)

    # Block 1: Exact email.
    for group in email_groups.values():
        add_cross_source_pairs(group)

    # Block 2: Exact phone.
    for group in phone_groups.values():
        add_cross_source_pairs(group)

    # Block 3: Same DOB.
    # RapidFuzz will evaluate name similarity inside these groups.
    for group in dob_groups.values():
        add_cross_source_pairs(group)

    return possible_pairs


# ============================================================
# 6. CONFIDENCE BAND CLASSIFICATION
# ============================================================

def classify_confidence(score):

    if score >= HIGH_THRESHOLD:
        return "HIGH"

    elif score >= MEDIUM_THRESHOLD:
        return "MEDIUM"

    return "LOW"


# ============================================================
# 6.5 NAME COMPATIBILITY (INITIALS / FULL NAMES)
# ============================================================

def names_compatible(name1, name2):
    """Recognize exact/similar names and aligned initials.

    This is a candidate-matching heuristic, not proof of identity.
    """
    import re

    a = re.findall(r"[a-z]+", normalize_text(name1))
    b = re.findall(r"[a-z]+", normalize_text(name2))
    if not a or not b:
        return False

    if a == b:
        return True

    # Require the same given name; avoid matching unrelated people
    # simply because their surnames share an initial.
    if len(a[0]) == 1 or len(b[0]) == 1:
        if a[0][0] != b[0][0]:
            return False
    elif a[0] != b[0]:
        return False

    # Require corresponding remaining name tokens to agree, allowing
    # a one-letter token to abbreviate a longer token.
    if len(a) != len(b):
        return False
    for left, right in zip(a[1:], b[1:]):
        if left == right:
            continue
        if len(left) == 1 or len(right) == 1:
            if left[0] == right[0]:
                continue
        return False
    return True


# ============================================================
# 7. MATCH EVALUATION
# ============================================================

def evaluate_pair(first, second):

    email_match = (
        bool(first["email"])
        and first["email"] == second["email"]
    )

    phone_match = (
        bool(first["phone"])
        and first["phone"] == second["phone"]
    )

    dob_match = (
        bool(first["dob"])
        and first["dob"] == second["dob"]
    )

    dob_conflict = (
        bool(first["dob"])
        and bool(second["dob"])
        and first["dob"] != second["dob"]
    )

    name_similarity = 0

    if first["name"] and second["name"]:

        name_similarity = fuzz.token_sort_ratio(
            first["name"],
            second["name"]
        )

    name_compatible = names_compatible(first["name"], second["name"])

    postal_match = (
        bool(first["postal_code"])
        and first["postal_code"] == second["postal_code"]
    )

    evidence = {

        "algorithm_version": ALGORITHM_VERSION,

        "source_system_1": first["source"],

        "source_system_2": second["source"],

        "email_match": email_match,

        "phone_match": phone_match,

        "dob_match": dob_match,

        "dob_conflict": dob_conflict,

        "name_similarity": round(name_similarity, 2),
        "name_compatible": name_compatible,

        "postal_code_match": postal_match

    }

    # --------------------------------------------------------
    # SAFETY RULE 1: Conflicting DOB
    # --------------------------------------------------------

    if dob_conflict and (email_match or phone_match):

        evidence["reason"] = (
            "Shared contact information but conflicting "
            "dates of birth. Potential different individuals."
        )

        return {
            "score": 0,
            "band": "LOW",
            "method": "DOB_CONFLICT",
            "status": "BLOCKED_DOB_CONFLICT",
            "evidence": evidence
        }

    # --------------------------------------------------------
    # SAFETY RULE 2: Shared contact but incompatible names
    # --------------------------------------------------------

    if (
        (email_match or phone_match)
        and dob_match
        and first["name"]
        and second["name"]
        and not name_compatible
        and name_similarity < CONTACT_NAME_THRESHOLD
    ):

        evidence["reason"] = (
            "DOB and contact information match, but the names are "
            "incompatible even after checking initials. "
            "Manual investigation required; shared contacts are possible."
        )

        return {
            "score": 0,
            "band": "LOW",
            "method": "SHARED_CONTACT_NAME_CONFLICT",
            "status": "BLOCKED_NAME_CONFLICT",
            "evidence": evidence
        }

    # --------------------------------------------------------
    # RULE 1: Exact email + exact DOB
    # --------------------------------------------------------

    if email_match and dob_match:

        score = 100 if name_compatible else 95

        method = "EXACT_EMAIL_DOB"

        reason = (
            "Exact email and DOB; names compatible (including initials)."
            if name_compatible else
            "Exact email and DOB; name difference requires steward review."
        )

    # --------------------------------------------------------
    # RULE 2: Exact phone + exact DOB
    # --------------------------------------------------------

    elif phone_match and dob_match:

        score = 98 if name_compatible else 95

        method = "EXACT_PHONE_DOB"

        reason = "Exact phone and date of birth match."

    # --------------------------------------------------------
    # RULE 3: Exact email + highly similar name
    # --------------------------------------------------------

    elif email_match and (
        name_similarity >= FUZZY_NAME_THRESHOLD or name_compatible
    ):

        score = 95

        method = "EXACT_EMAIL_FUZZY_NAME"

        reason = (
            "Exact email and highly similar customer names."
        )

    # --------------------------------------------------------
    # RULE 4: Fuzzy name + exact DOB
    # --------------------------------------------------------

    elif ( dob_match and name_similarity >= FUZZY_NAME_THRESHOLD and (email_match or phone_match)):

        score = 90

        method = "FUZZY_NAME_DOB"

        reason = (
            "Highly similar customer names and exact "
            "date of birth."
        )

    # --------------------------------------------------------
    # RULE 5: Exact phone + similar name, DOB unavailable
    # --------------------------------------------------------

    elif (
        phone_match
        and not first["dob"]
        and not second["dob"]
        and (name_similarity >= FUZZY_NAME_THRESHOLD or name_compatible)
    ):

        score = 85

        method = "EXACT_PHONE_FUZZY_NAME"

        reason = (
            "Exact phone and highly similar names; "
            "DOB unavailable in both records."
        )

    else:
        return None

    evidence["reason"] = reason

    evidence["score_explanation"] = (
        "Heuristic score based on the matching rule. "
        "Not a calibrated probability."
    )

    return {

        "score": score,

        "band": classify_confidence(score),

        "method": method,

        "status": "PENDING_REVIEW",

        "evidence": evidence

    }


# ============================================================
# 8. RUN DETERMINISTIC + FUZZY MATCHING
# ============================================================

def run_matching_engine(records):

    possible_pairs = generate_possible_pairs(records)

    candidates = []

    for (id1, id2), (first, second) in possible_pairs.items():

        result = evaluate_pair(first, second)

        if result is None:
            continue

        candidates.append({

            "id1": id1,

            "id2": id2,

            "score": result["score"],

            "band": result["band"],

            "method": result["method"],

            "status": result["status"],

            "evidence": result["evidence"]

        })

    return candidates, len(possible_pairs)


# ============================================================
# 9. CHECK EXISTING CANDIDATES
# ============================================================

def get_existing_pairs(cursor):

    cursor.execute("""
        SELECT
            SOURCE_RECORD_ID_1,
            SOURCE_RECORD_ID_2
        FROM MATCH_CANDIDATE
    """)

    return {

        (
            int(row["SOURCE_RECORD_ID_1"]),
            int(row["SOURCE_RECORD_ID_2"])
        )

        for row in cursor.fetchall()

    }


# ============================================================
# 10. SAVE CANDIDATES TO SNOWFLAKE
# ============================================================




def save_candidates(cursor, connection, candidates):

    existing_pairs = get_existing_pairs(cursor)

    new_candidates = [
        c for c in candidates
        if (c["id1"], c["id2"]) not in existing_pairs
    ]

    print("\nExisting candidate pairs:", len(existing_pairs))
    print("New candidate pairs:", len(new_candidates))

    if DRY_RUN:
        print("\nPREVIEW MODE ENABLED.")
        return

    if not new_candidates:
        print("No new candidates to insert.")
        return

    batch_size = 500
    inserted_count = 0

    try:

        for start in range(0, len(new_candidates), batch_size):

            batch = new_candidates[start:start + batch_size]

            # Create multiple parameterized VALUES rows
            row_placeholder = "(" + ", ".join(["%s"] * 8) + ")"

            values_clause = ", ".join(
                [row_placeholder] * len(batch)
            )

            insert_sql = f"""
                INSERT INTO MATCH_CANDIDATE (
                    SOURCE_RECORD_ID_1,
                    SOURCE_RECORD_ID_2,
                    CONFIDENCE_SCORE,
                    CONFIDENCE_BAND,
                    MATCH_METHOD,
                    MATCH_EVIDENCE,
                    MATCH_STATUS,
                    ALGORITHM_VERSION
                )

                SELECT
                    column1,
                    column2,
                    column3,
                    column4,
                    column5,
                    PARSE_JSON(column6),
                    column7,
                    column8

                FROM VALUES {values_clause}
            """

            # Flatten all batch values
            values = []

            for c in batch:

                values.extend([
                    c["id1"],
                    c["id2"],
                    c["score"],
                    c["band"],
                    c["method"],
                    json.dumps(c["evidence"]),
                    c["status"],
                    ALGORITHM_VERSION
                ])

            cursor.execute(insert_sql, tuple(values))

            connection.commit()

            inserted_count += len(batch)

            print(
                f"Inserted {inserted_count} / "
                f"{len(new_candidates)} remaining candidates"
            )

        print("\nSuccessfully inserted:", inserted_count)

    except Exception as error:

        connection.rollback()

        print("\nINSERTION ERROR:", error)
        raise

# ============================================================
# 11. GENERATE MATCHING SUMMARY
# ============================================================

def generate_summary(records, candidates, possible_pair_count):

    print("\n" + "=" * 60)

    print("CUSTOMER 360 - IDENTITY RESOLUTION SUMMARY")

    print("=" * 60)

    print("Source records processed:", len(records))

    print("Possible pairs evaluated:", possible_pair_count)

    print("Matching candidates generated:", len(candidates))

    print("\nMATCH METHOD BREAKDOWN")

    methods = defaultdict(int)

    for candidate in candidates:
        methods[candidate["method"]] += 1

    for method, count in sorted(methods.items()):
        print(f"{method}: {count}")

    print("\nCONFIDENCE BAND BREAKDOWN")

    bands = defaultdict(int)

    for candidate in candidates:

        if candidate["status"] == "PENDING_REVIEW":
            bands[candidate["band"]] += 1

    for band in ["HIGH", "MEDIUM", "LOW"]:
        print(f"{band}: {bands[band]}")

    print("\nBLOCKED CANDIDATES")

    blocked = defaultdict(int)

    for candidate in candidates:

        if candidate["status"].startswith("BLOCKED"):
            blocked[candidate["status"]] += 1

    for status, count in sorted(blocked.items()):
        print(f"{status}: {count}")

    print("\nFIRST 10 CANDIDATES")

    for candidate in candidates[:10]:

        print({

            "record_1": candidate["id1"],

            "record_2": candidate["id2"],

            "score": candidate["score"],

            "band": candidate["band"],

            "method": candidate["method"],

            "status": candidate["status"]

        })

    print("\n" + "=" * 60)

# ============================================================
# 11.5 GROUND-TRUTH EVALUATION
# ============================================================

def normalize_source_name(value):

    value = normalize_text(value)

    if "sales" in value:
        return "sales"

    if "support" in value:
        return "support"

    if "billing" in value:
        return "billing"

    return value.replace(" ", "")


def find_column(dataframe, possible_names):

    normalized_columns = {
        str(column).lower().replace("_", "").replace(" ", ""): column
        for column in dataframe.columns
    }

    for name in possible_names:

        key = name.lower().replace("_", "").replace(" ", "")

        if key in normalized_columns:
            return normalized_columns[key]

    raise ValueError(
        "Required column not found. Expected one of: "
        + str(possible_names)
    )


def evaluate_ground_truth(records, candidates):

    print("\n" + "=" * 60)
    print("GROUND-TRUTH MATCHING EVALUATION")
    print("=" * 60)

    # Locate evaluation dataset.
    base_directory = os.path.dirname(os.path.abspath(__file__))

    possible_paths = [

        os.path.join(
            base_directory,
            "..",
            "Source_Data",
            "Evaluation",
            "evaluation_ground_truth.csv"
        ),

        os.path.join(
            base_directory,
            "..",
            "Source_Data",
            "evaluation_ground_truth.csv"
        ),

        os.path.join(
            base_directory,
            "evaluation_ground_truth.csv"
        )

    ]

    ground_truth_path = next(
        (
            path for path in possible_paths
            if os.path.exists(path)
        ),
        None
    )

    if ground_truth_path is None:

        raise FileNotFoundError(
            "evaluation_ground_truth.csv was not found. "
            "Place it in Source_Data/Evaluation."
        )

    print("Evaluation file:", ground_truth_path)

    # Read evaluation data separately.
    ground_truth = pd.read_csv(
        ground_truth_path,
        dtype=str,
        keep_default_na=False
    )

    source_column = find_column(
        ground_truth,
        ["source_system", "source", "source_name"]
    )

    customer_id_column = find_column(
        ground_truth,
        ["source_customer_id", "customer_id"]
    )

    person_key_column = find_column(
        ground_truth,
        ["synthetic_person_key", "person_key"]
    )

    # Build source-record identity lookup.
    truth_lookup = {}

    for _, row in ground_truth.iterrows():

        key = (
            normalize_source_name(row[source_column]),
            str(row[customer_id_column]).strip()
        )

        person_key = str(row[person_key_column]).strip()

        if not person_key:
            continue

        if key in truth_lookup:

            if truth_lookup[key] != person_key:

                raise ValueError(
                    "Conflicting ground-truth identities for "
                    + str(key)
                )

        truth_lookup[key] = person_key

    # Map Snowflake source record IDs to synthetic identities.
    record_identity = {}

    unmatched_records = 0

    for record in records:

        key = (
            normalize_source_name(record["source"]),
            str(record["source_customer_id"]).strip()
        )

        person_key = truth_lookup.get(key)

        if person_key is None:

            unmatched_records += 1

        else:

            record_identity[record["id"]] = person_key

    print("Ground-truth rows:", len(ground_truth))
    print("Records matched to ground truth:", len(record_identity))
    print("Records without ground truth:", unmatched_records)

    if unmatched_records > 0:

        print(
            "\nWARNING: Evaluation stopped because some "
            "source records have no ground-truth identity."
        )

        print(
            "Check source names and source customer IDs "
            "in the evaluation CSV."
        )

        return

    # --------------------------------------------------------
    # Calculate total genuine cross-source matching pairs.
    # --------------------------------------------------------

    person_source_counts = defaultdict(
        lambda: defaultdict(int)
    )

    for record in records:

        person_key = record_identity[record["id"]]

        source = normalize_source_name(record["source"])

        person_source_counts[person_key][source] += 1

    total_true_pairs = 0

    for source_counts in person_source_counts.values():

        counts = list(source_counts.values())

        for i in range(len(counts)):

            for j in range(i + 1, len(counts)):

                total_true_pairs += counts[i] * counts[j]
    

    records_by_id = {
    	record["id"]: record
    	for record in records
    }

    blocked_same_person_examples = []

    # --------------------------------------------------------
    # Evaluate generated candidates.
    # --------------------------------------------------------

    true_positives = 0
    false_positives = 0

    blocked_same_person = 0
    blocked_different_person = 0

    for candidate in candidates:

        id1 = candidate["id1"]
        id2 = candidate["id2"]

        person1 = record_identity[id1]
        person2 = record_identity[id2]

        same_person = person1 == person2

        if candidate["status"] == "PENDING_REVIEW":

            if same_person:
                true_positives += 1
            else:
                false_positives += 1

        elif candidate["status"].startswith("BLOCKED"):

            if same_person:

                blocked_same_person += 1

                first = records_by_id[id1]
                second = records_by_id[id2]

                blocked_same_person_examples.append({

                    "record_1": id1,
                    "record_2": id2,

                    "name_1": first["name"],
                    "name_2": second["name"],

                    "email_1": first["email"],
                    "email_2": second["email"],

                    "phone_1": first["phone"],
                    "phone_2": second["phone"],

                    "dob_1": first["dob"],
                    "dob_2": second["dob"],

                    "name_similarity": candidate["evidence"][
                        "name_similarity"
                    ],

                    "blocking_reason": candidate["method"]

                })

            else:
                blocked_different_person += 1

    # False negatives include missed genuine pairs and
    # genuine pairs that were blocked from review.
    false_negatives = max(
        0,
        total_true_pairs - true_positives
    )

    precision = (
        true_positives / (true_positives + false_positives)
        if (true_positives + false_positives) > 0
        else 0
    )

    recall = (
        true_positives / (true_positives + false_negatives)
        if (true_positives + false_negatives) > 0
        else 0
    )

    f1_score = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0
        else 0
    )

    # --------------------------------------------------------
    # Print evaluation report.
    # --------------------------------------------------------

    print("\nPAIR CLASSIFICATION")
    print("-" * 40)

    print("Total genuine cross-source pairs:", total_true_pairs)

    print("True Positives:", true_positives)

    print("False Positives:", false_positives)

    print("False Negatives:", false_negatives)

    print("\nMATCHING QUALITY")
    print("-" * 40)

    print(f"Precision: {precision * 100:.2f}%")

    print(f"Recall:    {recall * 100:.2f}%")

    print(f"F1-score:  {f1_score * 100:.2f}%")

    print("\nSAFETY CHECK")
    print("-" * 40)

    print(
        "Blocked candidates belonging to same person:",
        blocked_same_person
    )

    print(
        "Blocked candidates belonging to different people:",
        blocked_different_person
    )

    print("\nSAME-PERSON PAIRS BLOCKED FOR INVESTIGATION")
    print("-" * 60)

    for example in blocked_same_person_examples[:15]:

        print(json.dumps(example, indent=4))

    print(
        "\nTotal blocked same-person examples:",
        len(blocked_same_person_examples)
    )

    print("\n" + "=" * 60)
    print("GROUND-TRUTH EVALUATION COMPLETED")
    print("=" * 60)



# ============================================================
# 12. MAIN EXECUTION
# ============================================================


def main():

    connection = None

    try:

        print("=" * 60)

        print("CUSTOMER 360 IDENTITY RESOLUTION ENGINE")

        print("=" * 60)

        print("\nConnecting to Snowflake...")

        connection = connect_snowflake()

        cursor = connection.cursor(DictCursor)

        print("Snowflake connection successful.")

        print("\nLoading source records...")

        records = load_source_records(cursor)

        print("Records loaded:", len(records))

        print("\nRunning deterministic and fuzzy matching...")

        candidates, possible_pair_count = run_matching_engine(
            records
        )

        generate_summary(
            records,
            candidates,
            possible_pair_count
        )

        # Evaluate matching quality using offline ground truth.
        evaluate_ground_truth(
            records,
            candidates
        )

        # Keep insertion disabled during evaluation.
        save_candidates(
            cursor,
            connection,
            candidates
        )

        cursor.close()

        print("\nIdentity Resolution Engine completed.")

    except Exception as error:

        print("\nENGINE ERROR:")

        print(error)

        if connection:
            connection.rollback()

    finally:

        if connection:
            connection.close()

        print("\nSnowflake connection closed.")


if __name__ == "__main__":
    main()
