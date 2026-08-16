-- Migration 017: Check Management (دسته چک)

CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    type TEXT NOT NULL CHECK(type IN ('received','issued')),
    check_number TEXT NOT NULL,
    serial TEXT,
    bank_name TEXT,
    amount REAL NOT NULL DEFAULT 0,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','passed','returned','cashed','cancelled')),
    contact_id INTEGER REFERENCES contacts(id),
    description TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checks_company ON checks(company_id);
CREATE INDEX IF NOT EXISTS idx_checks_due_date ON checks(due_date);
CREATE INDEX IF NOT EXISTS idx_checks_status ON checks(status);
