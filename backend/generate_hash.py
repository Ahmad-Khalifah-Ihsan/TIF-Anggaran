import bcrypt

# Hash untuk Tifadmin123 (tanpa karakter khusus - untuk admin)
password1 = b"Tifadmin123"
hash1 = bcrypt.hashpw(password1, bcrypt.gensalt()).decode('utf-8')
print(f"Password: Tifadmin123")
print(f"Hash: {hash1}")
print()

# Hash untuk Admin@123 (dengan karakter khusus - untuk user biasa)
password2 = b"Admin@123"
hash2 = bcrypt.hashpw(password2, bcrypt.gensalt()).decode('utf-8')
print(f"Password: Admin@123")
print(f"Hash: {hash2}")
