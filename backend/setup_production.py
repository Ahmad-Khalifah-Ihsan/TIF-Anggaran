#!/usr/bin/env python3
"""
Script untuk generate JWT_SECRET baru untuk production
Jalankan: python setup_production.py
"""
import secrets

def generate_jwt_secret():
    """Generate JWT secret baru"""
    secret = secrets.token_urlsafe(64)
    print("=" * 60)
    print("JWT_SECRET BARU UNTUK PRODUCTION")
    print("=" * 60)
    print(f"\n{secret}\n")
    print("=" * 60)
    print("COPY SECRET INI KE FILE .env DI VPS ANDA")
    print("=" * 60)
    return secret

def generate_all_env():
    """Generate semua environment variable untuk production"""
    jwt_secret = secrets.token_urlsafe(64)
    
    print("=" * 60)
    print("ENVIRONMENT VARIABLES UNTUK PRODUCTION")
    print("=" * 60)
    print("\nTambahkan ke file .env di VPS:\n")
    print(f"SUPABASE_URL=https://your-project.supabase.co")
    print(f"SUPABASE_KEY=your-anon-key")
    print(f"SUPABASE_SERVICE_KEY=your-service-role-key")
    print(f"JWT_SECRET={jwt_secret}")
    print(f"ALLOWED_ORIGINS=https://your-domain.com,http://your-ip:port")
    print("\n" + "=" * 60)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        generate_all_env()
    else:
        generate_jwt_secret()
