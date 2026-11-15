
import pandas as pd
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "Source_Data"
OUTPUT_DIR = DATA_DIR / "Processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

files = {
    "Sales CRM": "sales_customers.csv",
    "Customer Support": "support_customers.csv",
    "Billing System": "billing_customers.csv"
}


def clean_text(series):
    return (
        series.astype("string")
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
    )


for source_name, filename in files.items():

    print("\n" + "=" * 60)
    print("NORMALIZING:", source_name)
    print("=" * 60)

    input_path = DATA_DIR / filename

    # Read identifier-like columns as strings
    df = pd.read_csv(
        input_path,
        dtype={
            "source_customer_id": "string",
            "phone": "string",
            "postal_code": "string"
        }
    )

    # Preserve original columns and create normalized columns
    df["customer_name_normalized"] = (
        clean_text(df["customer_name"])
        .str.lower()
        .str.replace(r"[^\w\s]", "", regex=True)
    )

    df["email_normalized"] = (
        clean_text(df["email"])
        .str.lower()
    )

    # Remove phone formatting characters.
    # Keep country codes and leading zeros.
    df["phone_normalized"] = (
        df["phone"]
        .str.replace(r"\D", "", regex=True)
    )

    df["postal_code_normalized"] = clean_text(
        df["postal_code"]
    )

    df["address_normalized"] = (
        clean_text(df["address"])
        .str.lower()
    )

    # Convert date and timestamp columns
    df["date_of_birth"] = pd.to_datetime(
        df["date_of_birth"],
        errors="coerce"
    )

    df["source_updated_at"] = pd.to_datetime(
        df["source_updated_at"],
        errors="coerce"
    )

    df["ingested_at"] = pd.to_datetime(
        df["ingested_at"],
        errors="coerce"
    )

    # Save a separate processed copy
    output_path = OUTPUT_DIR / filename
    df.to_csv(output_path, index=False)

    print("Records processed:", len(df))
    print("Output file:", output_path)
    print("Normalized name column created")
    print("Normalized email column created")
    print("Normalized phone column created")
    print("Normalized postal code column created")
    print("Normalized address column created")

print("\n" + "=" * 60)
print("ALL DATASETS NORMALIZED SUCCESSFULLY")
print("=" * 60)
