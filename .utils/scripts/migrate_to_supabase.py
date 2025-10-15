#!/usr/bin/env python3
"""
Migration script to transfer flood data from SQLite to Supabase PostgreSQL.
Reads all records from floods_greece.db and bulk inserts them into Supabase.
"""

import sqlite3
import sys
import time
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv
import os


def load_environment_variables():
    """Load and validate environment variables."""
    load_dotenv()
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url:
        print("Error: SUPABASE_URL environment variable is missing.")
        print("Make sure .env file exists and contains SUPABASE_URL.")
        sys.exit(1)
    
    if not supabase_service_role_key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.")
        print("Make sure .env file exists and contains SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(1)
    
    return supabase_url, supabase_service_role_key


def get_sqlite_connection():
    """Get SQLite database connection."""
    db_path = Path("floods_greece.db")
    if not db_path.exists():
        print("Error: SQLite database file 'floods_greece.db' not found in project root.")
        sys.exit(1)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn


def get_supabase_client(url: str, key: str) -> Client:
    """Initialize Supabase client."""
    try:
        client = create_client(url, key)
        return client
    except Exception as e:
        print(f"Error: Failed to connect to Supabase: {e}")
        sys.exit(1)


def read_floods_from_sqlite(conn: sqlite3.Connection):
    """Read all flood records from SQLite database."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, date_of_commencement, year, x_original, y_original, latitude, longitude,
               location_name, flood_event_name, deaths_toll, rainfall_duration, cause_of_flood,
               rainfall_height, relevant_information, source, col_m, col_n, col_o, col_p
        FROM floods
    """)
    rows = cursor.fetchall()
    
    records = []
    for row in rows:
        record = dict(row)
        records.append(record)
    
    print(f"Read {len(records)} records from SQLite database.")
    return records


def insert_floods_to_supabase(client: Client, records: list):
    """Insert flood records into Supabase in batches."""
    batch_size = 100
    total_records = len(records)
    successful_inserts = 0
    failed_inserts = 0
    
    for i in range(0, total_records, batch_size):
        batch = records[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (total_records + batch_size - 1) // batch_size
        
        try:
            response = client.table('floods').insert(batch).execute()
            successful_inserts += len(batch)
            print(f"Inserted batch {batch_num}/{total_batches}: {len(batch)} records ({successful_inserts}/{total_records} total)")
        except Exception as e:
            failed_inserts += len(batch)
            print(f"Error inserting batch {batch_num}/{total_batches}: {e}")
            # Continue with next batch
    
    return successful_inserts, failed_inserts


def main():
    """Main migration execution."""
    start_time = time.time()
    print(f"Starting migration at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Load environment variables
    supabase_url, supabase_service_role_key = load_environment_variables()
    
    # Connect to databases
    sqlite_conn = get_sqlite_connection()
    supabase_client = get_supabase_client(supabase_url, supabase_service_role_key)
    
    # Read data from SQLite
    records = read_floods_from_sqlite(sqlite_conn)
    if not records:
        print("No records found in SQLite database. Exiting.")
        sqlite_conn.close()
        sys.exit(0)
    
    # Insert data to Supabase
    successful, failed = insert_floods_to_supabase(supabase_client, records)
    
    # Close connections
    sqlite_conn.close()
    
    # Print summary
    end_time = time.time()
    execution_time = end_time - start_time
    print("\nMigration Summary:")
    print(f"Total records processed: {len(records)}")
    print(f"Successfully inserted: {successful}")
    print(f"Failed insertions: {failed}")
    print(f"Execution time: {execution_time:.2f} seconds")
    
    if failed > 0:
        print("Warning: Some records failed to insert. Check logs above for details.")
        sys.exit(1)
    else:
        print("Migration completed successfully.")
        sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nMigration interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)