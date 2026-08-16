-- Migration 010: Tax (VAT / مالیات بر ارزش افزوده)
-- Adds VAT registration settings, tax-return tracking, and per-product tax rates.
-- (The `tax` column on invoices already exists from migration 003.)

-- ---------------------------------------------------------------------------
-- 1. Per-product tax rate (each product/service can have its own VAT rate)
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN tax_rate REAL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Track VAT settled against output tax (cash-basis accounting)
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN tax_paid REAL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. Company-wide tax settings (one row: id = 1)
--    Holds VAT registration and default tax rates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    vat_enabled INTEGER DEFAULT 0,            -- is the company VAT-registered?
    vat_number TEXT DEFAULT '',                -- شماره ثبت/شناسه مالیات بر ارزش افزوده
    default_vat_rate REAL DEFAULT 10,          -- default VAT rate (%)
    vat_output_account_id INTEGER REFERENCES accounts(id), -- account for output VAT (liability)
    vat_input_account_id INTEGER REFERENCES accounts(id),  -- account for input VAT (asset)
    withholding_enabled INTEGER DEFAULT 0,     -- enable مالیات علی‌الحساب
    default_withholding_rate REAL DEFAULT 5,   -- default withholding rate (%)
    withholding_account_id INTEGER REFERENCES accounts(id), -- account for withholding payable
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO tax_settings (id, vat_enabled, vat_number, default_vat_rate)
VALUES (1, 0, '', 10);

-- ---------------------------------------------------------------------------
-- 4. Periodic VAT returns (اظهارنامه مالیات بر ارزش افزوده)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,                -- e.g. 'بهار ۱۴۰۴'
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    output_vat REAL DEFAULT 0,                 -- مالیات فروش
    input_vat REAL DEFAULT 0,                  -- مالیات خرید
    payable_vat REAL DEFAULT 0,                -- قابل پرداخت
    paid_amount REAL DEFAULT 0,                -- مبلغ پرداخت‌شده
    payment_date TEXT DEFAULT '',
    due_date TEXT DEFAULT '',                  -- سررسید اظهارنامه
    is_filed INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tax_returns_company_period
    ON tax_returns (company_id, start_date);
