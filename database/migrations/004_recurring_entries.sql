-- Migration 004: Recurring Entries
-- Auto-generate journal entries on scheduled intervals

CREATE TABLE IF NOT EXISTS recurring_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  day_of_month INTEGER CHECK(day_of_month BETWEEN 1 AND 31),
  day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
  month INTEGER CHECK(month BETWEEN 1 AND 12),
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated_date TEXT,
  next_generation_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_entries_company ON recurring_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_entries_next_date ON recurring_entries(next_generation_date, is_active);