
import pandas as pd
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "Source_Data"
PROCESSED_DIR = DATA_DIR / "Processed"

files = {
    "Sales CRM": "sales_customers.csv",
    "Customer Support": "support_customers.csv",
    "Billing System": "billing_customers.csv"
}

required_columns = [
    "source_customer_id",
    "customer_name",
    "email",
    "phone",
    "date_of_birth",
    "address",
    "postal_code",
    "source_updated_at",
    "ingested_at",
    "customer_name_normalized",
    "email_normalized",
    "phone_normalized",
    "postal_code_normalized",
    "address_normalized"
]

all_passed = True

for source_name, filename in files.items():

    print("\n" + "=" * 65)
    print("VALIDATING NORMALIZED DATA:", source_name)
    print("=" * 65)

    raw_df = pd.read_csv(
        DATA_DIR / filename,
        dtype={"source_customer_id": "string"}
    )

    processed_df = pd.read_csv(
        PROCESSED_DIR / filename,
        dtype={"source_customer_id": "string"}
    )

    checks = {}

    checks["Record count is 10000"] = len(processed_df) == 10000

    checks["All expected columns exist"] = all(
        col in processed_df.columns for col in required_columns
    )

    checks["Source IDs preserved"] = (
        raw_df["source_customer_id"].equals(
            processed_df["source_customer_id"]
        )
    )

    checks["Source IDs are unique"] = (
        processed_df["source_customer_id"].is_unique
    )

    checks["Email missing count preserved"] = (
        raw_df["email"].isnull().sum()
        == processed_df["email"].isnull().sum()
    )

    checks["Phone missing count preserved"] = (
        raw_df["phone"].isnull().sum()
        == processed_df["phone"].isnull().sum()
    )

    for check_name, result in checks.items():
        print(
            f"{check_name}:",
            "PASS" if result else "FAIL"
        )

    print("\nSample before-and-after values:")

    sample_columns = [
        "customer_name",
        "customer_name_normalized",
        "email",
        "email_normalized",
        "phone",
        "phone_normalized"
    ]

    print(
        processed_df[sample_columns].head(5).to_string(index=False)
    )

    source_passed = all(checks.values())
    all_passed = all_passed and source_passed

    print(
        "\nSOURCE RESULT:",
        "PASSED" if source_passed else "FAILED"
    )

print("\n" + "=" * 65)
print(
    "OVERALL RESULT:",
    "ALL DATASETS PASSED" if all_passed
    else "CHECK FAILURES"
)
print("=" * 65)
