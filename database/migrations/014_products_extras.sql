-- Migration 014: Extra columns for products (current_stock, status)
-- Bridges the gap between the initial schema and what the code expects.

ALTER TABLE products ADD COLUMN current_stock REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'discontinued'));

-- Copy existing quantity values into current_stock where they differ.
UPDATE products SET current_stock = quantity WHERE current_stock = 0;
