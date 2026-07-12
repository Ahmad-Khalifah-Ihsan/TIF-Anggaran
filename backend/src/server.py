"""
Budget API Server - Updated with Enhanced Security Headers
"""
import os
import logging
from dotenv import load_dotenv
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from typing import Callable
from pydantic import BaseModel
from typing import Optional

# Load .env file using relative path to prevent local path dependency in production
from pathlib import Path
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from supabase import create_client, Client
from src.routes.auth import router as auth_router
from src.routes.budget import router as budget_router
from src.routes.admin import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError("Kredensial Supabase harus diset di file .env")

_supabase_client: Client = None
_supabase_service_client: Client = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client


def get_supabase_service_client() -> Client:
    global _supabase_service_client
    if _supabase_service_client is None:
        key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
        _supabase_service_client = create_client(SUPABASE_URL, key)
    return _supabase_service_client


def recreate_service_client() -> Client:
    global _supabase_service_client
    _supabase_service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)
    return _supabase_service_client


# ============== SECURITY HEADERS MIDDLEWARE ==============

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    
    Headers added:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Strict-Transport-Security (HSTS)
    - Content-Security-Policy
    - Referrer-Policy
    - Permissions-Policy
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # HSTS - Only in production or when HTTPS is enforced
        if os.getenv("ENFORCE_HTTPS", "false").lower() == "true":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp
        
        # Permissions Policy (disable unnecessary features)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all incoming requests for security monitoring.
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        
        # Log request
        logger.info(f"Request: {request.method} {request.url.path} from IP: {client_ip}")
        
        # Track in response headers for debugging
        response = await call_next(request)
        response.headers["X-Request-IP"] = client_ip
        
        return response


# ============== APP SETUP ==============

app = FastAPI(title="Budget API", version="1.0.0", description="Secure Budget Management API")

# Add security middleware
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# CORS Configuration - Izinkan semua origin secara dinamis agar aman dan anti-error di serverless
ALLOWED_ORIGINS = []
allow_origin_regex = r"https?://.*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Create uploads directories (wrapped in try-except for read-only serverless filesystems like Vercel)
try:
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    if not os.path.exists("uploads/evidence"):
        os.makedirs("uploads/evidence")
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    app.mount("/api/uploads", StaticFiles(directory="uploads"), name="api_uploads")
except Exception as uploads_err:
    logger.warning(f"Could not initialize local uploads directory: {str(uploads_err)}")

# Include routers
app.include_router(auth_router)
app.include_router(budget_router)
app.include_router(admin_router)


# ============== ROOT & HEALTH ENDPOINTS ==============

@app.get("/")
def read_root():
    return {"status": "Budget API Running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# ============== SECURITY INFO ENDPOINT ==============

@app.get("/security-info")
def security_info():
    """
    Get information about security features enabled on this API.
    No authentication required.
    """
    return {
        "security_features": {
            "jwt_authentication": True,
            "password_hashing": "bcrypt",
            "brute_force_protection": True,
            "rate_limiting": True,
            "security_headers": True,
            "password_requirements": {
                "min_length": 8,
                "require_uppercase": True,
                "require_lowercase": True,
                "require_digit": True,
                "require_special_char": True,
                "no_consecutive_chars": True,
                "no_common_passwords": True
            }
        },
        "rate_limits": {
            "login": "5 attempts per minute per IP",
            "register": "3 attempts per minute per IP",
            "default_api": "60 requests per minute"
        },
        "lockout_duration": "15 minutes after 5 failed attempts"
    }
