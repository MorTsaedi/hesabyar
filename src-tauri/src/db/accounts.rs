use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== ACCOUNTS ====================

    pub fn get_accounts(&self, company_id: i64) -> Result<Vec<Account>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.company_id, a.code, a.name, a.level, a.parent_id, a.type, a.is_active,
                    a.currency, a.description, a.created_at,
                    COALESCE((SELECT SUM(jl.debit) - SUM(jl.credit) FROM journal_lines jl
                     JOIN journal_entries je ON jl.entry_id = je.id
                     WHERE jl.account_id = a.id AND je.company_id = a.company_id), 0) as balance
             FROM accounts a WHERE a.company_id = ?1 ORDER BY a.code"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(Account {
                id: row.get(0)?, company_id: row.get(1)?,
                code: row.get(2)?, name: row.get(3)?,
                level: row.get(4)?, parent_id: row.get(5)?,
                r#type: row.get(6)?, is_active: row.get::<_, i32>(7)? != 0,
                currency: row.get(8)?, description: row.get(9)?,
                created_at: row.get(10)?, balance: row.get(11)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_account(&self, company_id: i64, code: &str, name: &str,
        parent_id: Option<i64>, level: i32, account_type: &str, currency: Option<&str>) -> Result<Account> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO accounts (company_id, code, name, parent_id, level, type, currency)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![company_id, code, name, parent_id, level, account_type, currency],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Account {
            id, company_id, code: code.to_string(), name: name.to_string(),
            level, parent_id, r#type: Some(account_type.to_string()),
            is_active: true, currency: currency.map(|s| s.to_string()),
            description: None, created_at: String::new(), balance: 0.0,
        })
    }

    pub fn update_account(&self, id: i64, code: &str, name: &str,
        is_active: bool, description: Option<&str>, currency: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE accounts SET code=?1, name=?2, is_active=?3, description=?4, currency=?5 WHERE id=?6",
            params![code, name, is_active, description, currency, id],
        )?;
        Ok(())
    }

    pub fn delete_account(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_account_balance(&self, account_id: i64) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        let balance: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0)
             FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id
             WHERE jl.account_id = ?1",
            params![account_id],
            |row| row.get(0),
        )?;
        Ok(balance)
    }

    pub fn get_account_balance_as_of(&self, account_id: i64, as_of_date: &str) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        let balance: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit) - SUM(jl.credit), 0)
             FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id
             WHERE jl.account_id = ?1 AND je.date <= ?2",
            params![account_id, as_of_date],
            |row| row.get(0),
        )?;
        Ok(balance)
    }

    // ==================== TRIAL BALANCE ====================

    pub fn get_trial_balance(&self, company_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<Vec<TrialBalanceRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.code, a.name, a.type,
                    COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.debit ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.credit ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.debit - jl.credit ELSE 0 END), 0)
             FROM accounts a
             LEFT JOIN journal_lines jl ON a.id = jl.account_id
             LEFT JOIN journal_entries je ON jl.entry_id = je.id
             WHERE a.company_id = ?1
             GROUP BY a.id, a.code, a.name, a.type
             ORDER BY a.code"
        )?;
        let rows = stmt.query_map(params![company_id, from_date, to_date], |row| {
            Ok(TrialBalanceRow {
                id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
                r#type: row.get(3)?, total_debit: row.get(4)?,
                total_credit: row.get(5)?, balance: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn get_trial_balance_comparison(&self, company_id: i64,
        from_date: Option<&str>, to_date: Option<&str>,
        prev_from: Option<&str>, prev_to: Option<&str>) -> Result<Vec<TrialBalanceComparisonRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.code, a.name,
                    COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.debit - jl.credit ELSE 0 END), 0) as current_bal,
                    COALESCE(SUM(CASE WHEN (?4 IS NULL OR je.date >= ?4) AND (?5 IS NULL OR je.date <= ?5) THEN jl.debit - jl.credit ELSE 0 END), 0) as previous_bal
             FROM accounts a
             LEFT JOIN journal_lines jl ON a.id = jl.account_id
             LEFT JOIN journal_entries je ON jl.entry_id = je.id
             WHERE a.company_id = ?1 AND a.level >= 3
             GROUP BY a.id, a.code, a.name
             HAVING current_bal != 0 OR previous_bal != 0
             ORDER BY a.code"
        )?;
        let rows = stmt.query_map(params![company_id, from_date, to_date, prev_from, prev_to], |row| {
            let current: f64 = row.get(3)?;
            let previous: f64 = row.get(4)?;
            let variance = current - previous;
            let pct = if previous != 0.0 { (variance / previous) * 100.0 } else if current != 0.0 { 100.0 } else { 0.0 };
            Ok(TrialBalanceComparisonRow {
                account_id: row.get(0)?, account_code: row.get(1)?,
                account_name: row.get(2)?, current_balance: current,
                previous_balance: previous, variance, variance_pct: pct,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    // ==================== GENERAL LEDGER ====================

    pub fn get_general_ledger(&self, account_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<Vec<(JournalEntry, Vec<JournalLine>)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT je.id, je.entry_number, je.date, je.description, je.reference, je.created_at
             FROM journal_entries je
             JOIN journal_lines jl ON jl.entry_id = je.id
             WHERE jl.account_id = ?1
               AND (?2 IS NULL OR je.date >= ?2)
               AND (?3 IS NULL OR je.date <= ?3)
             GROUP BY je.id
             ORDER BY je.date"
        )?;
        let entry_rows = stmt.query_map(params![account_id, from_date, to_date], |row| {
            Ok(JournalEntry {
                id: row.get(0)?, company_id: 1, fiscal_year: String::new(),
                entry_number: row.get(1)?, date: row.get(2)?,
                description: row.get(3)?, reference: row.get(4)?,
                created_at: row.get(5)?, lines: vec![], total_debit: 0.0, total_credit: 0.0,
            })
        })?;
        let mut result = Vec::new();
        for entry in entry_rows {
            let entry = entry?;
            let mut line_stmt = conn.prepare(
                "SELECT jl.id, jl.entry_id, jl.account_id, a.code, a.name, jl.description, jl.debit, jl.credit
                 FROM journal_lines jl
                 LEFT JOIN accounts a ON jl.account_id = a.id
                 WHERE jl.entry_id = ?1"
            )?;
            let lines = line_stmt.query_map(params![entry.id], |row| {
                Ok(JournalLine {
                    id: row.get(0)?, entry_id: row.get(1)?, account_id: row.get(2)?,
                    account_code: row.get(3)?, account_name: row.get(4)?,
                    description: row.get(5)?, debit: row.get(6)?, credit: row.get(7)?,
                })
            })?.collect::<Result<Vec<_>>>()?;
            result.push((entry, lines));
        }
        Ok(result)
    }
}
