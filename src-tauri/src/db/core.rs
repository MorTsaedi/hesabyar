use rusqlite::{params, Connection, Result};
use std::sync::Mutex;
use std::path::PathBuf;
use super::structs::*;

pub const DB_PATH: &str = "hesabyar.db";

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Database { conn: Mutex::new(conn) };
        db.run_migrations()?;
        Ok(db)
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }

    pub fn directory(&self) -> Option<PathBuf> {
        self.conn.lock().unwrap().path().map(|p| {
            let mut path = PathBuf::from(p);
            path.pop(); // remove db filename, keep directory
            path
        })
    }

    // ==================== DATABASE INFO ====================

    pub fn database_info(&self) -> DatabaseInfo {
        let conn = self.conn.lock().unwrap();
        let path = conn.path().unwrap_or("").to_string();
        let table_count: usize = conn
            .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table'", [], |row| row.get(0))
            .unwrap_or(0);
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        DatabaseInfo { path, size, table_count }
    }

    pub fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"
        )?;

        let migrations: Vec<&str> = vec![
            "001_initial",
            "002_seed_accounts",
            "003_contacts_invoices",
            "004_recurring_entries",
            "005_inventory_ledger",
            "006_stock_control",
            "007_payment_terms",
            "008_payment_discounts",
            "009_currency_revaluation",
            "010_taxes",
            "011_banking",
            "012_budget",
            "013_payroll",
            "014_products_extras",
            "015_fix_invoice_schema",
            "016_fixed_assets",
            "017_checks",
            "018_bank_reconciliation",
            "019_price_lists",
            "020_audit_trail",
            "021_bank_accounts_ext",
            "022_voucher_schema_fix",
            "023_tax_returns_schema_fix",
            "024_backups",
        ];

        for migration in migrations {
            let already_run: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM _migrations WHERE name = ?1",
                    params![migration],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !already_run {
                let sql = match migration {
                    "001_initial" => include_str!("../../../database/migrations/001_initial.sql"),
                    "002_seed_accounts" => include_str!("../../../database/migrations/002_seed_accounts.sql"),
                    "003_contacts_invoices" => include_str!("../../../database/migrations/003_contacts_invoices.sql"),
                    "004_recurring_entries" => include_str!("../../../database/migrations/004_recurring_entries.sql"),
                    "005_inventory_ledger" => include_str!("../../../database/migrations/005_inventory_ledger.sql"),
                    "006_stock_control" => include_str!("../../../database/migrations/006_stock_control.sql"),
                    "007_payment_terms" => include_str!("../../../database/migrations/007_payment_terms.sql"),
                    "008_payment_discounts" => include_str!("../../../database/migrations/008_payment_discounts.sql"),
                    "009_currency_revaluation" => include_str!("../../../database/migrations/009_currency_revaluation.sql"),
                    "010_taxes" => include_str!("../../../database/migrations/010_taxes.sql"),
                    "011_banking" => include_str!("../../../database/migrations/011_banking.sql"),
                    "012_budget" => include_str!("../../../database/migrations/012_budget.sql"),
                    "013_payroll" => include_str!("../../../database/migrations/013_payroll.sql"),
                    "014_products_extras" => include_str!("../../../database/migrations/014_products_extras.sql"),
                    "015_fix_invoice_schema" => include_str!("../../../database/migrations/015_fix_invoice_schema.sql"),
                    "016_fixed_assets" => include_str!("../../../database/migrations/016_fixed_assets.sql"),
                    "017_checks" => include_str!("../../../database/migrations/017_checks.sql"),
                    "018_bank_reconciliation" => include_str!("../../../database/migrations/018_bank_reconciliation.sql"),
                    "019_price_lists" => include_str!("../../../database/migrations/019_price_lists.sql"),
                    "020_audit_trail" => include_str!("../../../database/migrations/020_audit_trail.sql"),
                    "021_bank_accounts_ext" => include_str!("../../../database/migrations/021_bank_accounts_ext.sql"),
                    "022_voucher_schema_fix" => include_str!("../../../database/migrations/022_voucher_schema_fix.sql"),
                    "023_tax_returns_schema_fix" => include_str!("../../../database/migrations/023_tax_returns_schema_fix.sql"),
                    "024_backups" => include_str!("../../../database/migrations/024_backups.sql"),
                    _ => "",
                };

                if !sql.is_empty() {
                    for stmt in sql.split(';') {
                        let trimmed = stmt.trim();
                        if !trimmed.is_empty() {
                            let _ = conn.execute(trimmed, []);
                        }
                    }
                }
                let _ = conn.execute("INSERT INTO _migrations (name) VALUES (?1)", params![migration]);
            }
        }
        Ok(())
    }
}
