-- Migration 021: Bank accounts extras (card number + currency)

ALTER TABLE bank_accounts ADD COLUMN card_number TEXT;
ALTER TABLE bank_accounts ADD COLUMN currency TEXT;
