-- Migration 006: Stock Control (min/max stock levels)
-- Adds reorder point, minimum stock, and maximum stock columns to products table

-- Add stock control columns to products table (idempotent ALTER TABLE)
ALTER TABLE products ADD COLUMN min_stock REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN max_stock REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN reorder_point REAL DEFAULT 0;

-- Index for stock level queries
CREATE INDEX IF NOT EXISTS idx_products_stock_levels ON products(company_id, is_active, min_stock, max_stock);