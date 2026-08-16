use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

/// Add N days to a Jalali date string (YYYY/MM/DD).
/// Handles month lengths: first 6 months = 31 days, next 5 = 30, last = 29.
fn add_days_jalali(date_str: &str, days: i64) -> String {
    let parts: Vec<&str> = date_str.split('/').collect();
    if parts.len() != 3 {
        return date_str.to_string();
    }
    let year: i64 = parts[0].parse().unwrap_or(1400);
    let month: i64 = parts[1].parse().unwrap_or(1);
    let mut day: i64 = parts[2].parse().unwrap_or(1);
    day += days;
    loop {
        let month_len = if month <= 6 { 31 } else if month <= 11 { 30 } else { 29 };
        if day <= month_len {
            break;
        }
        day -= month_len;
        let (y, m) = if month == 12 {
            (year + 1, 1)
        } else {
            (year, month + 1)
        };
        return add_days_jalali(&format!("{}/{}/{}", y, m, 1), day - 1);
    }
    format!("{:04}/{:02}/{:02}", year, month, day)
}

impl Database {
    // ==================== CHECKS ====================

    pub fn get_checks(&self, company_id: i64) -> Result<Vec<Check>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT c.id, c.company_id, c.type, c.check_number, c.serial, c.bank_name,
                    c.amount, c.issue_date, c.due_date, c.status,
                    c.contact_id, ct.name, c.description, c.notes, c.created_at
             FROM checks c
             LEFT JOIN contacts ct ON ct.id = c.contact_id
             WHERE c.company_id = ?1
             ORDER BY c.due_date DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(Check {
                id: row.get(0)?, company_id: row.get(1)?,
                r#type: row.get(2)?, check_number: row.get(3)?,
                serial: row.get(4)?, bank_name: row.get(5)?,
                amount: row.get(6)?, issue_date: row.get(7)?,
                due_date: row.get(8)?, status: row.get(9)?,
                contact_id: row.get(10)?, contact_name: row.get(11)?,
                description: row.get(12)?, notes: row.get(13)?,
                created_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_check(
        &self,
        company_id: i64,
        r#type: &str,
        check_number: &str,
        serial: Option<&str>,
        bank_name: Option<&str>,
        amount: f64,
        issue_date: &str,
        due_date: &str,
        contact_id: Option<i64>,
        description: Option<&str>,
        notes: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO checks (company_id, type, check_number, serial, bank_name, amount,
             issue_date, due_date, contact_id, description, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![company_id, r#type, check_number, serial, bank_name, amount,
                    issue_date, due_date, contact_id, description, notes],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn log_check_event(&self, company_id: i64, id: i64, action: &str, check_number: &str, detail: &str) {
        let _ = self.log_audit(company_id, action, "check", Some(id), detail, Some(check_number));
    }

    pub fn update_check(
        &self,
        id: i64,
        check_number: &str,
        serial: Option<&str>,
        bank_name: Option<&str>,
        amount: f64,
        issue_date: &str,
        due_date: &str,
        contact_id: Option<i64>,
        description: Option<&str>,
        notes: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE checks SET check_number=?1, serial=?2, bank_name=?3, amount=?4,
             issue_date=?5, due_date=?6, contact_id=?7, description=?8, notes=?9
             WHERE id=?10",
            params![check_number, serial, bank_name, amount,
                    issue_date, due_date, contact_id, description, notes, id],
        )?;
        Ok(())
    }

    pub fn delete_check(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM checks WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_check_status(&self, id: i64, status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE checks SET status = ?1 WHERE id = ?2", params![status, id])?;
        drop(conn);
        self.log_check_event(1, id, "status", "", &format!("وضعیت چک به «{}» تغییر کرد", status));
        Ok(())
    }

    /// Summary counts by status. `today` is the Jalali date string used for due-soon window.
    pub fn get_check_summary(&self, company_id: i64, today: &str) -> Result<CheckSummary> {
        let conn = self.conn.lock().unwrap();
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1", params![company_id], |r| r.get(0))?;
        let pending: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1 AND status = 'pending'",
            params![company_id], |r| r.get(0))?;
        let passed: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1 AND status = 'passed'",
            params![company_id], |r| r.get(0))?;
        let returned: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1 AND status = 'returned'",
            params![company_id], |r| r.get(0))?;
        let cashed: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1 AND status = 'cashed'",
            params![company_id], |r| r.get(0))?;
        let cancelled: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1 AND status = 'cancelled'",
            params![company_id], |r| r.get(0))?;
        let window_end = add_days_jalali(today, 14);
        let due_soon: i64 = conn.query_row(
            "SELECT COUNT(*) FROM checks WHERE company_id = ?1 AND status IN ('pending','passed') AND due_date >= ?2 AND due_date <= ?3",
            params![company_id, today, window_end], |r| r.get(0)).unwrap_or(0);
        let total_amount: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM checks WHERE company_id = ?1",
            params![company_id], |r| r.get(0))?;
        let pending_amount: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM checks WHERE company_id = ?1 AND status IN ('pending','passed')",
            params![company_id], |r| r.get(0))?;
        Ok(CheckSummary {
            total, pending, passed, returned, cashed, cancelled, due_soon,
            total_amount, pending_amount,
        })
    }

    /// Checks due within the next N days (for reminders).
    pub fn get_due_checks(&self, company_id: i64, today: &str) -> Result<Vec<Check>> {
        let window_end = add_days_jalali(today, 14);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT c.id, c.company_id, c.type, c.check_number, c.serial, c.bank_name,
                    c.amount, c.issue_date, c.due_date, c.status,
                    c.contact_id, ct.name, c.description, c.notes, c.created_at
             FROM checks c
             LEFT JOIN contacts ct ON ct.id = c.contact_id
             WHERE c.company_id = ?1 AND c.status IN ('pending','passed')
               AND c.due_date >= ?2 AND c.due_date <= ?3
             ORDER BY c.due_date"
        )?;
        let rows = stmt.query_map(params![company_id, today, window_end], |row| {
            Ok(Check {
                id: row.get(0)?, company_id: row.get(1)?,
                r#type: row.get(2)?, check_number: row.get(3)?,
                serial: row.get(4)?, bank_name: row.get(5)?,
                amount: row.get(6)?, issue_date: row.get(7)?,
                due_date: row.get(8)?, status: row.get(9)?,
                contact_id: row.get(10)?, contact_name: row.get(11)?,
                description: row.get(12)?, notes: row.get(13)?,
                created_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }
}
