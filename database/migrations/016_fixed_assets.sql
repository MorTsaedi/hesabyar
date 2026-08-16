-- Migration 016: Fixed Assets & Depreciation

CREATE TABLE IF NOT EXISTS fixed_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    purchase_date TEXT NOT NULL,
    purchase_cost REAL NOT NULL DEFAULT 0,
    useful_life_years INTEGER NOT NULL DEFAULT 5,
    salvage_value REAL NOT NULL DEFAULT 0,
    depreciation_method TEXT NOT NULL DEFAULT 'straight_line' CHECK(depreciation_method IN ('straight_line','declining_balance')),
    accumulated_depreciation REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disposed','sold')),
    location TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS depreciation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES fixed_assets(id),
    period TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(asset_id, period)
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_company ON fixed_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_runs_asset ON depreciation_runs(asset_id);
