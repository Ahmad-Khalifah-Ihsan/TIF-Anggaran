-- Database Schema for SIBIDA Budget System
-- Run this in Supabase SQL Editor

-- Admin Users Table (Updated with role and status)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100),
    telegram_id BIGINT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
    is_active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Categories Table (7 Mata Anggaran)
CREATE TABLE IF NOT EXISTS budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    saldo_awal DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Records Table
CREATE TABLE IF NOT EXISTS budget_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('masuk', 'keluar')),
    jumlah DECIMAL(15,2) NOT NULL,
    keterangan TEXT,
    evidence_url VARCHAR(500),
    evidence_filename VARCHAR(255),
    created_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin user (password: Tifadmin123)
-- Role: admin (can change password without special characters)
-- Status: active (no approval needed)
INSERT INTO admin_users (username, password_hash, nama_lengkap, role, status, is_active) 
VALUES ('admin', '$2b$12$WQ9f92jTOf603y2M3QA7Luk0oMJmqZZAJOgYu7RypzrzeM.SYHbyu', 'Administrator', 'admin', 'active', true)
ON CONFLICT (username) DO NOTHING;

-- Insert 7 Mata Anggaran categories
INSERT INTO budget_categories (kode, nama, deskripsi, saldo_awal) VALUES
('ANG-01', 'BODP Jaringan Kabel Akses Fiber', 'Bangun O拆 PTT Jaringan Kabel Akses Fiber', 0),
('ANG-02', 'O&M of fiber optic and submarine cable', 'Operation & Maintenance fiber optic dan submarine cable', 0),
('ANG-03', 'O&M data communication and multimedia', 'Operation & Maintenance data communication dan multimedia', 0),
('ANG-04', 'BODP Catu Daya', 'Bangun O拆 PTT Catu Daya', 0),
('ANG-05', 'Domestic travelling for O&M', 'Perjalanan Dinas Domestik untuk O&M', 0),
('ANG-06', 'Meeting expenses', 'Biaya Rapat', 0),
('ANG-07', 'Beban KBM', 'Beban Kegiatan Bukti Mulia', 0)
ON CONFLICT (kode) DO NOTHING;

-- SQL untuk update user biasa menjadi admin (jalankan di SQL Editor):
-- UPDATE admin_users SET role = 'admin' WHERE username = 'nama_user';

-- SQL untuk update password admin (jika lupa):
-- UPDATE admin_users SET password_hash = '$2b$12$WQ9f92jTOf603y2M3QA7Luk0oMJmqZZAJOgYu7RypzrzeM.SYHbyu' WHERE username = 'admin';
