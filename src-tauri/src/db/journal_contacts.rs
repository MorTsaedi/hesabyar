use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== JOURNAL ENTRIES ====================

    pub fn get_journal_entries(&self, company_id: i64) -> Result<Vec<JournalEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, CAST(fiscal_year_id AS TEXT) AS fiscal_year, entry_number, date, description, reference, created_at
             FROM journal_entries WHERE company_id = ?1 ORDER BY date DESC, entry_number DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(JournalEntry {
                id: row.get(0)?, company_id: row.get(1)?, fiscal_year: row.get(2)?,
                entry_number: row.get(3)?, date: row.get(4)?, description: row.get(5)?,
                reference: row.get(6)?, created_at: row.get(7)?,
                lines: vec![], total_debit: 0.0, total_credit: 0.0,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            let mut entry = row?;
            let mut line_stmt = conn.prepare(
                "SELECT jl.id, jl.entry_id, jl.account_id, a.code, a.name, jl.description, jl.debit, jl.credit
                 FROM journal_lines jl LEFT JOIN accounts a ON jl.account_id = a.id WHERE jl.entry_id = ?1"
            )?;
            let lines = line_stmt.query_map(params![entry.id], |row| {
                Ok(JournalLine {
                    id: row.get(0)?, entry_id: row.get(1)?, account_id: row.get(2)?,
                    account_code: row.get(3)?, account_name: row.get(4)?,
                    description: row.get(5)?, debit: row.get(6)?, credit: row.get(7)?,
                })
            })?.collect::<Result<Vec<_>>>()?;
            entry.lines = lines;
            entry.total_debit = entry.lines.iter().map(|l| l.debit).sum();
            entry.total_credit = entry.lines.iter().map(|l| l.credit).sum();
            result.push(entry);
        }
        Ok(result)
    }

    pub fn get_journal_entry(&self, id: i64) -> Result<JournalEntry> {
        let conn = self.conn.lock().unwrap();
        let mut entry = conn.query_row(
            "SELECT id, company_id, CAST(fiscal_year_id AS TEXT) AS fiscal_year, entry_number, date, description, reference, created_at
             FROM journal_entries WHERE id = ?1",
            params![id],
            |row| Ok(JournalEntry {
                id: row.get(0)?, company_id: row.get(1)?, fiscal_year: row.get(2)?,
                entry_number: row.get(3)?, date: row.get(4)?, description: row.get(5)?,
                reference: row.get(6)?, created_at: row.get(7)?,
                lines: vec![], total_debit: 0.0, total_credit: 0.0,
            })
        )?;
        let mut line_stmt = conn.prepare(
            "SELECT jl.id, jl.entry_id, jl.account_id, a.code, a.name, jl.description, jl.debit, jl.credit
             FROM journal_lines jl LEFT JOIN accounts a ON jl.account_id = a.id WHERE jl.entry_id = ?1"
        )?;
        entry.lines = line_stmt.query_map(params![id], |row| {
            Ok(JournalLine {
                id: row.get(0)?, entry_id: row.get(1)?, account_id: row.get(2)?,
                account_code: row.get(3)?, account_name: row.get(4)?,
                description: row.get(5)?, debit: row.get(6)?, credit: row.get(7)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        entry.total_debit = entry.lines.iter().map(|l| l.debit).sum();
        entry.total_credit = entry.lines.iter().map(|l| l.credit).sum();
        Ok(entry)
    }

    pub fn create_journal_entry(&self, company_id: i64, fiscal_year: i64, date: &str,
        description: &str, reference: Option<&str>, lines: Vec<JournalLineInput>) -> Result<JournalEntry> {
        let conn = self.conn.lock().unwrap();
        let max_entry: i64 = conn.query_row(
            "SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE company_id = ?1",
            params![company_id], |row| row.get(0))?;
        conn.execute(
            "INSERT INTO journal_entries (company_id, fiscal_year_id, entry_number, date, description, reference)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![company_id, fiscal_year, max_entry, date, description, reference],
        )?;
        let entry_id = conn.last_insert_rowid();
        for line in &lines {
            conn.execute(
                "INSERT INTO journal_lines (entry_id, account_id, description, debit, credit) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![entry_id, line.account_id, line.description, line.debit, line.credit],
            )?;
        }
        drop(conn); // release lock — get_journal_entry re-locks
        self.get_journal_entry(entry_id)
    }

    pub fn update_journal_entry(&self, id: i64, date: &str, description: &str,
        reference: Option<&str>, lines: Vec<JournalLineInput>) -> Result<JournalEntry> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE journal_entries SET date=?1, description=?2, reference=?3 WHERE id=?4",
            params![date, description, reference, id],
        )?;
        conn.execute("DELETE FROM journal_lines WHERE entry_id = ?1", params![id])?;
        for line in &lines {
            conn.execute(
                "INSERT INTO journal_lines (entry_id, account_id, description, debit, credit) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, line.account_id, line.description, line.debit, line.credit],
            )?;
        }
        self.get_journal_entry(id)
    }

    pub fn delete_journal_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM journal_lines WHERE entry_id = ?1", params![id])?;
        conn.execute("DELETE FROM journal_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== CONTACTS ====================

    pub fn get_contacts(&self) -> Result<Vec<Contact>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, type, name, phone, email, address, national_id, economic_code, tax_id, notes,
                    payment_term_days, credit_limit, early_payment_discount_pct,
                    early_payment_discount_days, late_payment_penalty_pct, created_at
             FROM contacts ORDER BY name"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Contact {
                id: row.get(0)?, r#type: row.get(1)?, name: row.get(2)?,
                phone: row.get(3)?, email: row.get(4)?, address: row.get(5)?,
                national_id: row.get(6)?, economic_code: row.get(7)?,
                tax_id: row.get(8)?, notes: row.get(9)?,
                payment_term_days: row.get(10)?, credit_limit: row.get(11)?,
                early_payment_discount_pct: row.get(12)?,
                early_payment_discount_days: row.get(13)?,
                late_payment_penalty_pct: row.get(14)?, created_at: row.get(15)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_contact(&self, contact_type: &str, name: &str, phone: Option<&str>,
        email: Option<&str>, address: Option<&str>, tax_id: Option<&str>, notes: Option<&str>,
        payment_term_days: Option<i32>, credit_limit: Option<f64>,
        early_payment_discount_pct: Option<f64>, early_payment_discount_days: Option<i32>,
        late_payment_penalty_pct: Option<f64>) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO contacts (type, name, phone, email, address, tax_id, notes,
             payment_term_days, credit_limit, early_payment_discount_pct,
             early_payment_discount_days, late_payment_penalty_pct)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![contact_type, name, phone, email, address, tax_id, notes,
                    payment_term_days, credit_limit, early_payment_discount_pct,
                    early_payment_discount_days, late_payment_penalty_pct],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_contact(&self, id: i64) -> Result<Contact> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, type, name, phone, email, address, national_id, economic_code, tax_id, notes,
                    payment_term_days, credit_limit, early_payment_discount_pct,
                    early_payment_discount_days, late_payment_penalty_pct, created_at
             FROM contacts WHERE id = ?1",
            params![id],
            |row| Ok(Contact {
                id: row.get(0)?, r#type: row.get(1)?, name: row.get(2)?,
                phone: row.get(3)?, email: row.get(4)?, address: row.get(5)?,
                national_id: row.get(6)?, economic_code: row.get(7)?,
                tax_id: row.get(8)?, notes: row.get(9)?,
                payment_term_days: row.get(10)?, credit_limit: row.get(11)?,
                early_payment_discount_pct: row.get(12)?,
                early_payment_discount_days: row.get(13)?,
                late_payment_penalty_pct: row.get(14)?, created_at: row.get(15)?,
            })
        )
    }

    pub fn update_contact(&self, id: i64, contact_type: &str, name: &str, phone: Option<&str>,
        email: Option<&str>, address: Option<&str>, tax_id: Option<&str>, notes: Option<&str>,
        payment_term_days: Option<i32>, credit_limit: Option<f64>,
        early_payment_discount_pct: Option<f64>, early_payment_discount_days: Option<i32>,
        late_payment_penalty_pct: Option<f64>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE contacts SET type=?1, name=?2, phone=?3, email=?4, address=?5, tax_id=?6,
             notes=?7, payment_term_days=?8, credit_limit=?9, early_payment_discount_pct=?10,
             early_payment_discount_days=?11, late_payment_penalty_pct=?12 WHERE id=?13",
            params![contact_type, name, phone, email, address, tax_id, notes,
                    payment_term_days, credit_limit, early_payment_discount_pct,
                    early_payment_discount_days, late_payment_penalty_pct, id],
        )?;
        Ok(())
    }

    pub fn delete_contact(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM contacts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn search_contacts(&self, query: &str) -> Result<Vec<Contact>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, type, name, phone, email, address, national_id, economic_code, tax_id, notes,
                    payment_term_days, credit_limit, early_payment_discount_pct,
                    early_payment_discount_days, late_payment_penalty_pct, created_at
             FROM contacts WHERE name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1 ORDER BY name"
        )?;
        let rows = stmt.query_map(params![pattern], |row| {
            Ok(Contact {
                id: row.get(0)?, r#type: row.get(1)?, name: row.get(2)?,
                phone: row.get(3)?, email: row.get(4)?, address: row.get(5)?,
                national_id: row.get(6)?, economic_code: row.get(7)?,
                tax_id: row.get(8)?, notes: row.get(9)?,
                payment_term_days: row.get(10)?, credit_limit: row.get(11)?,
                early_payment_discount_pct: row.get(12)?,
                early_payment_discount_days: row.get(13)?,
                late_payment_penalty_pct: row.get(14)?, created_at: row.get(15)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn update_contact_payment_terms(&self, id: i64, payment_term_days: i32, credit_limit: f64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE contacts SET payment_term_days=?1, credit_limit=?2 WHERE id=?3",
            params![payment_term_days, credit_limit, id])?;
        Ok(())
    }

    pub fn update_contact_discounts(&self, id: i64, early_payment_discount_pct: f64,
        early_payment_discount_days: i32, late_payment_penalty_pct: f64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE contacts SET early_payment_discount_pct=?1, early_payment_discount_days=?2,
             late_payment_penalty_pct=?3 WHERE id=?4",
            params![early_payment_discount_pct, early_payment_discount_days, late_payment_penalty_pct, id],
        )?;
        Ok(())
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct JournalLineInput {
    pub account_id: i64,
    pub description: Option<String>,
    pub debit: f64,
    pub credit: f64,
}
