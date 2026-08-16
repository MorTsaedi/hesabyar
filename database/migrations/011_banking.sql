-- Migration 011: Banking — Receipt & Payment Vouchers
-- Adds first-class Receipt Voucher (رسید دریافت) and Payment Voucher
-- (رسید پرداخت) tables that wrap a journal entry to keep the chart of
-- accounts balanced while giving the UI dedicated fields (contact,
-- bank account, method, etc.).

-- ---------------------------------------------------------------------------
-- 1. Bank accounts — links chart-of-accounts rows that act as bank/cash
--    GL accounts with bank-specific metadata (name, account number, bank).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    bank_name TEXT NOT NULL DEFAULT '',
    account_number TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    iban TEXT NOT NULL DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company
    ON bank_accounts(company_id);

-- ---------------------------------------------------------------------------
-- 2. Receipt Vouchers (رسید دریافت)
--    A receipt records money coming IN — typically:
--      Dr  bank_account          (debit = amount)
--      Cr  contact / revenue / other   (credit = amount)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receipt_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    contact_id INTEGER REFERENCES contacts(id),
    bank_account_id INTEGER REFERENCES accounts(id),     -- debit side GL
    amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',         -- 'cash' | 'cheque' | 'card' | 'transfer'
    reference TEXT DEFAULT '',
    description TEXT DEFAULT '',
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, fiscal_year_id, number)
);

CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_date
    ON receipt_vouchers(company_id, date);
CREATE INDEX IF NOT EXISTS idx_receipt_vouchers_contact
    ON receipt_vouchers(contact_id);

-- ---------------------------------------------------------------------------
-- 3. Payment Vouchers (رسید پرداخت)
--    A payment records money going OUT — typically:
--      Dr  contact / expense / other    (debit = amount)
--      Cr  bank_account                (credit = amount)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    contact_id INTEGER REFERENCES contacts(id),
    bank_account_id INTEGER REFERENCES accounts(id),     -- credit side GL
    amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',         -- 'cash' | 'cheque' | 'card' | 'transfer'
    reference TEXT DEFAULT '',
    description TEXT DEFAULT '',
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, fiscal_year_id, number)
);

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_date
    ON payment_vouchers(company_id, date);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_contact
    ON payment_vouchers(contact_id);
