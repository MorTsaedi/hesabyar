use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;
use super::journal_contacts::JournalLineInput;

impl Database {
    // ==================== COMPANY ====================

    pub fn get_current_company(&self) -> Result<Company> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, legal_name, national_id, economic_code, registration_number,
                    address, phone, email, website, fiscal_year, currency, created_at
             FROM companies WHERE is_active = 1 LIMIT 1",
            [],
            |row| Ok(Company {
                id: row.get(0)?, name: row.get(1)?, legal_name: row.get(2)?,
                national_id: row.get(3)?, economic_code: row.get(4)?,
                registration_number: row.get(5)?, address: row.get(6)?,
                phone: row.get(7)?, email: row.get(8)?, website: row.get(9)?,
                fiscal_year: row.get(10)?, currency: row.get(11)?, created_at: row.get(12)?,
            })
        )
    }

    pub fn get_company(&self, id: i64) -> Result<Company> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, legal_name, national_id, economic_code, registration_number,
                    address, phone, email, website, fiscal_year, currency, created_at
             FROM companies WHERE id = ?1",
            params![id],
            |row| Ok(Company {
                id: row.get(0)?, name: row.get(1)?, legal_name: row.get(2)?,
                national_id: row.get(3)?, economic_code: row.get(4)?,
                registration_number: row.get(5)?, address: row.get(6)?,
                phone: row.get(7)?, email: row.get(8)?, website: row.get(9)?,
                fiscal_year: row.get(10)?, currency: row.get(11)?, created_at: row.get(12)?,
            })
        )
    }

    pub fn list_companies(&self) -> Result<Vec<Company>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, legal_name, national_id, economic_code, registration_number,
                    address, phone, email, website, fiscal_year, currency, created_at
             FROM companies ORDER BY name"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Company {
                id: row.get(0)?, name: row.get(1)?, legal_name: row.get(2)?,
                national_id: row.get(3)?, economic_code: row.get(4)?,
                registration_number: row.get(5)?, address: row.get(6)?,
                phone: row.get(7)?, email: row.get(8)?, website: row.get(9)?,
                fiscal_year: row.get(10)?, currency: row.get(11)?, created_at: row.get(12)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_company(&self, name: &str, legal_name: Option<&str>, national_id: Option<&str>,
        economic_code: Option<&str>, registration_number: Option<&str>, address: Option<&str>,
        phone: Option<&str>, email: Option<&str>, currency: Option<&str>) -> Result<Company> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO companies (name, legal_name, national_id, economic_code, registration_number,
             address, phone, email, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![name, legal_name, national_id, economic_code, registration_number,
                    address, phone, email, currency],
        )?;
        let id = conn.last_insert_rowid();
        self.get_company(id)
    }

    pub fn update_company(&self, id: i64, name: &str, legal_name: Option<&str>,
        national_id: Option<&str>, economic_code: Option<&str>, registration_number: Option<&str>,
        address: Option<&str>, phone: Option<&str>, email: Option<&str>,
        website: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE companies SET name=?1, legal_name=?2, national_id=?3, economic_code=?4,
             registration_number=?5, address=?6, phone=?7, email=?8, website=?9 WHERE id=?10",
            params![name, legal_name, national_id, economic_code, registration_number,
                    address, phone, email, website, id],
        )?;
        Ok(())
    }

    pub fn switch_company(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE companies SET is_active = 0", [])?;
        conn.execute("UPDATE companies SET is_active = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn set_active_fiscal_year(&self, company_id: i64, year: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE companies SET fiscal_year = ?1 WHERE id = ?2", params![year, company_id])?;
        Ok(())
    }

    pub fn create_fiscal_year(&self, company_id: i64, year: &str) -> Result<FiscalYear> {
        let conn = self.conn.lock().unwrap();
        let start = format!("{}/01/01", year);
        let end = format!("{}/12/29", year);
        conn.execute(
            "INSERT INTO fiscal_years (company_id, name, start_date, end_date) VALUES (?1, ?2, ?3, ?4)",
            params![company_id, year, start, end],
        )?;
        let id = conn.last_insert_rowid();
        Ok(FiscalYear { id, company_id, year: year.to_string(), is_active: true, start_date: start, end_date: end })
    }

    pub fn seed_accounts_for_company(&self, company_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let accounts = vec![
            (company_id, "1", "دارایی‌ها", 1, None, "asset"),
            (company_id, "1-1", "دارایی‌های جاری", 2, Some("asset"), "asset"),
            (company_id, "1-1-01", "صندوق", 3, Some("asset"), "asset"),
            (company_id, "1-1-02", "بانک", 3, Some("asset"), "asset"),
            (company_id, "1-1-03", "حساب‌های دریافتنی", 3, Some("asset"), "asset"),
            (company_id, "2", "بدهی‌ها", 1, None, "liability"),
            (company_id, "2-1", "بدهی‌های جاری", 2, Some("liability"), "liability"),
            (company_id, "2-1-01", "حساب‌های پرداختنی", 3, Some("liability"), "liability"),
            (company_id, "3", "سرمایه", 1, None, "equity"),
            (company_id, "3-1-01", "سرمایه", 3, Some("equity"), "equity"),
            (company_id, "4", "درآمدها", 1, None, "revenue"),
            (company_id, "4-1-01", "فروش کالا", 3, Some("revenue"), "revenue"),
            (company_id, "5", "هزینه‌ها", 1, None, "expense"),
            (company_id, "5-1-01", "هزینه اداری", 3, Some("expense"), "expense"),
        ];
        for (cid, code, name, level, _parent_type, acc_type) in accounts {
            let _parent_id: Option<i64> = None; // Simplified
            conn.execute(
                "INSERT OR IGNORE INTO accounts (company_id, code, name, level, type)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![cid, code, name, level, acc_type],
            )?;
        }
        Ok(())
    }

    // ==================== EXCHANGE RATES ====================

    pub fn set_exchange_rate(&self, from_currency: &str, to_currency: &str, rate: f64, date: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO exchange_rates (from_currency, to_currency, rate, date) VALUES (?1, ?2, ?3, ?4)",
            params![from_currency, to_currency, rate, date],
        )?;
        Ok(())
    }

    pub fn get_exchange_rate(&self, from_currency: &str, to_currency: &str, date: &str) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT rate FROM exchange_rates WHERE from_currency=?1 AND to_currency=?2 AND date=?3 ORDER BY id DESC LIMIT 1",
            params![from_currency, to_currency, date],
            |row| row.get(0),
        )
    }

    pub fn get_exchange_rates(&self, from_currency: &str, to_currency: &str, limit: i64) -> Result<Vec<ExchangeRate>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, from_currency, to_currency, rate, date, created_at
             FROM exchange_rates WHERE from_currency=?1 AND to_currency=?2 ORDER BY date DESC LIMIT ?3"
        )?;
        let rows = stmt.query_map(params![from_currency, to_currency, limit], |row| {
            Ok(ExchangeRate {
                id: row.get(0)?, from_currency: row.get(1)?, to_currency: row.get(2)?,
                rate: row.get(3)?, date: row.get(4)?, created_at: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn get_foreign_currency_accounts(&self, company_id: i64) -> Result<Vec<Account>> {
        let all = self.get_accounts(company_id)?;
        Ok(all.into_iter().filter(|a| a.currency.is_some() && a.currency.as_deref() != Some("IRR")).collect())
    }

    pub fn perform_currency_revaluation(&self, company_id: i64, fiscal_year_id: i64,
        as_of_date: &str, _gain_account_id: i64, _loss_account_id: i64) -> Result<Vec<RevaluationDetail>> {
        let accounts = self.get_foreign_currency_accounts(company_id)?;
        let mut results = Vec::new();
        for acc in accounts {
            if let Some(ref cur) = acc.currency {
                if let Ok(rate) = self.get_exchange_rate(cur, "IRR", as_of_date) {
                    let bal_before = self.get_account_balance_as_of(acc.id, as_of_date)?;
                    // ponytail: convert balance to foreign currency rounded to 2 decimals and back,
                    // simulating re-measurement when original booking rate isn't stored per account.
                    let bal_in_fx = (bal_before / rate * 100.0).round() / 100.0;
                    let bal_after = bal_in_fx * rate;
                    let gain = (bal_after - bal_before).max(0.0);
                    let loss = bal_before - bal_after; // signed — negative means net gain
                    results.push(RevaluationDetail {
                        account_id: acc.id, account_code: acc.code.clone(),
                        account_name: acc.name.clone(), currency: cur.clone(),
                        balance_before: bal_before, exchange_rate: rate,
                        balance_after: bal_after, revaluation_gain: gain, revaluation_loss: loss,
                    });
                }
            }
        }
        // record the revaluation run
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO currency_revaluations (company_id, fiscal_year_id, date) VALUES (?1, ?2, ?3)",
            params![company_id, fiscal_year_id, as_of_date],
        )?;
        Ok(results)
    }

    pub fn get_revaluation_history(&self, company_id: i64) -> Result<Vec<CurrencyRevaluationRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, fiscal_year_id, date, created_at FROM currency_revaluations WHERE company_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(CurrencyRevaluationRow {
                id: row.get(0)?,
                company_id: row.get(1)?,
                fiscal_year_id: row.get(2)?,
                revaluation_date: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    // ==================== RECURRING ====================

    pub fn get_recurring_entries(&self) -> Result<Vec<RecurringEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, name, description, frequency, day_of_month, day_of_week,
                    month, start_date, end_date, next_date, is_active, created_at
             FROM recurring_entries ORDER BY name"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(RecurringEntry {
                id: row.get(0)?, company_id: row.get(1)?, name: row.get(2)?,
                description: row.get(3)?, frequency: row.get(4)?,
                day_of_month: row.get(5)?, day_of_week: row.get(6)?,
                month: row.get(7)?, start_date: row.get(8)?,
                end_date: row.get(9)?, next_date: row.get(10)?,
                is_active: row.get::<_, i32>(11)? != 0,
                created_at: row.get(12)?, lines: vec![], total_debit: 0.0, total_credit: 0.0,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            let mut entry = row?;
            let mut ls = conn.prepare(
                "SELECT rl.id, rl.recurring_id, rl.account_id, a.code, a.name, rl.description, rl.debit, rl.credit
                 FROM recurring_lines rl LEFT JOIN accounts a ON rl.account_id = a.id WHERE rl.recurring_id = ?1"
            )?;
            entry.lines = ls.query_map(params![entry.id], |row| {
                Ok(RecurringLine {
                    id: row.get(0)?, recurring_id: row.get(1)?, account_id: row.get(2)?,
                    account_code: row.get(3)?, account_name: row.get(4)?,
                    description: row.get(5)?, debit: row.get(6)?, credit: row.get(7)?,
                })
            })?.collect::<Result<Vec<_>>>()?;
            entry.total_debit = entry.lines.iter().map(|l| l.debit).sum();
            entry.total_credit = entry.lines.iter().map(|l| l.credit).sum();
            result.push(entry);
        }
        Ok(result)
    }

    pub fn create_recurring_entry(&self, company_id: i64, name: &str, description: Option<&str>,
        frequency: &str, day_of_month: Option<i32>, day_of_week: Option<i32>,
        month: Option<i32>, start_date: &str, end_date: Option<&str>,
        lines: Vec<JournalLineInput>) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO recurring_entries (company_id, name, description, frequency, day_of_month,
             day_of_week, month, start_date, end_date, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)",
            params![company_id, name, description, frequency, day_of_month, day_of_week,
                    month, start_date, end_date],
        )?;
        let id = conn.last_insert_rowid();
        for l in &lines {
            conn.execute(
                "INSERT INTO recurring_lines (recurring_id, account_id, description, debit, credit) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, l.account_id, l.description, l.debit, l.credit],
            )?;
        }
        Ok(id)
    }

    pub fn update_recurring_entry(&self, id: i64, name: &str, description: Option<&str>,
        frequency: &str, day_of_month: Option<i32>, day_of_week: Option<i32>,
        month: Option<i32>, start_date: &str, end_date: Option<&str>,
        is_active: bool, lines: Vec<JournalLineInput>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE recurring_entries SET name=?1, description=?2, frequency=?3, day_of_month=?4,
             day_of_week=?5, month=?6, start_date=?7, end_date=?8, is_active=?9 WHERE id=?10",
            params![name, description, frequency, day_of_month, day_of_week, month, start_date, end_date, is_active, id],
        )?;
        conn.execute("DELETE FROM recurring_lines WHERE recurring_id = ?1", params![id])?;
        for l in &lines {
            conn.execute(
                "INSERT INTO recurring_lines (recurring_id, account_id, description, debit, credit) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, l.account_id, l.description, l.debit, l.credit],
            )?;
        }
        Ok(())
    }

    pub fn delete_recurring_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM recurring_lines WHERE recurring_id = ?1", params![id])?;
        conn.execute("DELETE FROM recurring_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn generate_entries_from_recurring(&self) -> Result<Vec<i64>> {
        Ok(vec![])
    }
}
