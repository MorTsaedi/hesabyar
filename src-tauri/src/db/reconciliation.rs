use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== BANK STATEMENT ENTRIES ====================

    pub fn get_bank_statement_entries(&self, bank_account_id: i64) -> Result<Vec<BankStatementEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, bank_account_id, statement_date, description, amount, reference,
                    linked_voucher_id, voucher_type, is_reconciled, created_at
             FROM bank_statement_entries
             WHERE bank_account_id = ?1
             ORDER BY statement_date DESC, id DESC"
        )?;
        let rows = stmt.query_map(params![bank_account_id], |row| {
            let linked: Option<i64> = row.get(6)?;
            let vtype: Option<String> = row.get(7)?;
            Ok(BankStatementEntry {
                id: row.get(0)?, bank_account_id: row.get(1)?,
                statement_date: row.get(2)?, description: row.get(3)?,
                amount: row.get(4)?, reference: row.get(5)?,
                linked_voucher_id: linked, voucher_type: vtype,
                is_reconciled: row.get::<_, i64>(8)? != 0,
                created_at: row.get(9)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn add_bank_statement_entry(
        &self,
        bank_account_id: i64,
        statement_date: &str,
        description: &str,
        amount: f64,
        reference: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO bank_statement_entries (bank_account_id, statement_date, description, amount, reference)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![bank_account_id, statement_date, description, amount, reference],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_bank_statement_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM bank_statement_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Link a statement entry to a receipt/payment voucher (mark as matched).
    pub fn reconcile_statement_entry(&self, id: i64, voucher_id: i64, voucher_type: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE bank_statement_entries SET linked_voucher_id = ?1, voucher_type = ?2, is_reconciled = 1
             WHERE id = ?3",
            params![voucher_id, voucher_type, id],
        )?;
        Ok(())
    }

    pub fn unreconcile_statement_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE bank_statement_entries SET linked_voucher_id = NULL, voucher_type = NULL, is_reconciled = 0
             WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn get_reconciliation_summary(&self, bank_account_id: i64) -> Result<ReconciliationSummary> {
        let conn = self.conn.lock().unwrap();
        let bank_label: String = conn.query_row(
            "SELECT ba.bank_name || ' - ' || ba.account_number || ' (' || a.name || ')'
             FROM bank_accounts ba JOIN accounts a ON a.id = ba.account_id
             WHERE ba.id = ?1",
            params![bank_account_id],
            |r| r.get(0),
        ).unwrap_or_else(|_| "حساب بانکی".to_string());

        let statement_entries: i64 = conn.query_row(
            "SELECT COUNT(*) FROM bank_statement_entries WHERE bank_account_id = ?1",
            params![bank_account_id], |r| r.get(0))?;
        let unreconciled_entries: i64 = conn.query_row(
            "SELECT COUNT(*) FROM bank_statement_entries WHERE bank_account_id = ?1 AND is_reconciled = 0",
            params![bank_account_id], |r| r.get(0))?;
        let total_statement_amount: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM bank_statement_entries WHERE bank_account_id = ?1",
            params![bank_account_id], |r| r.get(0))?;
        let unreconciled_amount: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM bank_statement_entries WHERE bank_account_id = ?1 AND is_reconciled = 0",
            params![bank_account_id], |r| r.get(0))?;

        // GL balance: sum of journal lines on the linked GL account
        let gl_balance: f64 = conn.query_row(
            "SELECT COALESCE(SUM(
                CASE WHEN a.type IN ('asset','expense','contra') THEN jl.debit - jl.credit
                     ELSE jl.credit - jl.debit END), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON je.id = jl.entry_id
             JOIN accounts a ON a.id = jl.account_id
             WHERE jl.account_id = (SELECT account_id FROM bank_accounts WHERE id = ?1)",
            params![bank_account_id],
            |r| r.get(0),
        ).unwrap_or(0.0);

        Ok(ReconciliationSummary {
            bank_account_id,
            bank_account_label: bank_label,
            statement_entries,
            unreconciled_entries,
            total_statement_amount,
            unreconciled_amount,
            gl_balance,
            difference: total_statement_amount - gl_balance,
        })
    }

    /// Unmatched vouchers (receipt/payment) available for linking.
    /// Returns (id, number, date, amount, type).
    pub fn get_unmatched_vouchers(
        &self,
        bank_account_id: i64,
    ) -> Result<Vec<(i64, String, String, f64, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT v.id, v.number, v.date, v.amount, v.vtype
             FROM (
                 SELECT id, number, date, amount, bank_account_id, 'receipt' AS vtype FROM receipt_vouchers
                 UNION ALL
                 SELECT id, number, date, amount, bank_account_id, 'payment' FROM payment_vouchers
             ) v
             WHERE v.bank_account_id = ?1
               AND NOT EXISTS (
                   SELECT 1 FROM bank_statement_entries bse
                   WHERE bse.linked_voucher_id = v.id
               )
             ORDER BY v.date DESC"
        )?;
        let rows = stmt.query_map(params![bank_account_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }
}
