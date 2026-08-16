-- Migration 005 Inventory Ledger plus Valuation Method
-- Adds the canonical inventory_movements ledger that records every
-- stock movement: purchase in, sale out, manual adjustment.
-- From the ledger we can compute current quantity as
-- SUM(qty_in) minus SUM(qty_out), and the current value using
-- either FIFO or weighted-average cost.
-- Also adds an app_settings.inventory_method column defaulting to
-- weighted-average cost (WAC).
-- IMPORTANT: this migration runner splits SQL by the semicolon
-- character. Inline semicolons inside comment text break the
-- parser, so all comments here use plain punctuation only.

CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    qty_in REAL NOT NULL DEFAULT 0,
    qty_out REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('purchase', 'sale', 'adjustment')),
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    invoice_line_id INTEGER REFERENCES invoice_lines(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
    ON inventory_movements (product_id, date);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_company_date
    ON inventory_movements (company_id, date);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_invoice
    ON inventory_movements (invoice_id);

ALTER TABLE app_settings ADD COLUMN inventory_method TEXT DEFAULT 'wac';

UPDATE app_settings SET inventory_method = 'wac' WHERE inventory_method IS NULL;