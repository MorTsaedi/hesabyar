-- Migration 019: Price Lists

CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'sale' CHECK(type IN ('sale','purchase')),
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    price REAL NOT NULL DEFAULT 0,
    UNIQUE(price_list_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_price_lists_company ON price_lists(company_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items(price_list_id);
