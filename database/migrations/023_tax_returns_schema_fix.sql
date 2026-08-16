-- Migration 023: Align tax_returns schema with the DB layer column names.

ALTER TABLE tax_returns ADD COLUMN period TEXT;
ALTER TABLE tax_returns ADD COLUMN total_sales_vat REAL DEFAULT 0;
ALTER TABLE tax_returns ADD COLUMN total_purchase_vat REAL DEFAULT 0;
ALTER TABLE tax_returns ADD COLUMN net_vat_payable REAL DEFAULT 0;
ALTER TABLE tax_returns ADD COLUMN status TEXT DEFAULT 'draft';
ALTER TABLE tax_returns ADD COLUMN return_date TEXT;

UPDATE tax_returns SET period = period_label WHERE period IS NULL;
UPDATE tax_returns SET total_sales_vat = output_vat WHERE total_sales_vat = 0;
UPDATE tax_returns SET total_purchase_vat = input_vat WHERE total_purchase_vat = 0;
UPDATE tax_returns SET net_vat_payable = payable_vat WHERE net_vat_payable = 0;
UPDATE tax_returns SET status = CASE WHEN is_filed = 1 THEN 'filed' ELSE 'draft' END;
