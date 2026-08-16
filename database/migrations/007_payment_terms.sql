-- Migration 007: Payment Terms & Due Dates
-- Adds payment term tracking for contacts and due date management for invoices.

-- Add payment term fields to contacts table
ALTER TABLE contacts ADD COLUMN payment_term_days INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN credit_limit REAL DEFAULT 0;

-- Add due_date and paid_amount columns to invoices (idempotent ALTER)
ALTER TABLE invoices ADD COLUMN due_date TEXT;
ALTER TABLE invoices ADD COLUMN paid_amount REAL DEFAULT 0;

-- Create overdue invoices query index
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
