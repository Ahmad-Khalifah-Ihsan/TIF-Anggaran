-- Migration: Monthly Summary Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS monthly_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode VARCHAR(50) UNIQUE NOT NULL,
    category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
    tahun INT NOT NULL,
    bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    total_masuk DECIMAL(15,2) DEFAULT 0,
    total_keluar DECIMAL(15,2) DEFAULT 0,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_monthly_summary_tahun_bulan ON monthly_summary(tahun, bulan);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_kode ON monthly_summary(kode);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_category ON monthly_summary(category_id);

-- Constraint unique per category + bulan + tahun (hanya satu data per kategori per bulan)
-- ALTER TABLE monthly_summary ADD CONSTRAINT unique_category_bulan_tahun UNIQUE (category_id, tahun, bulan);
