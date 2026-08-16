-- Migration 012: Budget periods and entries

CREATE TABLE IF NOT EXISTS budget_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_period_id INTEGER NOT NULL REFERENCES budget_periods(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    amount REAL NOT NULL DEFAULT 0,
    UNIQUE(budget_period_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_entries_period ON budget_entries(budget_period_id);
CREATE INDEX IF NOT EXISTS idx_budget_entries_account ON budget_entries(account_id);
