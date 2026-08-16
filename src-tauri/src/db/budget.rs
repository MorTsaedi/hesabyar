use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== BUDGET ====================

    pub fn get_budget_periods(&self) -> Result<Vec<BudgetPeriod>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, name, start_date, end_date, created_at FROM budget_periods ORDER BY start_date DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BudgetPeriod {
                id: row.get(0)?, company_id: row.get(1)?, name: row.get(2)?,
                start_date: row.get(3)?, end_date: row.get(4)?, is_active: true, created_at: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_budget_period(&self, company_id: i64, name: &str, start_date: &str, end_date: &str) -> Result<BudgetPeriod> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO budget_periods (company_id, name, start_date, end_date) VALUES (?1, ?2, ?3, ?4)",
            params![company_id, name, start_date, end_date],
        )?;
        let id = conn.last_insert_rowid();
        Ok(BudgetPeriod {
            id,
            company_id,
            name: name.to_string(),
            start_date: start_date.to_string(),
            end_date: end_date.to_string(),
            is_active: true,
            created_at: String::new(),
        })
    }

    pub fn delete_budget_period(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM budget_entries WHERE period_id = ?1", params![id])?;
        conn.execute("DELETE FROM budget_periods WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_budget_entries(&self, period_id: i64) -> Result<Vec<BudgetEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT be.id, be.period_id, be.account_id, be.amount, a.code, a.name, a.type
             FROM budget_entries be JOIN accounts a ON be.account_id = a.id WHERE be.period_id = ?1"
        )?;
        let rows = stmt.query_map(params![period_id], |row| {
            let pid: i64 = row.get(1)?;
            Ok(BudgetEntry {
                id: row.get(0)?, period_id: pid, budget_period_id: pid, account_id: row.get(2)?,
                amount: row.get(3)?, account_code: row.get(4)?, account_name: row.get(5)?, account_type: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn upsert_budget_entry(&self, period_id: i64, account_id: i64, amount: f64) -> Result<BudgetEntry> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO budget_entries (period_id, account_id, amount) VALUES (?1, ?2, ?3)
             ON CONFLICT(period_id, account_id) DO UPDATE SET amount = ?3",
            params![period_id, account_id, amount],
        )?;

        // Get the account info
        let account = conn.query_row(
            "SELECT code, name, type FROM accounts WHERE id = ?1",
            params![account_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            }
        )?;

        // Check if entry exists
        let id = conn.query_row(
            "SELECT id FROM budget_entries WHERE period_id = ?1 AND account_id = ?2",
            params![period_id, account_id],
            |row| row.get(0)
        ).unwrap_or(0);

        Ok(BudgetEntry {
            id,
            period_id,
            budget_period_id: period_id,
            account_id,
            amount,
            account_code: Some(account.0),
            account_name: Some(account.1),
            account_type: Some(account.2),
        })
    }

    pub fn delete_budget_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM budget_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_budget_vs_actual(&self, budget_period_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<Vec<BudgetVsActualRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.code, a.name, a.type,
                    COALESCE(be.amount, 0) as budget_amount,
                    COALESCE(SUM(jl.debit - jl.credit), 0) as actual_amount
             FROM accounts a
             LEFT JOIN budget_entries be ON be.account_id = a.id AND be.period_id = ?1
             LEFT JOIN journal_lines jl ON jl.account_id = a.id
             LEFT JOIN journal_entries je ON jl.entry_id = je.id AND (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3)
             WHERE a.company_id = 1 AND a.level = 2
             GROUP BY a.id, a.code, a.name, a.type, be.amount
             ORDER BY a.code"
        )?;
        let rows = stmt.query_map(params![budget_period_id, from_date, to_date], |row| {
            let budget: f64 = row.get(4)?;
            let actual: f64 = row.get(5)?;
            Ok(BudgetVsActualRow {
                account_id: row.get(0)?, account_code: row.get(1)?, account_name: row.get(2)?,
                account_type: row.get(3)?, budget_amount: budget, actual_amount: actual,
                variance: actual - budget,
                variance_pct: if budget != 0.0 { (actual - budget) / budget * 100.0 } else { if actual != 0.0 { 100.0 } else { 0.0 } },
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }
}
