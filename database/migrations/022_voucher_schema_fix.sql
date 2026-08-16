-- Migration 022: Align voucher tables with the DB layer column names.
-- The DB layer (banking_backup.rs) expects payer/payee, receipt_date/payment_date,
-- and reference_number columns. Add them and copy existing values.

ALTER TABLE receipt_vouchers ADD COLUMN payer TEXT;
ALTER TABLE receipt_vouchers ADD COLUMN receipt_date TEXT;
ALTER TABLE receipt_vouchers ADD COLUMN reference_number TEXT;
UPDATE receipt_vouchers SET receipt_date = date WHERE receipt_date IS NULL;
UPDATE receipt_vouchers SET reference_number = reference WHERE reference_number IS NULL;

ALTER TABLE payment_vouchers ADD COLUMN payee TEXT;
ALTER TABLE payment_vouchers ADD COLUMN payment_date TEXT;
ALTER TABLE payment_vouchers ADD COLUMN reference_number TEXT;
UPDATE payment_vouchers SET payment_date = date WHERE payment_date IS NULL;
UPDATE payment_vouchers SET reference_number = reference WHERE reference_number IS NULL;
