
import pandas as pd
from pathlib import Path

DATA_DIR = Path(r"E:\\Documents\\Customer360_Harini_JRP\\Source_Data")

# Source datasets
files = {
    "Sales CRM": "E:\\Documents\\Customer360_Harini_JRP\\Source_data\\sales_customers.csv",
    "Customer Support": "E:\\Documents\\Customer360_Harini_JRP\\Source_data\\support_customers.csv",
    "Billing System": "E:\\Documents\\Customer360_Harini_JRP\\Source_data\\billing_customers.csv"
}

expected_columns = [
    "source_customer_id",
    "customer_name",
    "email",
    "phone",
    "date_of_birth",
    "address",
    "postal_code",
    "source_updated_at",
    "ingested_at"
]

for source_name, filename in files.items():

    print("\n" + "=" * 55)
    print(f"VALIDATING: {source_name}")
    print("=" * 55)

    file_path = DATA_DIR / filename

    df = pd.read_csv(file_path)

    print("Total records:", len(df))
    print("Total columns:", len(df.columns))

    # Check expected columns
    missing_columns = [
        col for col in expected_columns
        if col not in df.columns
    ]

    print("Missing columns:", missing_columns)

    # Check missing values
    print("\nMissing values:")
    print(df.isnull().sum())

    # Check duplicate source IDs
    print(
        "\nDuplicate customer IDs:",
        df["source_customer_id"].duplicated().sum()
    )

    # Display sample records
    print("\nFirst 5 records:")
    print(df.head())

    # Basic validation
    if len(df) == 10000 and not missing_columns:
        print("\nSTATUS: BASIC VALIDATION PASSED")
    else:
        print("\nSTATUS: VALIDATION NEEDS ATTENTION")
