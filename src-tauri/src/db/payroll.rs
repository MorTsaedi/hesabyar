use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== PAYROLL EMPLOYEES ====================

    pub fn get_employees(&self, company_id: i64) -> Result<Vec<Employee>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, code, first_name, last_name, national_id, phone, email, address,
                    hire_date, base_salary, daily_wage, insurance_days, status, created_at
             FROM employees WHERE company_id = ?1 ORDER BY code"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(Employee {
                id: row.get(0)?, company_id: row.get(1)?,
                code: row.get(2)?, first_name: row.get(3)?,
                last_name: row.get(4)?, national_id: row.get(5)?,
                phone: row.get(6)?, email: row.get(7)?,
                address: row.get(8)?, hire_date: row.get(9)?,
                base_salary: row.get(10)?, daily_wage: row.get(11)?,
                insurance_days: row.get(12)?, status: row.get(13)?,
                created_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_employee(&self, company_id: i64, code: &str, first_name: &str, last_name: &str,
        national_id: Option<&str>, phone: Option<&str>, email: Option<&str>, address: Option<&str>,
        hire_date: &str, base_salary: f64, daily_wage: f64, insurance_days: i32) -> Result<Employee> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO employees (company_id, code, first_name, last_name, national_id, phone, email, address,
             hire_date, base_salary, daily_wage, insurance_days, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'active')",
            params![company_id, code, first_name, last_name, national_id, phone, email, address,
                    hire_date, base_salary, daily_wage, insurance_days],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Employee {
            id, company_id, code: code.to_string(), first_name: first_name.to_string(),
            last_name: last_name.to_string(), national_id: national_id.map(|s| s.to_string()),
            phone: phone.map(|s| s.to_string()), email: email.map(|s| s.to_string()),
            address: address.map(|s| s.to_string()), hire_date: hire_date.to_string(),
            base_salary, daily_wage, insurance_days, status: "active".to_string(), created_at: String::new(),
        })
    }

    pub fn update_employee(&self, id: i64, code: &str, first_name: &str, last_name: &str,
        national_id: Option<&str>, phone: Option<&str>, email: Option<&str>, address: Option<&str>,
        hire_date: &str, base_salary: f64, daily_wage: f64, insurance_days: i32, status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE employees SET code=?1, first_name=?2, last_name=?3, national_id=?4, phone=?5,
             email=?6, address=?7, hire_date=?8, base_salary=?9, daily_wage=?10, insurance_days=?11, status=?12
             WHERE id=?13",
            params![code, first_name, last_name, national_id, phone, email, address,
                    hire_date, base_salary, daily_wage, insurance_days, status, id],
        )?;
        Ok(())
    }

    pub fn delete_employee(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM employees WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== SALARY TEMPLATES ====================

    pub fn get_salary_templates(&self, company_id: i64) -> Result<Vec<SalaryTemplate>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, name, description, created_at FROM salary_templates WHERE company_id = ?1 ORDER BY name"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(SalaryTemplate {
                id: row.get(0)?, company_id: row.get(1)?,
                name: row.get(2)?, description: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_salary_template(&self, company_id: i64, name: &str, description: Option<&str>) -> Result<SalaryTemplate> {
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT INTO salary_templates (company_id, name, description) VALUES (?1, ?2, ?3)",
            params![company_id, name, description])?;
        let id = conn.last_insert_rowid();
        Ok(SalaryTemplate {
            id, company_id, name: name.to_string(),
            description: description.map(|s| s.to_string()), created_at: String::new(),
        })
    }

    pub fn delete_salary_template(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM salary_template_items WHERE template_id = ?1", params![id])?;
        conn.execute("DELETE FROM salary_templates WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_salary_template_items(&self, template_id: i64) -> Result<Vec<SalaryTemplateItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, template_id, type, name, calculation_type, value, priority, based_on
             FROM salary_template_items WHERE template_id = ?1 ORDER BY priority"
        )?;
        let rows = stmt.query_map(params![template_id], |row| {
            Ok(SalaryTemplateItem {
                id: row.get(0)?, template_id: row.get(1)?,
                r#type: row.get(2)?, name: row.get(3)?,
                calculation_type: row.get(4)?, value: row.get(5)?,
                priority: row.get(6)?, based_on: row.get(7)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn upsert_salary_template_item(&self, template_id: i64, r#type: &str, name: &str,
        calculation_type: &str, value: f64, priority: i32, based_on: &str) -> Result<SalaryTemplateItem> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO salary_template_items (template_id, type, name, calculation_type, value, priority, based_on)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![template_id, r#type, name, calculation_type, value, priority, based_on],
        )?;
        let id = conn.last_insert_rowid();
        Ok(SalaryTemplateItem {
            id, template_id, r#type: r#type.to_string(), name: name.to_string(),
            calculation_type: calculation_type.to_string(), value, priority, based_on: based_on.to_string(),
        })
    }

    pub fn delete_salary_template_item(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM salary_template_items WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== PAYROLL PERIODS ====================

    pub fn get_payroll_periods(&self, company_id: i64) -> Result<Vec<PayrollPeriod>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, name, start_date, end_date, status, created_at
             FROM payroll_periods WHERE company_id = ?1 ORDER BY start_date DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(PayrollPeriod {
                id: row.get(0)?, company_id: row.get(1)?,
                name: row.get(2)?, start_date: row.get(3)?,
                end_date: row.get(4)?, status: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_payroll_period(&self, company_id: i64, name: &str, start_date: &str, end_date: &str) -> Result<PayrollPeriod> {
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT INTO payroll_periods (company_id, name, start_date, end_date, status) VALUES (?1, ?2, ?3, ?4, 'open')",
            params![company_id, name, start_date, end_date])?;
        let id = conn.last_insert_rowid();
        Ok(PayrollPeriod {
            id, company_id, name: name.to_string(),
            start_date: start_date.to_string(), end_date: end_date.to_string(),
            status: "open".to_string(), created_at: String::new(),
        })
    }

    pub fn close_payroll_period(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE payroll_periods SET status = 'closed' WHERE id = ?1 AND status = 'open'", params![id])?;
        Ok(())
    }

    pub fn delete_payroll_period(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM salary_payments WHERE payroll_entry_id IN (SELECT id FROM payroll_entries WHERE period_id = ?1)", params![id])?;
        conn.execute("DELETE FROM payroll_entries WHERE period_id = ?1", params![id])?;
        conn.execute("DELETE FROM payroll_periods WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== PAYROLL ENTRIES ====================

    /// Payroll entries joined with employee + period info for display.
    pub fn get_payroll_entries_view(&self, period_id: i64) -> Result<Vec<PayrollEntryView>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT pe.id, pe.period_id, pp.name, pe.employee_id, e.code, e.first_name || ' ' || e.last_name,
                    pe.template_id, pe.base_salary, pe.daily_wage, pe.working_days,
                    pe.total_allowances, pe.total_deductions,
                    pe.gross_salary, pe.net_salary,
                    pe.employer_insurance, pe.employee_insurance,
                    pe.status, pe.notes, pe.created_at
             FROM payroll_entries pe
             JOIN employees e ON e.id = pe.employee_id
             LEFT JOIN payroll_periods pp ON pp.id = pe.period_id
             WHERE pe.period_id = ?1 ORDER BY e.code"
        )?;
        let rows = stmt.query_map(params![period_id], |row| {
            Ok(PayrollEntryView {
                id: row.get(0)?, period_id: row.get(1)?,
                period_name: row.get(2)?, employee_id: row.get(3)?,
                employee_code: row.get(4)?, employee_name: row.get(5)?,
                template_id: row.get(6)?, base_salary: row.get(7)?,
                daily_wage: row.get(8)?, working_days: row.get(9)?,
                total_allowances: row.get(10)?, total_deductions: row.get(11)?,
                gross_salary: row.get(12)?, net_salary: row.get(13)?,
                employer_insurance: row.get(14)?, employee_insurance: row.get(15)?,
                status: row.get(16)?, notes: row.get(17)?,
                created_at: row.get(18)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    /// Payroll periods with aggregate stats (employee count, gross/net totals).
    pub fn get_payroll_period_summaries(&self, company_id: i64) -> Result<Vec<PayrollPeriodSummary>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT pp.id, pp.company_id, pp.name, pp.start_date, pp.end_date, pp.status, pp.created_at,
                    COUNT(pe.id) AS employee_count,
                    COALESCE(SUM(pe.gross_salary), 0) AS gross_total,
                    COALESCE(SUM(pe.net_salary), 0) AS net_total
             FROM payroll_periods pp
             LEFT JOIN payroll_entries pe ON pe.period_id = pp.id
             WHERE pp.company_id = ?1
             GROUP BY pp.id
             ORDER BY pp.start_date DESC"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(PayrollPeriodSummary {
                id: row.get(0)?, company_id: row.get(1)?,
                name: row.get(2)?, start_date: row.get(3)?,
                end_date: row.get(4)?, status: row.get(5)?,
                created_at: row.get(6)?,
                employee_count: row.get(7)?,
                gross_total: row.get(8)?,
                net_total: row.get(9)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn get_payroll_entries(&self, period_id: i64) -> Result<Vec<PayrollEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT pe.id, pe.period_id, pe.employee_id, pe.template_id,
                    pe.base_salary, pe.daily_wage, pe.working_days,
                    pe.total_allowances, pe.total_deductions,
                    pe.gross_salary, pe.net_salary,
                    pe.employer_insurance, pe.employee_insurance,
                    pe.status, pe.notes, pe.created_at
             FROM payroll_entries pe WHERE pe.period_id = ?1 ORDER BY pe.id"
        )?;
        let rows = stmt.query_map(params![period_id], |row| {
            Ok(PayrollEntry {
                id: row.get(0)?, period_id: row.get(1)?,
                employee_id: row.get(2)?, template_id: row.get(3)?,
                base_salary: row.get(4)?, daily_wage: row.get(5)?,
                working_days: row.get(6)?, total_allowances: row.get(7)?,
                total_deductions: row.get(8)?, gross_salary: row.get(9)?,
                net_salary: row.get(10)?, employer_insurance: row.get(11)?,
                employee_insurance: row.get(12)?, status: row.get(13)?,
                notes: row.get(14)?, created_at: row.get(15)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn calculate_payroll_entry(&self, period_id: i64, employee_id: i64, template_id: Option<i64>,
        working_days: i32, notes: Option<&str>) -> Result<PayrollEntry> {
        let conn = self.conn.lock().unwrap();
        let emp = conn.query_row(
            "SELECT base_salary, daily_wage, insurance_days FROM employees WHERE id = ?1",
            params![employee_id],
            |row| { let base: f64 = row.get(0)?; let daily: f64 = row.get(1)?; let ins_days: i32 = row.get(2)?; Ok((base, daily, ins_days)) }
        )?;

        let base_salary = emp.0;
        let daily_wage = emp.1;
        let base_daily = if working_days > 0 { base_salary * (working_days as f64 / 30.0) } else { base_salary };
        let mut total_allowances = 0.0;
        let mut total_deductions = 0.0;

        if let Some(tid) = template_id {
            let mut stmt = conn.prepare(
                "SELECT type, calculation_type, value, based_on FROM salary_template_items WHERE template_id = ?1 ORDER BY priority"
            )?;
            let items = stmt.query_map(params![tid], |row| {
                let item_type: String = row.get(0)?; let calc_type: String = row.get(1)?;
                let val: f64 = row.get(2)?; let based: String = row.get(3)?;
                Ok((item_type, calc_type, val, based))
            })?;
            for item in items {
                let (item_type, calc_type, value, based_on) = item?;
                let base_amount = match based_on.as_str() { "gross" => base_daily + total_allowances, _ => base_daily };
                let amount = if calc_type == "percentage" { base_amount * value / 100.0 } else { value * (working_days as f64 / 30.0) };
                if item_type == "allowance" { total_allowances += amount; } else { total_deductions += amount; }
            }
        }

        let gross_salary = base_daily + total_allowances;
        let employee_insurance = base_daily * 0.07;
        let employer_insurance = base_daily * 0.23;
        let net_salary = gross_salary - total_deductions - employee_insurance;

        conn.execute(
            "INSERT INTO payroll_entries (period_id, employee_id, template_id, base_salary, daily_wage,
             working_days, total_allowances, total_deductions, gross_salary, net_salary,
             employer_insurance, employee_insurance, status, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'pending', ?13)
             ON CONFLICT(period_id, employee_id) DO UPDATE SET
             template_id=?3, base_salary=?4, daily_wage=?5, working_days=?6,
             total_allowances=?7, total_deductions=?8, gross_salary=?9, net_salary=?10,
             employer_insurance=?11, employee_insurance=?12, notes=?13, status='pending'",
            params![period_id, employee_id, template_id, base_salary, daily_wage,
                    working_days, total_allowances, total_deductions, gross_salary, net_salary,
                    employer_insurance, employee_insurance, notes],
        )?;
        let id = conn.last_insert_rowid();

        Ok(PayrollEntry {
            id, period_id, employee_id, template_id,
            base_salary, daily_wage, working_days,
            total_allowances, total_deductions,
            gross_salary, net_salary,
            employer_insurance, employee_insurance,
            status: "pending".to_string(), notes: notes.map(|s| s.to_string()),
            created_at: String::new(),
        })
    }

    pub fn approve_payroll_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE payroll_entries SET status = 'approved' WHERE id = ?1 AND status = 'pending'", params![id])?;
        Ok(())
    }

    pub fn get_salary_payments(&self, payroll_entry_id: i64) -> Result<Vec<SalaryPayment>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, payroll_entry_id, paid_date, amount, journal_entry_id, method, reference, created_at
             FROM salary_payments WHERE payroll_entry_id = ?1 ORDER BY paid_date"
        )?;
        let rows = stmt.query_map(params![payroll_entry_id], |row| {
            Ok(SalaryPayment {
                id: row.get(0)?, payroll_entry_id: row.get(1)?, paid_date: row.get(2)?,
                amount: row.get(3)?, journal_entry_id: row.get(4)?, method: row.get(5)?,
                reference: row.get(6)?, created_at: row.get(7)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn record_salary_payment(&self, payroll_entry_id: i64, paid_date: &str, amount: f64,
        method: &str, reference: Option<&str>) -> Result<SalaryPayment> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO salary_payments (payroll_entry_id, paid_date, amount, method, reference)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![payroll_entry_id, paid_date, amount, method, reference],
        )?;
        conn.execute("UPDATE payroll_entries SET status = 'paid' WHERE id = ?1", params![payroll_entry_id])?;
        let id = conn.last_insert_rowid();
        Ok(SalaryPayment {
            id, payroll_entry_id, paid_date: paid_date.to_string(), amount,
            journal_entry_id: None, method: method.to_string(),
            reference: reference.map(|s| s.to_string()), created_at: String::new(),
        })
    }
}
