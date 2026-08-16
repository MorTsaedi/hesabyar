-- Migration 003: Contacts, Products and Invoices schema harmonization
-- This migration ensures the contacts and products tables include all columns
-- required by the application (email, tax_id, notes for contacts).

-- Add missing optional columns to existing contacts table.
ALTER TABLE contacts ADD COLUMN email TEXT;
ALTER TABLE contacts ADD COLUMN tax_id TEXT;
ALTER TABLE contacts ADD COLUMN notes TEXT;

-- Add description column to products (referenced by Product struct).
ALTER TABLE products ADD COLUMN description TEXT;

-- Invoices table (production schema with company scoping and status workflow)
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
  type TEXT NOT NULL CHECK(type IN ('sale', 'purchase', 'sale_return', 'purchase_return', 'proforma')),
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'confirmed', 'cancelled')),
  moadian_status TEXT DEFAULT 'not_sent' CHECK(moadian_status IN ('pending', 'sent', 'confirmed', 'failed', 'not_sent')),
  moadian_uid TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, fiscal_year_id, number)
);

-- Invoice lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
