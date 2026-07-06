-- SQL untuk menghapus semua data dummy transaksi
-- Jalankan di Supabase SQL Editor

-- Hapus semua transaksi
DELETE FROM budget_records;

-- Reset saldo awal semua kategori ke 0
UPDATE budget_categories SET saldo_awal = 0;

-- Hapus user admin default (opsional)
-- DELETE FROM admin_users WHERE username = 'admin';
