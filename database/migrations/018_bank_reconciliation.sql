-- Migration 018: Bank Reconciliation

CREATE TABLE IF NOT EXISTS bank_statement_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    statement_date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reference TEXT,
    linked_voucher_id INTEGER,
    voucher_type TEXT,
    is_reconciled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_statement_entries_bank ON bank_statement_entries(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_statement_entries_reconciled ON bank_statement_entries(is_reconciled);
