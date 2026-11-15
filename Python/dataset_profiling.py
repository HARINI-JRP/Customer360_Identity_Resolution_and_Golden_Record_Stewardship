
import pandas as pd
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_DIR / "Source_Data"

files = {
    "Sales CRM": "sales_customers.csv",
    "Customer Support": "support_customers.csv",
    "Billing System": "billing_customers.csv"
}

for source_name, filename in files.items():

    print("\n" + "=" * 65)
    print(f"DATA PROFILING: {source_name}")
    print("=" * 65)

    file_path = DATA_DIR / filename
    df = pd.read_csv(file_path)

    print("\n1. DATASET OVERVIEW")
    print("Total records:", len(df))
    print("Total columns:", len(df.columns))

    print("\n2. COLUMN DATA TYPES")
    print(df.dtypes)

    print("\n3. MISSING VALUES")
    missing = df.isnull().sum()
    missing_percentage = (missing / len(df)) * 100

    missing_report = pd.DataFrame({
        "Missing Count": missing,
        "Missing Percentage": missing_percentage.round(2)
    })
    print(missing_report)

    print("\n4. DUPLICATE CHECK")
    print(
        "Duplicate source customer IDs:",
        df["source_customer_id"].duplicated().sum()
    )
    print(
        "Completely duplicate rows:",
        df.duplicated().sum()
    )

    print("\n5. DISTINCT VALUE COUNTS")
    for column in ["customer_name", "email", "phone", "postal_code"]:
        print(
            f"{column}:",
            df[column].nunique(dropna=True)
        )

    print("\n6. SAMPLE CUSTOMER RECORDS")
    print(df.head(5).to_string(index=False))

    print("\nPROFILE COMPLETED:", source_name)

print("\n" + "=" * 65)
print("ALL THREE DATASETS PROFILED SUCCESSFULLY")
print("=" * 65)
