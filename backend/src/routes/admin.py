
"""Admin Routes - Updated with Password Strength Validation and Admin-Only Access """
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from supabase import Client

from .auth import get_current_user, get_supabase_service_client, hash_password, verify_password
from ..security.password_validator import validate_password_strength_strict

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


def require_admin(current_user = Depends(get_current_user)):
    """Dependency to ensure only admins can access certain endpoints"""
    if current_user.get("is_admin") != True:
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak. Hanya admin yang dapat mengakses fitur ini."
        )
    return current_user


class BudgetCategoryUpdate(BaseModel):
    saldo_awal: Optional[float] = None
    nama: Optional[str] = None
    deskripsi: Optional[str] = None
    is_active: Optional[bool] = None


class CreateUserRequest(BaseModel):
    username: str
    password: str
    nama_lengkap: Optional[str] = None
    telegram_id: Optional[str] = None


class UpdateUserStatusRequest(BaseModel):
    status: str  # 'active', 'pending', 'rejected'


class UpdateUserRoleRequest(BaseModel):
    role: str  # 'admin' or 'user'


class ResetPasswordRequest(BaseModel):
    user_id: str
    new_password: str


class ForceChangePasswordRequest(BaseModel):
    """For admin to force change user's password (user must change on next login)"""
    user_id: str
    new_password: str
    force_change_on_login: bool = True


def safe_supabase_call(func, *args, max_retries=3, **kwargs):
    last_error = None
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            if any(x in error_str for x in ['disconnected', 'connection', 'eof', 'protocol', 'ssl']):
                logger.warning(f"Supabase call failed (attempt {attempt+1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    from ..server import recreate_service_client
                    recreate_service_client()
                else:
                    raise
            else:
                raise
    raise last_error


@router.put("/budget-categories/{category_id}")
async def update_budget_category(
    category_id: str,
    data: BudgetCategoryUpdate,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Tidak ada data untuk diupdate")
        
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").update(update_data).eq("id", category_id).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
        
        logger.info(f"Budget category updated: {category_id} by user: {current_user['username']}")
        
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


# User Management Endpoints

@router.get("/users")
async def get_all_users(current_user = Depends(require_admin)):
    """Get all users - admin only"""
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        response = supabase.table("admin_users").select(
            "id, username, nama_lengkap, telegram_id, status, role, is_active, must_change_password, created_at, updated_at"
        ).order("created_at", desc=True).execute()
        
        return {"status": "success", "data": response.data}
    except Exception as e:
        logger.error(f"Get users error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.post("/users")
async def create_user(
    request: CreateUserRequest,
    current_user = Depends(require_admin)
):
    """Create a new user directly (admin only)"""
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if username already exists
        existing = supabase.table("admin_users").select("id").eq("username", request.username).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Username sudah digunakan")
        
        # ENHANCED: Validate password strength with strict rules
        is_valid, errors = validate_password_strength_strict(request.password)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Password tidak memenuhi syarat keamanan: {'; '.join(errors)}"
            )
        
        # Create user directly as active
        password_hash = hash_password(request.password)
        new_user = {
            "username": request.username,
            "password_hash": password_hash,
            "nama_lengkap": request.nama_lengkap,
            "telegram_id": request.telegram_id,
            "status": "active",  # Directly active when admin creates
            "is_active": True,
            "must_change_password": False,
            "created_by": current_user["sub"]
        }
        
        response = supabase.table("admin_users").insert(new_user).execute()
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Gagal membuat akun")
        
        logger.info(f"New user created by admin: {request.username} by user: {current_user['username']}")
        
        return {
            "status": "success",
            "message": "Akun berhasil dibuat",
            "data": {
                "id": response.data[0]["id"],
                "username": response.data[0]["username"],
                "nama_lengkap": response.data[0].get("nama_lengkap")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create user error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    request: UpdateUserStatusRequest,
    current_user = Depends(require_admin)
):
    """Update user status (approve/reject) - admin only"""
    try:
        # Validate status
        if request.status not in ['pending', 'active', 'rejected']:
            raise HTTPException(status_code=400, detail="Status tidak valid")
        
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if user exists
        existing = supabase.table("admin_users").select("id, username").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
        # Prevent self-modification
        if user_id == current_user["sub"]:
            raise HTTPException(status_code=400, detail="Tidak dapat mengubah status akun sendiri")
        
        response = supabase.table("admin_users").update({
            "status": request.status,
            "updated_at": "NOW()"
        }).eq("id", user_id).execute()
        
        logger.info(f"User status updated: {user_id} to {request.status} by user: {current_user['username']}")
        
        return {
            "status": "success",
            "message": f"Status user berhasil diubah ke '{request.status}'"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update user status error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: UpdateUserRoleRequest,
    current_user = Depends(require_admin)  # Only admins can change roles
):
    """
    Update user role (admin <-> user).
    
    Admin can elevate user to admin or demote admin to user.
    Only admins can access this endpoint.
    """
    try:
        # Validate role
        if request.role not in ['admin', 'user']:
            raise HTTPException(status_code=400, detail="Role tidak valid. Gunakan 'admin' atau 'user'")
        
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if user exists
        existing = supabase.table("admin_users").select("id, username, role").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
        user_data = existing.data[0]
        current_role = user_data.get("role", "user")
        
        # Prevent self-modification
        if user_id == current_user.get("sub") or user_id == current_user.get("id"):
            raise HTTPException(status_code=400, detail="Tidak dapat mengubah role akun sendiri")
        
        # If same role, no update needed
        if current_role == request.role:
            return {
                "status": "success",
                "message": f"User sudah memiliki role '{request.role}'"
            }
        
        response = supabase.table("admin_users").update({
            "role": request.role,
            "updated_at": "NOW()"
        }).eq("id", user_id).execute()
        
        action = "dinaikkan menjadi admin" if request.role == "admin" else "diturunkan menjadi user"
        logger.info(f"User role updated: {user_id} from '{current_role}' to '{request.role}' by admin: {current_user.get('username', 'unknown')}")
        
        return {
            "status": "success",
            "message": f"User berhasil {action}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update user role error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.post("/users/reset-password")
async def reset_user_password(
    request: ResetPasswordRequest,
    current_user = Depends(require_admin)
):
    """Admin resets user's password - admin only"""
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if user exists
        existing = supabase.table("admin_users").select("id, username").eq("id", request.user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
        # Prevent self-modification
        if request.user_id == current_user["sub"]:
            raise HTTPException(status_code=400, detail="Tidak dapat mereset password akun sendiri")
        
        # ENHANCED: Validate password strength
        is_valid, errors = validate_password_strength_strict(request.new_password)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Password tidak memenuhi syarat keamanan: {'; '.join(errors)}"
            )
        
        # Hash new password
        new_hash = hash_password(request.new_password)
        
        supabase.table("admin_users").update({
            "password_hash": new_hash,
            "must_change_password": False  # Admin already sets strong password
        }).eq("id", request.user_id).execute()
        
        logger.info(f"Password reset for user: {request.user_id} by admin: {current_user['username']}")
        
        return {"status": "success", "message": "Password berhasil direset"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.post("/users/force-change-password")
async def force_change_password(
    request: ForceChangePasswordRequest,
    current_user = Depends(require_admin)
):
    """Admin forces password change - admin only"""
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if user exists
        existing = supabase.table("admin_users").select("id, username").eq("id", request.user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
        # Prevent self-modification
        if request.user_id == current_user["sub"]:
            raise HTTPException(status_code=400, detail="Tidak dapat mengubah password akun sendiri melalui fitur ini")
        
        # ENHANCED: Validate password strength
        is_valid, errors = validate_password_strength_strict(request.new_password)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Password tidak memenuhi syarat keamanan: {'; '.join(errors)}"
            )
        
        # Hash new password
        new_hash = hash_password(request.new_password)
        
        supabase.table("admin_users").update({
            "password_hash": new_hash,
            "must_change_password": request.force_change_on_login  # Force user to change
        }).eq("id", request.user_id).execute()
        
        action = "diubah" if request.force_change_on_login else "direset"
        logger.info(f"Password {action} for user: {request.user_id} by admin: {current_user['username']}")
        
        return {
            "status": "success",
            "message": f"Password berhasil {action}. User {'harus' if request.force_change_on_login else 'tidak'} mengubah password saat login berikutnya."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Force change password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user = Depends(require_admin)
):
    """Delete a user - admin only"""
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if user exists
        existing = supabase.table("admin_users").select("id, username").eq("id", user_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
        # Prevent self-deletion
        if user_id == current_user["sub"]:
            raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
        
        username = existing.data[0]["username"]
        supabase.table("admin_users").delete().eq("id", user_id).execute()
        
        logger.info(f"User deleted: {username} by user: {current_user['username']}")
        
        return {"status": "success", "message": "User berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete user error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


@router.post("/reset-database")
async def reset_database(current_user = Depends(require_admin)):
    """Purge all records, monthly summaries, reset categories balance, and clean up storage. Admin only."""
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # 1. Delete all records from monthly_summary
        safe_supabase_call(
            lambda: supabase.table("monthly_summary").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        )
        
        # 1b. Delete all records from budget_allocations
        safe_supabase_call(
            lambda: supabase.table("budget_allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        )
        
        # 2. Delete all records from budget_records
        safe_supabase_call(
            lambda: supabase.table("budget_records").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        )
        
        # 3. Reset category initial balance (saldo_awal = 0)
        safe_supabase_call(
            lambda: supabase.table("budget_categories").update({"saldo_awal": 0}).neq("id", "00000000-0000-0000-0000-000000000000").execute()
        )
        
        # 4. Attempt to clean up local uploads directory
        try:
            import os
            uploads_dir = "uploads/evidence"
            if os.path.exists(uploads_dir):
                count = 0
                for filename in os.listdir(uploads_dir):
                    file_path = os.path.join(uploads_dir, filename)
                    # Don't delete .gitkeep or directories if any, only transaction files
                    if os.path.isfile(file_path) and not filename.startswith('.'):
                        os.remove(file_path)
                        count += 1
                logger.info(f"Cleaned up {count} files from local uploads directory")
        except Exception as storage_err:
            # We don't want to fail the whole DB reset if local cleanup fails
            logger.warning(f"Failed to clear local uploads directory during reset: {str(storage_err)}")
            
        logger.info(f"Database fully reset by admin: {current_user['username']}")
        
        return {"status": "success", "message": "Seluruh data transaksi dan ringkasan bulanan berhasil dihapus, serta saldo awal kategori telah direset ke 0."}
    except Exception as e:
        logger.error(f"Reset database error: {str(e)}")
        raise HTTPException(status_code=500, detail="Gagal mereset database. Silakan coba lagi.")


@router.get("/security/audit-log")
async def get_audit_log(
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """
    Get recent security-related events (placeholder for future audit logging implementation).
    In production, this should be backed by a proper audit log table.
    """
    # This is a placeholder - in production, you would:
    # 1. Create an audit_logs table in the database
    # 2. Log all significant actions to this table
    # 3. Return paginated results from this endpoint
    
    return {
        "status": "info",
        "message": "Audit logging is configured. Check server logs for detailed activity.",
        "note": "For production, implement a dedicated audit_logs table for comprehensive tracking."
    }
