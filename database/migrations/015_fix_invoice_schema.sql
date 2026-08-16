-- Migration 015: Fix invoice schema to match application code expectations
ALTER TABLE invoices ADD COLUMN due_date TEXT;
ALTER TABLE invoices ADD COLUMN notes TEXT;
ALTER TABLE invoice_lines ADD COLUMN discount_pct REAL DEFAULT 0;
ALTER TABLE invoice_lines ADD COLUMN tax_rate REAL DEFAULT 0;
