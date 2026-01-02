"""
Run database migration to add code_verifier column to oauth_states table.
"""
import os
from supabase import create_client

# Supabase credentials
SUPABASE_URL = "https://vbllagoyotlrxsdmnyxu.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def run_migration():
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY environment variable not set")
        print("Please set it and run again:")
        print('  $env:SUPABASE_SERVICE_KEY="your_service_key_here"')
        return False
    
    print(f"Connecting to Supabase: {SUPABASE_URL}")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Check if column already exists by querying for it
    print("Checking if code_verifier column exists...")
    try:
        result = supabase.table("oauth_states").select("id, code_verifier").limit(1).execute()
        print("✓ Column 'code_verifier' already exists!")
        return True
    except Exception as e:
        if "code_verifier" in str(e) and "does not exist" in str(e):
            print("Column does not exist. This needs to be added via Supabase Dashboard SQL Editor.")
            print("\nRun this SQL in Supabase Dashboard -> SQL Editor:")
            print("-" * 50)
            print("ALTER TABLE public.oauth_states")
            print("ADD COLUMN IF NOT EXISTS code_verifier text;")
            print("-" * 50)
            return False
        else:
            print(f"Error: {e}")
            return False

if __name__ == "__main__":
    run_migration()
