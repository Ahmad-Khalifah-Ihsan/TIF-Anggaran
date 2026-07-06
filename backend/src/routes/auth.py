"""
Auth Routes - Updated with Brute Force Protection and Enhanced Security
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth import verify_password, create_access_token, hash_password
from ..security.rate_limiter import login_rate_limiter, global_rate_limiter
from ..security.password_validator import validate_password_strength, validate_password_strength_strict, validate_password_for_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
security = HTTPBearer()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Rate limit configuration for login
LOGIN_RATE_LIMIT = "5/minute"  # 5 attempts per minute per IP
REGISTER_RATE_LIMIT = "3/minute"  # 3 registrations per minute per IP


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    nama_lengkap: Optional[str] = None
    telegram_id: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    from ..auth.jwt_handler import decode_access_token
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    return payload


def get_supabase_service_client():
    import os
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
    return create_client(SUPABASE_URL, key)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(request: Request, login_request: LoginRequest):
    """
    Login endpoint with brute-force protection.
    
    Features:
    - Rate limiting: 5 attempts per minute per IP
    - Lockout after 5 failed attempts (15 minutes)
    - Tracks both IP and username for protection
    """
    client_ip = get_client_ip(request)
    username = login_request.username
    
    # Check if IP is locked out
    ip_locked, ip_remaining = login_rate_limiter.check_ip(client_ip)
    if ip_locked:
        logger.warning(f"Login blocked - IP locked out: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak percobaan login. Coba lagi dalam {ip_remaining // 60} menit {ip_remaining % 60} detik."
        )
    
    # Check if username is locked out
    username_locked, username_remaining = login_rate_limiter.check_username(username)
    if username_locked:
        logger.warning(f"Login blocked - Username locked out: {username}")
        raise HTTPException(
            status_code=429,
            detail=f"Akun terkunci sementara karena terlalu banyak percobaan login. Coba lagi dalam {username_remaining // 60} menit {username_remaining % 60} detik."
        )
    
    try:
        supabase = get_supabase_service_client()
        response = supabase.table("admin_users").select("*").eq("username", username).execute()
        
        if not response.data:
            # Record failed attempt even for non-existent user
            is_locked, remaining = login_rate_limiter.record_failed_attempt(client_ip, username)
            if is_locked:
                raise HTTPException(
                    status_code=429,
                    detail=f"Terlalu banyak percobaan login. Coba lagi dalam {remaining // 60} menit."
                )
            raise HTTPException(status_code=401, detail="Username atau password salah")
        
        user = response.data[0]
        
        # Check status (pending, active, rejected)
        user_status = user.get("status", "active")
        if user_status == "pending":
            raise HTTPException(status_code=403, detail="Akun sedang menunggu verifikasi oleh admin")
        if user_status == "rejected":
            raise HTTPException(status_code=403, detail="Akun ditolak oleh admin")
        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="Akun tidak aktif")
        
        if not verify_password(login_request.password, user["password_hash"]):
            # Record failed attempt
            is_locked, remaining = login_rate_limiter.record_failed_attempt(client_ip, username)
            if is_locked:
                logger.warning(f"Account locked due to failed attempts: {username} from IP: {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Terlalu banyak percobaan login. Akun terkunci sementara. Coba lagi dalam {remaining // 60} menit."
                )
            raise HTTPException(status_code=401, detail="Username atau password salah")
        
        # Success - clear failed attempts
        login_rate_limiter.record_successful_login(client_ip, username)
        
        access_token = create_access_token(data={
            "sub": user["id"],
            "username": user["username"],
            "is_admin": user.get("role") == "admin"
        })
        
        logger.info(f"Successful login - User: {username} from IP: {client_ip}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "nama_lengkap": user.get("nama_lengkap"),
                "role": user.get("role", "user"),
                "must_change_password": user.get("must_change_password", False)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.post("/register")
@limiter.limit(REGISTER_RATE_LIMIT)
async def register(request: Request, reg_request: RegisterRequest):
    """
    Register endpoint with password strength validation.
    
    Password Requirements:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character
    """
    try:
        supabase = get_supabase_service_client()
        
        # Check if username already exists
        existing = supabase.table("admin_users").select("id").eq("username", reg_request.username).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        
        # ENHANCED: Validate password strength with strict rules
        is_valid, errors = validate_password_strength_strict(reg_request.password)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Password tidak memenuhi syarat keamanan: {'; '.join(errors)}"
            )
        
        # Create new user with pending status
        password_hash = hash_password(reg_request.password)
        new_user = {
            "username": reg_request.username,
            "password_hash": password_hash,
            "nama_lengkap": reg_request.nama_lengkap,
            "telegram_id": reg_request.telegram_id,
            "status": "pending",  # Requires admin approval
            "is_active": True,
            "must_change_password": False
        }
        
        response = supabase.table("admin_users").insert(new_user).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Gagal membuat akun")
        
        logger.info(f"New user registered: {reg_request.username}")
        
        return {
            "status": "success",
            "message": "Akun berhasil didaftarkan. Menunggu verifikasi dari admin."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.post("/change-password")
async def change_password(
    request: Request,
    change_req: ChangePasswordRequest,
    current_user = Depends(get_current_user)
):
    """
    Change password endpoint with role-based validation.
    - Admin: Tidak wajib karakter khusus
    - User biasa: Wajib semua syarat keamanan
    """
    try:
        supabase = get_supabase_service_client()
        user_id = current_user.get('sub') or current_user.get('id')
        response = supabase.table("admin_users").select("*").eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
        user = response.data[0]
        user_role = user.get("role", "user")
        is_admin = user_role == "admin"
        
        if not verify_password(change_req.old_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Password lama salah")
        
        # ROLE-BASED: Validate password based on user role
        # Admin can use passwords without special characters
        # Users must use strict password with special characters
        is_valid, errors = validate_password_for_user(change_req.new_password, is_admin=is_admin)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Password baru tidak memenuhi syarat: {'; '.join(errors)}"
            )
        
        # Check if new password is same as old
        if verify_password(change_req.new_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Password baru tidak boleh sama dengan password lama")
        
        new_hash = hash_password(change_req.new_password)
        supabase.table("admin_users").update({
            "password_hash": new_hash,
            "must_change_password": False
        }).eq("id", user_id).execute()
        
        logger.info(f"Password changed for user: {current_user.get('username', 'unknown')} (role: {user_role})")
        
        return {"status": "success", "message": "Password berhasil diubah"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.delete("/account")
async def delete_own_account(current_user = Depends(get_current_user)):
    try:
        supabase = get_supabase_service_client()
        user_id = current_user.get('sub') or current_user.get('id')
        response = supabase.table("admin_users").delete().eq("id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
        
        logger.info(f"Account deleted: {current_user.get('username', 'unknown')}")
        
        return {"status": "success", "message": "Akun berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete account error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.get("/login-status")
async def get_login_status(request: Request):
    """
    Get current login attempt status (for debugging/monitoring).
    Returns remaining lockout time if any.
    """
    client_ip = get_client_ip(request)
    # This is a safe endpoint that only shows if IP is locked, not username
    is_locked, remaining = login_rate_limiter.check_ip(client_ip)
    
    return {
        "ip_locked": is_locked,
        "lockout_remaining_seconds": remaining if is_locked else 0,
        "message": "IP terkunci" if is_locked else "Status normal"
    }
