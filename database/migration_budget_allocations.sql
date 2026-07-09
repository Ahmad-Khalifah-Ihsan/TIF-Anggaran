-- Migration: Budget Allocations Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
    tahun INT NOT NULL,
    bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    jumlah_anggaran DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_category_bulan_tahun UNIQUE (category_id, tahun, bulan)
);

-- Index for query performance
CREATE INDEX IF NOT EXISTS idx_budget_allocations_cat_date ON budget_allocations(category_id, tahun, bulan);
