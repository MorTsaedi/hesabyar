-- Migration 025: Companies schema reconciliation
-- The Rust data layer (db/company.rs) queries these columns on `companies`,
-- but earlier migrations created a narrower table. Add them additively so
-- both fresh databases and existing ones are upgraded in place.

ALTER TABLE companies ADD COLUMN legal_name TEXT;
ALTER TABLE companies ADD COLUMN email TEXT;
ALTER TABLE companies ADD COLUMN website TEXT;
ALTER TABLE companies ADD COLUMN fiscal_year TEXT;
ALTER TABLE companies ADD COLUMN currency TEXT DEFAULT 'IRR';
ALTER TABLE companies ADD COLUMN is_active INTEGER DEFAULT 1;
