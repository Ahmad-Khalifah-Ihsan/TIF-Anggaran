"""
Budget Routes
"""
import logging
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from supabase import Client

from .auth import get_current_user, get_supabase_service_client
import io
from PIL import Image

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/v1/budget", tags=["Budget"])

# Supabase Storage bucket name
STORAGE_BUCKET = "Database anggaran Infranexia"

def compress_image(image_bytes: bytes, max_size_kb: int = 50) -> bytes:
    try:
        # Open image
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert RGBA/P to RGB (JPEG doesn't support transparency/alpha channel)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # Resize image if it's too large (max width/height 1200px)
        max_dim = 1200
        if img.width > max_dim or img.height > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            
        # Compress dynamically to get as close to target as possible
        quality = 85
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=quality)
        
        # If still larger than target, decrease quality step by step
        while len(output.getvalue()) > max_size_kb * 1024 and quality > 30:
            quality -= 10
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=quality)
            
        return output.getvalue()
    except Exception as e:
        logger.error(f"Image compression failed, uploading original: {str(e)}")
        return image_bytes

# Pydantic models for category CRUD
class CategoryCreate(BaseModel):
    nama: str
    kode: str
    deskripsi: Optional[str] = None
    saldo_awal: float = 0

class CategoryUpdate(BaseModel):
    nama: Optional[str] = None
    kode: Optional[str] = None
    deskripsi: Optional[str] = None
    saldo_awal: Optional[float] = None
    is_active: Optional[bool] = None

# Pydantic models for monthly summary CRUD
class MonthlySummaryCreate(BaseModel):
    kode: str
    category_id: Optional[str] = None
    tahun: int
    bulan: int
    total_masuk: float = 0
    total_keluar: float = 0
    keterangan: Optional[str] = None

class MonthlySummaryUpdate(BaseModel):
    kode: Optional[str] = None
    category_id: Optional[str] = None
    tahun: Optional[int] = None
    bulan: Optional[int] = None
    total_masuk: Optional[float] = None
    total_keluar: Optional[float] = None
    keterangan: Optional[str] = None

class BudgetAllocationCreateOrUpdate(BaseModel):
    category_id: str
    tahun: int
    bulan: int
    jumlah_anggaran: float

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

# ============== CATEGORY CRUD ==============

@router.get("/categories")
@limiter.limit("60/minute")
async def get_budget_categories(
    request: Request,
    bulan: Optional[int] = None,
    tahun: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("*").order("nama").execute()
        )
        
        categories = response.data
        
        if bulan is not None and tahun is not None:
            allocations_res = safe_supabase_call(
                lambda: supabase.table("budget_allocations")
                .select("category_id, jumlah_anggaran")
                .eq("bulan", bulan)
                .eq("tahun", tahun)
                .execute()
            )
            
            allocations_map = {
                item["category_id"]: item["jumlah_anggaran"]
                for item in allocations_res.data
            } if allocations_res.data else {}
            
            for cat in categories:
                cat_id = cat["id"]
                if cat_id in allocations_map:
                    cat["saldo_awal"] = allocations_map[cat_id]
                else:
                    cat["saldo_awal"] = 0.0
                    
        return {"status": "success", "data": categories}
    except Exception as e:
        logger.error(f"Get categories error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.get("/categories/{category_id}")
async def get_budget_category(category_id: str, current_user = Depends(get_current_user)):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("*").eq("id", category_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.post("/categories")
async def create_budget_category(
    request: CategoryCreate,
    bulan: Optional[int] = None,
    tahun: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if kode already exists
        existing = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("id").eq("kode", request.kode).execute()
        )
        if existing.data:
            raise HTTPException(status_code=400, detail="Kode kategori sudah digunakan")
        
        new_category = {
            "nama": request.nama,
            "kode": request.kode,
            "deskripsi": request.deskripsi,
            "saldo_awal": request.saldo_awal,
            "is_active": True
        }
        
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").insert(new_category).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Gagal membuat kategori")
            
        category_data = response.data[0]
        
        # If saldo_awal is set and > 0, auto-create a budget allocation for the specified or current month and year
        if request.saldo_awal and request.saldo_awal > 0:
            target_month = bulan if bulan is not None else datetime.now().month
            target_year = tahun if tahun is not None else datetime.now().year
            
            allocation_payload = {
                "category_id": category_data["id"],
                "tahun": target_year,
                "bulan": target_month,
                "jumlah_anggaran": request.saldo_awal,
                "updated_at": datetime.now().astimezone().isoformat()
            }
            
            safe_supabase_call(
                lambda: supabase.table("budget_allocations").insert(allocation_payload).execute()
            )
        
        return {"status": "success", "data": category_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.put("/categories/{category_id}")
async def update_budget_category(
    category_id: str,
    request: CategoryUpdate,
    bulan: Optional[int] = None,
    tahun: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if category exists
        existing = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("id").eq("id", category_id).execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
        
        # Check if new kode conflicts with another category
        if request.kode:
            conflict = safe_supabase_call(
                lambda: supabase.table("budget_categories").select("id").eq("kode", request.kode).neq("id", category_id).execute()
            )
            if conflict.data:
                raise HTTPException(status_code=400, detail="Kode kategori sudah digunakan")
        
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Tidak ada data untuk diupdate")
        
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").update(update_data).eq("id", category_id).execute()
        )
        
        # If monthly params are passed and saldo_awal is updated, upsert allocation
        if bulan is not None and tahun is not None and request.saldo_awal is not None:
            # Check if allocation already exists
            alloc_check = safe_supabase_call(
                lambda: supabase.table("budget_allocations")
                .select("id")
                .eq("category_id", category_id)
                .eq("bulan", bulan)
                .eq("tahun", tahun)
                .execute()
            )
            
            if alloc_check.data:
                # Update
                safe_supabase_call(
                    lambda: supabase.table("budget_allocations")
                    .update({
                        "jumlah_anggaran": request.saldo_awal,
                        "updated_at": datetime.now().astimezone().isoformat()
                    })
                    .eq("id", alloc_check.data[0]["id"])
                    .execute()
                )
            else:
                # Insert
                safe_supabase_call(
                    lambda: supabase.table("budget_allocations")
                    .insert({
                        "category_id": category_id,
                        "bulan": bulan,
                        "tahun": tahun,
                        "jumlah_anggaran": request.saldo_awal,
                        "updated_at": datetime.now().astimezone().isoformat()
                    })
                    .execute()
                )
        
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.delete("/categories/{category_id}")
async def delete_budget_category(category_id: str, current_user = Depends(get_current_user)):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if category has records
        records = safe_supabase_call(
            lambda: supabase.table("budget_records").select("id").eq("category_id", category_id).limit(1).execute()
        )
        if records.data:
            # Soft delete - just mark as inactive
            safe_supabase_call(
                lambda: supabase.table("budget_categories").update({"is_active": False}).eq("id", category_id).execute()
            )
            return {"status": "success", "message": "Kategori dinonaktifkan (memiliki transaksi)"}
        
        # Hard delete if no records
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").delete().eq("id", category_id).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
        
        return {"status": "success", "message": "Kategori berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.delete("/categories/{category_id}/force-delete")
async def force_delete_budget_category(category_id: str, current_user = Depends(get_current_user)):
    """
    Force delete a category from database permanently
    """
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Get all records for this category to delete their local files before cascade delete
        records_to_delete = safe_supabase_call(
            lambda: supabase.table("budget_records").select("evidence_url").eq("category_id", category_id).execute()
        )
        if records_to_delete.data:
            for rec in records_to_delete.data:
                evidence_url = rec.get("evidence_url")
                if evidence_url and evidence_url.startswith("/api/uploads/"):
                    filename = evidence_url.split("/")[-1]
                    file_path = os.path.join("uploads", "evidence", filename)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                            logger.info(f"Deleted evidence file during force-delete: {file_path}")
                        except Exception as fe:
                            logger.error(f"Failed to delete evidence file {file_path} during force-delete: {str(fe)}")
        
        # Delete the category permanently
        response = safe_supabase_call(
            lambda: supabase.table("budget_categories").delete().eq("id", category_id).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
        
        return {"status": "success", "message": "Kategori berhasil dihapus permanen"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Force delete category error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

# ============== EXISTING ENDPOINTS ==============

@router.get("/summary")
async def get_budget_summary(
    bulan: Optional[int] = None,
    tahun: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        categories = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("*").eq("is_active", True).order("nama").execute()
        )
        
        # Default to current month/year if not provided
        target_month = bulan if bulan is not None else datetime.now().month
        target_year = tahun if tahun is not None else datetime.now().year
        
        import calendar
        start_date = f"{target_year}-{target_month:02d}-01T00:00:00"
        _, last_day = calendar.monthrange(target_year, target_month)
        end_date = f"{target_year}-{target_month:02d}-{last_day:02d}T23:59:59"
            
        summaries = []
        for cat in categories.data:
            # 1. Fetch all allocations for this category to calculate current and prior allocations
            allocations_res = safe_supabase_call(
                lambda: supabase.table("budget_allocations")
                .select("jumlah_anggaran, bulan, tahun")
                .eq("category_id", cat["id"])
                .execute()
            )
            
            curr_alloc = 0.0
            prior_alloc = 0.0
            if allocations_res.data:
                for alloc in allocations_res.data:
                    y = alloc["tahun"]
                    m = alloc["bulan"]
                    val = float(alloc["jumlah_anggaran"])
                    if y == target_year and m == target_month:
                        curr_alloc = val
                    elif y < target_year or (y == target_year and m < target_month):
                        prior_alloc += val
                        
            if curr_alloc == 0.0 and prior_alloc == 0.0:
                # Fallback to default/master category saldo_awal if no allocation exists in history
                curr_alloc = float(cat.get("saldo_awal") or 0.0)
                
            # 2. Prior transactions (before start_date) to calculate cumulative balance carry-over
            prior_records_res = safe_supabase_call(
                lambda: supabase.table("budget_records")
                .select("tipe, jumlah")
                .eq("category_id", cat["id"])
                .lt("created_at", start_date)
                .execute()
            )
            prior_in = sum(float(r["jumlah"]) for r in prior_records_res.data if r["tipe"] == "masuk") if prior_records_res.data else 0.0
            prior_out = sum(float(r["jumlah"]) for r in prior_records_res.data if r["tipe"] == "keluar") if prior_records_res.data else 0.0
            
            # Carry-over sisa balance from prior months
            carry_over = prior_alloc + prior_in - prior_out
            
            # Current Saldo Awal is current month's allocation + carry_over
            saldo_awal = curr_alloc + carry_over
            
            # 3. Current month transactions (start_date <= created_at <= end_date)
            curr_masuk_res = safe_supabase_call(
                lambda: supabase.table("budget_records")
                .select("jumlah")
                .eq("category_id", cat["id"])
                .eq("tipe", "masuk")
                .gte("created_at", start_date)
                .lte("created_at", end_date)
                .execute()
            )
            total_masuk = sum(float(r["jumlah"]) for r in curr_masuk_res.data) if curr_masuk_res.data else 0.0
            
            curr_keluar_res = safe_supabase_call(
                lambda: supabase.table("budget_records")
                .select("jumlah")
                .eq("category_id", cat["id"])
                .eq("tipe", "keluar")
                .gte("created_at", start_date)
                .lte("created_at", end_date)
                .execute()
            )
            total_keluar = sum(float(r["jumlah"]) for r in curr_keluar_res.data) if curr_keluar_res.data else 0.0
            
            summaries.append({
                "category_id": cat["id"],
                "category_nama": cat["nama"],
                "category_kode": cat["kode"],
                "saldo_awal": saldo_awal,
                "total_masuk": total_masuk,
                "total_keluar": total_keluar,
                "saldo": saldo_awal + total_masuk - total_keluar
            })
        
        return {"status": "success", "data": summaries}
    except Exception as e:
        logger.error(f"Get summary error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.get("/records")
async def get_budget_records(
    category_id: Optional[str] = None,
    tipe: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Build query dynamically
        query = supabase.table("budget_records").select("*")
        
        if category_id:
            query = query.eq("category_id", category_id)
        if tipe:
            query = query.eq("tipe", tipe)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
            
        query = query.order("created_at", desc=True)
        
        response = safe_supabase_call(lambda: query.execute())
        records = response.data
        
        return {"status": "success", "data": records}
    except Exception as e:
        logger.error(f"Get records error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.post("/records")
async def create_budget_record(
    category_id: str = Form(...),
    tipe: str = Form(...),
    jumlah: float = Form(...),
    keterangan: Optional[str] = Form(None),
    tanggal: Optional[str] = Form(None),
    jam: Optional[str] = Form(None),
    evidence: Optional[UploadFile] = File(None),
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        if tipe not in ['masuk', 'keluar']:
            raise HTTPException(status_code=400, detail="Tipe harus 'masuk' atau 'keluar'")
        
        category = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("id").eq("id", category_id).eq("is_active", True).execute()
        )
        if not category.data:
            raise HTTPException(status_code=400, detail="Kategori tidak ditemukan")
        
        # Parse tanggal and jam if provided (format: DD/MM/YYYY and HH:MM)
        created_at = None
        if tanggal:
            try:
                parts = tanggal.split('/')
                if len(parts) == 3:
                    day, month, year = parts
                    
                    # Determine hour, minute, second
                    hour, minute, second = 0, 0, 0
                    now = datetime.now().astimezone()
                    
                    if jam:
                        # Support HH:MM or HH.MM formats
                        jam_clean = jam.replace('.', ':')
                        jam_parts = jam_clean.split(':')
                        if len(jam_parts) >= 2:
                            hour = int(jam_parts[0])
                            minute = int(jam_parts[1])
                            if len(jam_parts) == 3:
                                second = int(jam_parts[2])
                        else:
                            raise HTTPException(status_code=400, detail="Format jam harus HH:MM")
                    else:
                        hour = now.hour
                        minute = now.minute
                        second = now.second
                        
                    custom_dt = now.replace(
                        year=int(year), 
                        month=int(month), 
                        day=int(day),
                        hour=hour,
                        minute=minute,
                        second=second,
                        microsecond=0
                    )
                    created_at = custom_dt.isoformat()
                    logger.info(f"Parsed custom datetime: {tanggal} {jam} -> {created_at}")
                else:
                    raise HTTPException(status_code=400, detail="Format tanggal harus DD/MM/YYYY")
            except ValueError:
                raise HTTPException(status_code=400, detail="Format tanggal atau jam tidak valid")
        
        evidence_url = None
        evidence_filename = None
        
        if evidence:
            allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
            if evidence.content_type not in allowed_types:
                raise HTTPException(status_code=400, detail="Tipe file tidak diizinkan")
            
            # Read file content
            content = await evidence.read()
            
            # Compress image to target size (~50KB) and convert to JPG if it's an image
            content_type = evidence.content_type
            ext = evidence.filename.split('.')[-1] if '.' in evidence.filename else 'jpg'
            
            if content_type.startswith('image/'):
                content = compress_image(content, max_size_kb=50)
                
            # Generate unique filename
            filename = f"{uuid.uuid4()}.{ext}"
            
            # Save locally on the VPS disk
            file_path = f"uploads/evidence/{filename}"
            try:
                # Ensure local directory exists
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                # Write files
                with open(file_path, "wb") as f:
                    f.write(content)
                
                # Use relative URL prefix '/api/uploads/evidence/'
                evidence_url = f"/api/uploads/evidence/{filename}"
                evidence_filename = evidence.filename
                logger.info(f"Saved evidence locally: {file_path}")
            except Exception as local_error:
                logger.error(f"Local file write failed: {str(local_error)}")
                raise HTTPException(status_code=500, detail="Gagal menyimpan bukti transaksi di server")
        
        created_by = getattr(current_user, 'username', None) or getattr(current_user, 'sub', 'admin')
        
        payload = {
            "category_id": category_id,
            "tipe": tipe,
            "jumlah": jumlah,
            "keterangan": keterangan,
            "evidence_url": evidence_url,
            "evidence_filename": evidence_filename,
            "created_by": created_by
        }
        
        # Add custom created_at if provided
        if created_at:
            payload["created_at"] = created_at
        
        response = safe_supabase_call(
            lambda: supabase.table("budget_records").insert(payload).execute()
        )
        
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create record error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.delete("/records/{record_id}")
async def delete_budget_record(record_id: str, current_user = Depends(get_current_user)):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        response = safe_supabase_call(
            lambda: supabase.table("budget_records").delete().eq("id", record_id).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Record tidak ditemukan")
        
        # Delete local file if it exists
        deleted_record = response.data[0]
        evidence_url = deleted_record.get("evidence_url")
        if evidence_url and evidence_url.startswith("/api/uploads/"):
            filename = evidence_url.split("/")[-1]
            file_path = os.path.join("uploads", "evidence", filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted evidence file: {file_path}")
                except Exception as fe:
                    logger.error(f"Failed to delete evidence file {file_path}: {str(fe)}")
        
        return {"status": "success", "message": "Record berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete record error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

# ============== MONTHLY SUMMARY CRUD ==============

@router.get("/monthly-summary")
async def get_monthly_summaries(
    tahun: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        query = safe_supabase_call(
            lambda: supabase.table("monthly_summary").select("*").order("tahun", desc=True).order("bulan", desc=True)
        )
        
        response = safe_supabase_call(lambda: query.execute())
        data = response.data
        
        # Filter by tahun if provided
        if tahun:
            data = [d for d in data if d.get("tahun") == tahun]
        
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Get monthly summaries error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.get("/monthly-summary/{summary_id}")
async def get_monthly_summary(summary_id: str, current_user = Depends(get_current_user)):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        response = safe_supabase_call(
            lambda: supabase.table("monthly_summary").select("*").eq("id", summary_id).execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get monthly summary error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.post("/monthly-summary")
async def create_monthly_summary(
    request: MonthlySummaryCreate,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Validate bulan
        if request.bulan < 1 or request.bulan > 12:
            raise HTTPException(status_code=400, detail="Bulan harus antara 1-12")
        
        # Check if kode already exists
        existing = safe_supabase_call(
            lambda: supabase.table("monthly_summary").select("id").eq("kode", request.kode).execute()
        )
        if existing.data:
            raise HTTPException(status_code=400, detail="Kode sudah digunakan")
        
        new_data = {
            "kode": request.kode,
            "category_id": request.category_id,
            "tahun": request.tahun,
            "bulan": request.bulan,
            "total_masuk": request.total_masuk,
            "total_keluar": request.total_keluar,
            "keterangan": request.keterangan
        }
        
        response = safe_supabase_call(
            lambda: supabase.table("monthly_summary").insert(new_data).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=500, detail="Gagal menyimpan data")
        
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create monthly summary error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.put("/monthly-summary/{summary_id}")
async def update_monthly_summary(
    summary_id: str,
    request: MonthlySummaryUpdate,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Check if data exists
        existing = safe_supabase_call(
            lambda: supabase.table("monthly_summary").select("id").eq("id", summary_id).execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        
        # Check if new kode conflicts with another record
        if request.kode:
            conflict = safe_supabase_call(
                lambda: supabase.table("monthly_summary").select("id").eq("kode", request.kode).neq("id", summary_id).execute()
            )
            if conflict.data:
                raise HTTPException(status_code=400, detail="Kode sudah digunakan")
        
        # Validate bulan if provided
        if request.bulan is not None and (request.bulan < 1 or request.bulan > 12):
            raise HTTPException(status_code=400, detail="Bulan harus antara 1-12")
        
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Tidak ada data untuk diupdate")
        
        update_data["updated_at"] = datetime.now().astimezone().isoformat()
        
        response = safe_supabase_call(
            lambda: supabase.table("monthly_summary").update(update_data).eq("id", summary_id).execute()
        )
        
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update monthly summary error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.delete("/monthly-summary/{summary_id}")
async def delete_monthly_summary(summary_id: str, current_user = Depends(get_current_user)):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        response = safe_supabase_call(
            lambda: supabase.table("monthly_summary").delete().eq("id", summary_id).execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        
        return {"status": "success", "message": "Data berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete monthly summary error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.get("/monthly-transactions/{bulan}/{tahun}")
async def get_monthly_transactions(bulan: int, tahun: int, current_user = Depends(get_current_user)):
    """
    Get budget records (transactions) for specific month/year
    """
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Get all records for the month
        response = safe_supabase_call(
            lambda: supabase.table("budget_records").select("*").order("created_at", desc=True).execute()
        )
        
        # Get categories for names
        categories_response = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("id, kode, nama").execute()
        )
        categories = {c["id"]: c for c in categories_response.data}
        
        # Filter by month/year from created_at
        filtered = []
        for r in response.data:
            created = r.get("created_at", "")
            if created.startswith(f"{tahun}-{bulan:02d}"):
                cat = categories.get(r.get("category_id"), {})
                r["category_kode"] = cat.get("kode", "N/A")
                r["category_nama"] = cat.get("nama", "Unknown")
                filtered.append(r)
        
        return {"status": "success", "data": filtered}
    except Exception as e:
        logger.error(f"Get monthly transactions error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.get("/monthly-summary-history/{tahun}")
async def get_monthly_summary_history(tahun: int, current_user = Depends(get_current_user)):
    """
    Get history of monthly summary changes for a specific year
    """
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Get all monthly summaries for the year with updated_at
        response = safe_supabase_call(
            lambda: supabase.table("monthly_summary")
            .select("id, category_id, kode, tahun, bulan, total_masuk, total_keluar, created_at, updated_at")
            .eq("tahun", tahun)
            .order("updated_at", desc=True)
            .execute()
        )
        
        # Get categories for names
        categories_response = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("id, kode, nama").execute()
        )
        categories = {c["id"]: c for c in categories_response.data}
        
        # Group by updated_at to show history entries
        history_entries = {}
        for item in response.data:
            update_time = item.get("updated_at") or item.get("created_at")
            key = update_time[:16] if update_time else "unknown"
            
            cat = categories.get(item.get("category_id"), {})
            
            if key not in history_entries:
                history_entries[key] = {
                    "timestamp": update_time,
                    "categories": []
                }
            
            history_entries[key]["categories"].append({
                "category_id": item.get("category_id"),
                "category_kode": cat.get("kode", "N/A"),
                "category_nama": cat.get("nama", "Unknown"),
                "total_masuk": item.get("total_masuk", 0),
                "total_keluar": item.get("total_keluar", 0),
                "bulan": item.get("bulan")
            })
        
        return {
            "status": "success",
            "data": list(history_entries.values())
        }
    except Exception as e:
        logger.error(f"Get monthly summary history error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")

@router.post("/allocations")
async def upsert_budget_allocation(
    request: BudgetAllocationCreateOrUpdate,
    current_user = Depends(get_current_user)
):
    try:
        supabase: Client = safe_supabase_call(get_supabase_service_client)
        
        # Validate month
        if request.bulan < 1 or request.bulan > 12:
            raise HTTPException(status_code=400, detail="Bulan harus antara 1-12")
            
        # Check if category exists
        cat = safe_supabase_call(
            lambda: supabase.table("budget_categories").select("id").eq("id", request.category_id).execute()
        )
        if not cat.data:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
            
        # Check if it already exists
        existing = safe_supabase_call(
            lambda: supabase.table("budget_allocations")
            .select("id")
            .eq("category_id", request.category_id)
            .eq("tahun", request.tahun)
            .eq("bulan", request.bulan)
            .execute()
        )
        
        payload = {
            "category_id": request.category_id,
            "tahun": request.tahun,
            "bulan": request.bulan,
            "jumlah_anggaran": request.jumlah_anggaran,
            "updated_at": datetime.now().astimezone().isoformat()
        }
        
        if existing.data:
            # Update
            response = safe_supabase_call(
                lambda: supabase.table("budget_allocations")
                .update(payload)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            # Insert
            response = safe_supabase_call(
                lambda: supabase.table("budget_allocations")
                .insert(payload)
                .execute()
            )
            
        if not response.data:
            raise HTTPException(status_code=500, detail="Gagal menyimpan alokasi anggaran")
            
        # Update the master category's saldo_awal in budget_categories to match the monthly allocation
        safe_supabase_call(
            lambda: supabase.table("budget_categories")
            .update({"saldo_awal": request.jumlah_anggaran})
            .eq("id", request.category_id)
            .execute()
        )
            
        return {"status": "success", "data": response.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upsert budget allocation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan server")


