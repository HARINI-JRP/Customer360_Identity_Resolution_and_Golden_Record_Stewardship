
import os
import snowflake.connector
from dotenv import load_dotenv

load_dotenv()

connection = None

try:
    connection = snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        role=os.getenv("SNOWFLAKE_ROLE"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        database=os.getenv("SNOWFLAKE_DATABASE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA")
    )

    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            CURRENT_DATABASE(),
            CURRENT_SCHEMA(),
            COUNT(*)
        FROM SOURCE_RECORD
    """)

    result = cursor.fetchone()

    print("SNOWFLAKE CONNECTION SUCCESSFUL!")
    print("Database:", result[0])
    print("Schema:", result[1])
    print("Total source records:", result[2])

except Exception as error:
    print("CONNECTION FAILED!")
    print(error)

finally:
    if connection:
        connection.close()
