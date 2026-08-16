-- Migration 009: Currency Revaluation
-- Adds multi-currency support and exchange rate management for periodic revaluation.

-- Add currency designation to accounts (default IRR = Iranian Rial)
ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'IRR';

-- Exchange rates table (e.g., USD → IRR rate on a given date)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate REAL NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency, date)
);

-- Revaluation run history
CREATE TABLE IF NOT EXISTS currency_revaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
    date TEXT NOT NULL,
    entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for exchange rate lookups by date
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup ON exchange_rates(from_currency, to_currency, date);
