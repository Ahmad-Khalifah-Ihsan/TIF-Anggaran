# INFRANEXIA BUDGETING - Sistem Biaya Dinas

Sistem pencatatan anggaran biaya dinas dengan fitur:
- Login dengan username & password
- Kelola 7 mata anggaran
- Catat transaksi pemasukan & pengeluaran
- Upload bukti transaksi (evidence)
- Download bukti transaksi sebagai PDF
- Filter transaksi berdasarkan tanggal

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn src.server:app --reload --port 9000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Konfigurasi
Edit file `.env` dengan kredensial Supabase Anda:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`

## Database Schema

Tabel yang diperlukan di Supabase:
- `admin_users` - untuk login admin
- `budget_categories` - kategori anggaran (7 mata anggaran)
- `budget_records` - record transaksi

Lihat folder `database/` untuk schema lengkap.
