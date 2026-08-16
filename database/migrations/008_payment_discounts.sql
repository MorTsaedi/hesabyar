-- Migration 008: Early/Late Payment Discounts
-- Adds discount/penalty tracking for early and late payments.

-- Add discount/penalty fields to contacts table
ALTER TABLE contacts ADD COLUMN early_payment_discount_pct REAL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN early_payment_discount_days INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN late_payment_penalty_pct REAL DEFAULT 0;

-- Add discount/penalty fields to invoices table
ALTER TABLE invoices ADD COLUMN discount_date TEXT;
ALTER TABLE invoices ADD COLUMN early_payment_discount_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN late_payment_penalty_amount REAL DEFAULT 0;
