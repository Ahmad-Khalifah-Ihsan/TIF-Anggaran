"""
Reset Admin Password Script
Run this to reset the admin password
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

from passlib.context import CryptContext
from supabase import create_client
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing Supabase credentials in .env file")
    sys.exit(1)

def reset_admin_password(new_password: str = "admin123"):
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        password_hash = pwd_context.hash(new_password)
        
        response = supabase.table("admin_users").update({
            "password_hash": password_hash,
            "must_change_password": False
        }).eq("username", "admin").execute()
        
        if response.data:
            print(f"✅ Admin password reset successfully!")
            print(f"   Username: admin")
            print(f"   Password: {new_password}")
        else:
            print("❌ Admin user not found. Creating new admin user...")
            
            insert_response = supabase.table("admin_users").insert({
                "username": "admin",
                "password_hash": password_hash,
                "nama_lengkap": "Administrator",
                "is_active": True,
                "must_change_password": False
            }).execute()
            
            if insert_response.data:
                print(f"✅ Admin user created successfully!")
                print(f"   Username: admin")
                print(f"   Password: {new_password}")
            else:
                print("❌ Failed to create admin user")
                sys.exit(1)
                
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    password = sys.argv[1] if len(sys.argv) > 1 else "admin123"
    print(f"Resetting admin password to: {password}")
    print()
    reset_admin_password(password)
