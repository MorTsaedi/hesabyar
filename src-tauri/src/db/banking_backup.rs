use rusqlite::{params, Connection, OptionalExtension, Result};
use super::core::Database;
use super::journal_contacts::JournalLineInput;
use super::structs::*;

impl Database {
    // ==================== BANKING ====================

    pub fn get_bank_accounts(&self, company_id: i64) -> Result<Vec<BankAccount>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT ba.id, ba.company_id, ba.account_id, ba.bank_name, ba.branch,
                    ba.account_number, ba.iban, ba.card_number, ba.currency, ba.is_active, ba.created_at,
                    a.code, a.name
             FROM bank_accounts ba LEFT JOIN accounts a ON ba.account_id = a.id
             WHERE ba.company_id = ?1 ORDER BY ba.bank_name"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(BankAccount {
                id: row.get(0)?, company_id: row.get(1)?, gl_account_id: row.get(2)?,
                bank_name: row.get(3)?, branch: row.get(4)?, account_number: row.get(5)?,
                iban: row.get(6)?, card_number: row.get(7)?, currency: row.get(8)?,
                is_active: row.get::<_, i32>(9)? != 0, created_at: row.get(10)?,
                gl_code: row.get(11)?, gl_name: row.get(12)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn upsert_bank_account(&self, id: Option<i64>, company_id: i64, gl_account_id: i64,
        bank_name: &str, branch: Option<&str>, account_number: Option<&str>,
        iban: Option<&str>, card_number: Option<&str>, currency: Option<&str>) -> Result<BankAccount> {
        let ba_id = {
            let conn = self.conn.lock().unwrap();
            if let Some(bid) = id {
                conn.execute(
                    "UPDATE bank_accounts SET account_id=?1, bank_name=?2, branch=?3,
                     account_number=?4, iban=?5, card_number=?6, currency=?7 WHERE id=?8",
                    params![gl_account_id, bank_name, branch, account_number, iban, card_number, currency, bid],
                )?;
                bid
            } else {
                conn.execute(
                    "INSERT INTO bank_accounts (company_id, account_id, bank_name, branch,
                     account_number, iban, card_number, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![company_id, gl_account_id, bank_name, branch, account_number, iban, card_number, currency],
                )?;
                conn.last_insert_rowid()
            }
        };
        let all = self.get_bank_accounts(company_id)?;
        Ok(all.into_iter().find(|b| b.id == ba_id).unwrap())
    }

    pub fn delete_bank_account(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let account_id: Option<i64> = conn
            .query_row("SELECT account_id FROM bank_accounts WHERE id = ?1", params![id], |r| r.get(0))
            .optional()?;
        if let Some(gid) = account_id {
            let in_use: i64 = conn.query_row(
                "SELECT (SELECT COUNT(*) FROM receipt_vouchers WHERE bank_account_id = ?1) +
                        (SELECT COUNT(*) FROM payment_vouchers WHERE bank_account_id = ?1)",
                params![gid],
                |r| r.get(0),
            )?;
            if in_use > 0 {
                return Err(rusqlite::Error::InvalidParameterName(
                    "بانک دارای سند دریافت/پرداخت فعال است".into(),
                ));
            }
        }
        conn.execute("DELETE FROM bank_accounts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_receipt_vouchers(&self, company_id: i64) -> Result<Vec<ReceiptVoucher>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, bank_account_id, amount, payer, description,
                    receipt_date, reference_number, journal_entry_id, created_at
             FROM receipt_vouchers WHERE company_id = ?1 ORDER BY receipt_date DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(ReceiptVoucher {
                id: row.get(0)?, company_id: row.get(1)?, bank_account_id: row.get(2)?,
                amount: row.get(3)?, payer: row.get(4)?, description: row.get(5)?,
                receipt_date: row.get(6)?, reference_number: row.get(7)?,
                journal_entry_id: row.get(8)?, created_at: row.get(9)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_receipt_voucher(&self, company_id: i64, bank_account_id: i64, amount: f64,
        payer: Option<&str>, description: Option<&str>, receipt_date: &str,
        reference_number: Option<&str>) -> Result<ReceiptVoucher> {
        if amount < 0.0 {
            return Err(rusqlite::Error::InvalidParameterName("negative amount".into()));
        }
        let (id, fiscal_year_id, next_number, credit_account) = {
            let conn = self.conn.lock().unwrap();
            let fiscal_year_id: i64 = conn.query_row(
                "SELECT id FROM fiscal_years WHERE company_id = ?1 ORDER BY id LIMIT 1",
                params![company_id],
                |r| r.get(0),
            ).unwrap_or(0);
            let next_number = format!("REC-{}", conn.query_row::<i64, _, _>(
                "SELECT COALESCE(MAX(id), 0) + 1 FROM receipt_vouchers",
                [], |r| r.get(0),
            ).unwrap_or(1));
            conn.execute(
                "INSERT INTO receipt_vouchers (company_id, fiscal_year_id, number, date, bank_account_id, amount, payer, description, receipt_date, reference_number)
                 VALUES (?1, ?2, ?3, ?8, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![company_id, fiscal_year_id, next_number, bank_account_id, amount, payer, description, receipt_date, reference_number],
            )?;
            let id = conn.last_insert_rowid();
            // Credit side: the contact's linked account, else the default AR account
            let contact_id: Option<i64> = payer.and_then(|p| p.parse::<i64>().ok());
            let credit_account: i64 = if let Some(cid) = contact_id {
                conn.query_row(
                    "SELECT COALESCE(account_id, 0) FROM contacts WHERE id = ?1",
                    params![cid], |r| r.get(0),
                ).unwrap_or(0)
            } else { 0 };
            let credit_account = if credit_account != 0 { credit_account } else {
                conn.query_row(
                    "SELECT id FROM accounts WHERE company_id = ?1 AND (code LIKE '1103%' OR (type='asset' AND name LIKE '%دریافتنی%')) ORDER BY level DESC LIMIT 1",
                    params![company_id], |r| r.get(0),
                ).unwrap_or(0)
            };
            (id, fiscal_year_id, next_number, credit_account)
        };
        let mut journal_entry_id = None;
        if credit_account != 0 {
            let entry = self.create_journal_entry(
                company_id, fiscal_year_id, receipt_date,
                &format!("رسید دریافت {}", next_number),
                reference_number,
                vec![
                    JournalLineInput {
                        account_id: bank_account_id,
                        description: Some(description.unwrap_or("دریافت").to_string()),
                        debit: amount,
                        credit: 0.0,
                    },
                    JournalLineInput {
                        account_id: credit_account,
                        description: Some(description.unwrap_or("دریافت").to_string()),
                        debit: 0.0,
                        credit: amount,
                    },
                ],
            )?;
            journal_entry_id = Some(entry.id);
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "UPDATE receipt_vouchers SET journal_entry_id = ?1 WHERE id = ?2",
                params![entry.id, id],
            )?;
        }
        Ok(ReceiptVoucher {
            id, company_id, bank_account_id, amount,
            payer: payer.map(|s| s.to_string()), description: description.map(|s| s.to_string()),
            receipt_date: receipt_date.to_string(), reference_number: reference_number.map(|s| s.to_string()),
            journal_entry_id, created_at: String::new(),
        })
    }

    pub fn delete_receipt_voucher(&self, id: i64) -> Result<()> {
        let entry_id: Option<i64> = {
            let conn = self.conn.lock().unwrap();
            conn.query_row("SELECT journal_entry_id FROM receipt_vouchers WHERE id = ?1", params![id], |r| r.get(0)).optional()?
        };
        if let Some(eid) = entry_id {
            self.delete_journal_entry(eid)?;
        }
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM receipt_vouchers WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_payment_vouchers(&self, company_id: i64) -> Result<Vec<PaymentVoucher>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, bank_account_id, amount, payee, description,
                    payment_date, reference_number, journal_entry_id, created_at
             FROM payment_vouchers WHERE company_id = ?1 ORDER BY payment_date DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(PaymentVoucher {
                id: row.get(0)?, company_id: row.get(1)?, bank_account_id: row.get(2)?,
                amount: row.get(3)?, payee: row.get(4)?, description: row.get(5)?,
                payment_date: row.get(6)?, reference_number: row.get(7)?,
                journal_entry_id: row.get(8)?, created_at: row.get(9)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_payment_voucher(&self, company_id: i64, bank_account_id: i64, amount: f64,
        payee: Option<&str>, description: Option<&str>, payment_date: &str,
        reference_number: Option<&str>) -> Result<PaymentVoucher> {
        if amount < 0.0 {
            return Err(rusqlite::Error::InvalidParameterName("negative amount".into()));
        }
        let (id, fiscal_year_id, next_number, debit_account) = {
            let conn = self.conn.lock().unwrap();
            let fiscal_year_id: i64 = conn.query_row(
                "SELECT id FROM fiscal_years WHERE company_id = ?1 ORDER BY id LIMIT 1",
                params![company_id],
                |r| r.get(0),
            ).unwrap_or(0);
            let next_number = format!("PAY-{}", conn.query_row::<i64, _, _>(
                "SELECT COALESCE(MAX(id), 0) + 1 FROM payment_vouchers",
                [], |r| r.get(0),
            ).unwrap_or(1));
            conn.execute(
                "INSERT INTO payment_vouchers (company_id, fiscal_year_id, number, date, bank_account_id, amount, payee, description, payment_date, reference_number)
                 VALUES (?1, ?2, ?3, ?8, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![company_id, fiscal_year_id, next_number, bank_account_id, amount, payee, description, payment_date, reference_number],
            )?;
            let id = conn.last_insert_rowid();
            // Debit side: the contact's linked account, else the default expense account
            let contact_id: Option<i64> = payee.and_then(|p| p.parse::<i64>().ok());
            let debit_account: i64 = if let Some(cid) = contact_id {
                conn.query_row(
                    "SELECT COALESCE(account_id, 0) FROM contacts WHERE id = ?1",
                    params![cid], |r| r.get(0),
                ).unwrap_or(0)
            } else { 0 };
            let debit_account = if debit_account != 0 { debit_account } else {
                conn.query_row(
                    "SELECT id FROM accounts WHERE company_id = ?1 AND (code LIKE '5101%' OR (type='expense' AND name LIKE '%هزینه%')) ORDER BY level DESC LIMIT 1",
                    params![company_id], |r| r.get(0),
                ).unwrap_or(0)
            };
            (id, fiscal_year_id, next_number, debit_account)
        };
        let mut journal_entry_id = None;
        if debit_account != 0 {
            let entry = self.create_journal_entry(
                company_id, fiscal_year_id, payment_date,
                &format!("رسید پرداخت {}", next_number),
                reference_number,
                vec![
                    JournalLineInput {
                        account_id: debit_account,
                        description: Some(description.unwrap_or("پرداخت").to_string()),
                        debit: amount,
                        credit: 0.0,
                    },
                    JournalLineInput {
                        account_id: bank_account_id,
                        description: Some(description.unwrap_or("پرداخت").to_string()),
                        debit: 0.0,
                        credit: amount,
                    },
                ],
            )?;
            journal_entry_id = Some(entry.id);
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "UPDATE payment_vouchers SET journal_entry_id = ?1 WHERE id = ?2",
                params![entry.id, id],
            )?;
        }
        Ok(PaymentVoucher {
            id, company_id, bank_account_id, amount,
            payee: payee.map(|s| s.to_string()), description: description.map(|s| s.to_string()),
            payment_date: payment_date.to_string(), reference_number: reference_number.map(|s| s.to_string()),
            journal_entry_id, created_at: String::new(),
        })
    }

    pub fn delete_payment_voucher(&self, id: i64) -> Result<()> {
        let entry_id: Option<i64> = {
            let conn = self.conn.lock().unwrap();
            conn.query_row("SELECT journal_entry_id FROM payment_vouchers WHERE id = ?1", params![id], |r| r.get(0)).optional()?
        };
        if let Some(eid) = entry_id {
            self.delete_journal_entry(eid)?;
        }
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM payment_vouchers WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== OPENING/CLOSING ====================

    pub fn has_opening_entry(&self, company_id: i64, fiscal_year: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM journal_entries WHERE company_id=?1 AND fiscal_year=?2 AND description LIKE '%سند افتتاحیه%'",
            params![company_id, fiscal_year], |row| row.get(0))?;
        Ok(count > 0)
    }

    pub fn has_closing_entry(&self, company_id: i64, fiscal_year: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM journal_entries WHERE company_id=?1 AND fiscal_year=?2 AND description LIKE '%سند اختتامیه%'",
            params![company_id, fiscal_year], |row| row.get(0))?;
        Ok(count > 0)
    }

    pub fn generate_opening_entry(&self, company_id: i64, fiscal_year: &str, date: &str) -> Result<i64> {
        let tb = self.get_trial_balance(company_id, None, None)?;
        let conn = self.conn.lock().unwrap();
        let max_entry: i64 = conn.query_row(
            "SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE company_id=?1",
            params![company_id], |row| row.get(0))?;
        conn.execute(
            "INSERT INTO journal_entries (company_id, fiscal_year, entry_number, date, description)
             VALUES (?1, ?2, ?3, ?4, 'سند افتتاحیه')",
            params![company_id, fiscal_year, max_entry, date],
        )?;
        let entry_id = conn.last_insert_rowid();
        for row in &tb {
            if row.balance != 0.0 {
                if row.balance > 0.0 {
                    conn.execute("INSERT INTO journal_lines (entry_id, account_id, debit) VALUES (?1, ?2, ?3)",
                        params![entry_id, row.id, row.balance])?;
                } else {
                    conn.execute("INSERT INTO journal_lines (entry_id, account_id, credit) VALUES (?1, ?2, ?3)",
                        params![entry_id, row.id, -row.balance])?;
                }
            }
        }
        Ok(entry_id)
    }

    pub fn generate_closing_entry(&self, company_id: i64, fiscal_year: &str, date: &str) -> Result<i64> {
        let tb = self.get_trial_balance(company_id, None, None)?;
        let conn = self.conn.lock().unwrap();
        let max_entry: i64 = conn.query_row(
            "SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries WHERE company_id=?1",
            params![company_id], |row| row.get(0))?;
        conn.execute(
            "INSERT INTO journal_entries (company_id, fiscal_year, entry_number, date, description)
             VALUES (?1, ?2, ?3, ?4, 'سند اختتامیه')",
            params![company_id, fiscal_year, max_entry, date],
        )?;
        let entry_id = conn.last_insert_rowid();
        for row in &tb {
            if row.balance != 0.0 {
                if row.balance > 0.0 {
                    conn.execute("INSERT INTO journal_lines (entry_id, account_id, credit) VALUES (?1, ?2, ?3)",
                        params![entry_id, row.id, row.balance])?;
                } else {
                    conn.execute("INSERT INTO journal_lines (entry_id, account_id, debit) VALUES (?1, ?2, ?3)",
                        params![entry_id, row.id, -row.balance])?;
                }
            }
        }
        Ok(entry_id)
    }

    pub fn get_period_status(&self, company_id: i64, fiscal_year: &str) -> Result<String> {
        let opening = self.has_opening_entry(company_id, fiscal_year)?;
        let closing = self.has_closing_entry(company_id, fiscal_year)?;
        Ok(if closing { "closed".to_string() } else if opening { "open".to_string() } else { "new".to_string() })
    }

    // ==================== OPENING/CLOSING HELPERS ====================

    pub fn create_opening_entry(&self, company_id: i64, fiscal_year: &str, date: &str,
        _income_summary_account_id: i64, _retained_earnings_account_id: i64) -> Result<i64> {
        self.generate_opening_entry(company_id, fiscal_year, date)
    }

    pub fn add_journal_line(&self, entry_id: i64, account_id: i64, debit: f64, credit: f64, description: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entry_id, account_id, debit, credit, description],
        )?;
        Ok(())
    }

    pub fn get_account_balances_for_date(&self, company_id: i64, date: &str) -> Result<Vec<(i64, f64)>> {
        let tb = self.get_trial_balance(company_id, Some(date), Some(date))?;
        Ok(tb.into_iter().map(|r| (r.id, r.balance)).collect())
    }

    pub fn get_revenue_expense_balances(&self, company_id: i64, date: &str) -> Result<(f64, f64)> {
        let conn = self.conn.lock().unwrap();
        let revenue: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0) FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND a.type = 'revenue' AND je.date <= ?2",
            params![company_id, date], |row| row.get(0),
        )?;
        let expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0) FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND a.type = 'expense' AND je.date <= ?2",
            params![company_id, date], |row| row.get(0),
        )?;
        Ok((revenue, expense))
    }

    pub fn get_or_create_income_summary_account(&self, company_id: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let existing: Option<i64> = conn.query_row(
            "SELECT id FROM accounts WHERE company_id = ?1 AND code = '3-9-01'",
            params![company_id], |row| row.get(0),
        ).ok();
        if let Some(id) = existing { return Ok(id); }
        conn.execute(
            "INSERT INTO accounts (company_id, code, name, level, type) VALUES (?1, '3-9-01', 'خلاصه سود و زیان', 2, 'equity')",
            params![company_id],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_total_debits(&self, entry_id: i64) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT COALESCE(SUM(debit), 0) FROM journal_lines WHERE entry_id = ?1",
            params![entry_id], |row| row.get(0))
    }

    pub fn get_total_credits(&self, entry_id: i64) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT COALESCE(SUM(credit), 0) FROM journal_lines WHERE entry_id = ?1",
            params![entry_id], |row| row.get(0))
    }

    // ==================== BACKUP ====================

    pub fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT name, size, created_at FROM backups ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(BackupInfo { name: row.get(0)?, size: row.get(1)?, created_at: row.get(2)? })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_backup(&self, name: Option<String>) -> Result<BackupEntry> {
        let backup_name = name.unwrap_or_else(|| format!("backup_{}", chrono::Local::now().format("%Y%m%d_%H%M%S")));
        let backup_path = format!("backups/{}.db", backup_name);
        std::fs::create_dir_all("backups").ok();
        {
            let mut conn = self.conn.lock().unwrap();
            let mut backup_conn = Connection::open(&backup_path)?;
            let backup = rusqlite::backup::Backup::new(&mut *conn, &mut backup_conn)?;
            backup.run_to_completion(100, std::time::Duration::from_millis(0), None)?;
        }
        let size = std::fs::metadata(&backup_path).map(|m| m.len()).unwrap_or(0);
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT INTO backups (name, size) VALUES (?1, ?2)", params![backup_name, size])?;
        Ok(BackupEntry { name: backup_name, size, created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string() })
    }

    pub fn restore_backup(&self, backup_bytes: Vec<u8>, suggested_name: Option<String>) -> Result<RestoreResult> {
        let name = suggested_name.unwrap_or_else(|| "restored".to_string());
        let path = format!("restored_{}.db", name);
        std::fs::write(&path, &backup_bytes).map_err(|e| {
            rusqlite::Error::InvalidParameterName(format!("Write error: {}", e))
        })?;
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        Ok(RestoreResult { path, size, restored_from: name })
    }

    pub fn delete_backup(&self, name: String) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM backups WHERE name = ?1", params![name])?;
        std::fs::remove_file(format!("backups/{}.db", name)).ok();
        Ok(())
    }
}
