"""
Test Supabase Connection
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

print("Testing Supabase Connection...")
print(f"URL: {SUPABASE_URL}")
print(f"Key: {SUPABASE_KEY[:20]}..." if SUPABASE_KEY else "Key: None")

try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)
    
    # Test query
    response = supabase.table("admin_users").select("id").limit(1).execute()
    print(f"✅ Connection successful! Found {len(response.data)} users")
    
    # Check categories
    categories = supabase.table("budget_categories").select("*").execute()
    print(f"✅ Found {len(categories.data)} budget categories")
    
except Exception as e:
    print(f"❌ Connection failed: {str(e)}")
    sys.exit(1)
