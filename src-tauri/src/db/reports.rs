use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== FINANCIAL REPORT ====================

    pub fn get_financial_report(&self, company_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<FinancialReport> {
        let accounts = self.get_accounts(company_id)?;

        let mut revenue_accounts = Vec::new();
        let mut expense_accounts = Vec::new();
        let mut asset_accounts = Vec::new();
        let mut liability_accounts = Vec::new();
        let mut equity_accounts = Vec::new();

        for acc in &accounts {
            let balance = self.get_account_balance_filtered(acc.id, from_date, to_date)?;
            let account = ReportAccount {
                account_id: acc.id, code: acc.code.clone(),
                name: acc.name.clone(), balance,
            };
            match acc.r#type.as_deref() {
                Some("revenue") => revenue_accounts.push(account),
                Some("expense") => expense_accounts.push(account),
                Some("asset") => asset_accounts.push(account),
                Some("liability") => liability_accounts.push(account),
                Some("equity") => equity_accounts.push(account),
                _ => {}
            }
        }

        let total_revenue: f64 = revenue_accounts.iter().map(|a| a.balance).sum();
        let total_expenses: f64 = expense_accounts.iter().map(|a| a.balance).sum();
        let total_current_assets: f64 = asset_accounts.iter().filter(|a| a.code.starts_with("1-1")).map(|a| a.balance).sum();
        let total_non_current_assets: f64 = asset_accounts.iter().filter(|a| !a.code.starts_with("1-1")).map(|a| a.balance).sum();
        let total_assets: f64 = asset_accounts.iter().map(|a| a.balance).sum();
        let total_current_liabilities: f64 = liability_accounts.iter().filter(|a| a.code.starts_with("2-1")).map(|a| a.balance).sum();
        let total_non_current_liabilities: f64 = liability_accounts.iter().filter(|a| !a.code.starts_with("2-1")).map(|a| a.balance).sum();
        let total_liabilities: f64 = liability_accounts.iter().map(|a| a.balance).sum();
        let total_equity: f64 = equity_accounts.iter().map(|a| a.balance).sum::<f64>() + (total_revenue - total_expenses);

        Ok(FinancialReport {
            total_revenue, total_cogs: 0.0,
            gross_profit: total_revenue,
            total_expenses, net_income: total_revenue - total_expenses,
            revenue_accounts, expense_accounts,
            total_current_assets, total_non_current_assets, total_assets,
            total_current_liabilities, total_non_current_liabilities, total_liabilities,
            total_equity, total_liabilities_equity: total_liabilities + total_equity,
            asset_accounts, liability_accounts, equity_accounts,
        })
    }

    fn get_account_balance_filtered(&self, account_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        let balance: f64 = conn.query_row(
            "SELECT COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.debit - jl.credit ELSE 0 END), 0)
             FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id WHERE jl.account_id = ?1",
            params![account_id, from_date, to_date],
            |row| row.get(0),
        )?;
        Ok(balance)
    }

    // ==================== BALANCE SHEET DETAILS ====================

    pub fn get_balance_sheet_details(&self, company_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<BalanceSheetDetails> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.code, a.name, a.level, a.parent_id,
                    COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.debit - jl.credit ELSE 0 END), 0)
             FROM accounts a
             LEFT JOIN journal_lines jl ON a.id = jl.account_id
             LEFT JOIN journal_entries je ON jl.entry_id = je.id
             WHERE a.company_id = ?1 AND a.type IN ('asset', 'liability', 'equity')
             GROUP BY a.id, a.code, a.name, a.level, a.parent_id
             ORDER BY a.code"
        )?;
        let rows = stmt.query_map(params![company_id, from_date, to_date], |row| {
            Ok(BalanceSheetAccount {
                account_id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
                level: row.get(3)?, parent_id: row.get(4)?, balance: row.get(5)?,
                children: vec![],
            })
        })?;
        let mut all: Vec<BalanceSheetAccount> = Vec::new();
        for row in rows { all.push(row?); }

        fn build_children_of(accounts: &[BalanceSheetAccount], parent: Option<i64>) -> Vec<BalanceSheetAccount> {
            accounts.iter().filter(|a| a.parent_id == parent).map(|a| {
                let mut node = a.clone();
                node.children = build_children_of(accounts, Some(a.account_id));
                node
            }).collect()
        }

        let assets = build_children_of(&all, Some(0));
        let liabilities = build_children_of(&all, Some(0));
        let equity = build_children_of(&all, Some(0));

        let total_assets: f64 = all.iter().filter(|a| a.level == 2).map(|a| a.balance).sum();
        let total_liabilities: f64 = all.iter().filter(|a| a.level == 2).map(|a| a.balance).sum();
        let total_equity: f64 = all.iter().filter(|a| a.level == 2).map(|a| a.balance).sum();

        Ok(BalanceSheetDetails {
            assets, liabilities, equity,
            total_assets, total_liabilities, total_equity,
            total_liabilities_equity: total_liabilities + total_equity,
        })
    }

    // ==================== INCOME STATEMENT DETAILS ====================

    pub fn get_income_statement_details(&self, company_id: i64, from_date: Option<&str>, to_date: Option<&str>) -> Result<IncomeStatementDetails> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT a.id, a.code, a.name, a.level, a.parent_id,
                    COALESCE(SUM(CASE WHEN (?2 IS NULL OR je.date >= ?2) AND (?3 IS NULL OR je.date <= ?3) THEN jl.debit - jl.credit ELSE 0 END), 0)
             FROM accounts a
             LEFT JOIN journal_lines jl ON a.id = jl.account_id
             LEFT JOIN journal_entries je ON jl.entry_id = je.id
             WHERE a.company_id = ?1 AND a.type IN ('revenue', 'expense')
             GROUP BY a.id, a.code, a.name, a.level, a.parent_id
             ORDER BY a.code"
        )?;
        let rows = stmt.query_map(params![company_id, from_date, to_date], |row| {
            Ok(IncomeAccount {
                account_id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
                level: row.get(3)?, parent_id: row.get(4)?, balance: row.get(5)?,
                children: vec![],
            })
        })?;
        let mut all: Vec<IncomeAccount> = Vec::new();
        for row in rows { all.push(row?); }

        let revenues: Vec<IncomeAccount> = all.iter().filter(|a| a.level == 2).cloned().collect();
        let expenses: Vec<IncomeAccount> = all.iter().filter(|a| a.level == 2).cloned().collect();
        let total_revenue: f64 = revenues.iter().map(|a| a.balance).sum();
        let total_expenses: f64 = expenses.iter().map(|a| a.balance).sum();

        Ok(IncomeStatementDetails {
            revenues, expenses,
            total_revenue, total_expenses,
            net_income: total_revenue - total_expenses,
        })
    }

    // ==================== CASH FLOW ====================

    pub fn get_cash_flow_statement(&self, company_id: i64, from_date: &str, to_date: &str) -> Result<CashFlowReport> {
        let conn = self.conn.lock().unwrap();

        // ---- income & expenses ----
        let net_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN jl.credit - jl.debit
                                      WHEN a.type = 'expense' THEN jl.credit - jl.debit ELSE 0 END), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        // ---- depreciation add-back (contra accounts with code LIKE '1208%') ----
        let depreciation: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3
               AND a.code LIKE '1208%'",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        // ---- working capital deltas ----
        let wc_ar: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3
               AND a.code LIKE '1103%'",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        let wc_inv: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3
               AND a.code LIKE '1106%'",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        let wc_ap: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3
               AND a.code LIKE '2101%'",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        // ---- investing: non-current assets (codes starting with 12) ----
        let investing_total: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3
               AND a.code >= '12' AND a.code < '13' AND a.type != 'contra'",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        // ---- financing: equity and long-term liabilities ----
        let financing_total: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3
               AND (a.code >= '31' AND a.code < '32'
                    OR a.code >= '22' AND a.code < '23')",
            params![company_id, from_date, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        // ---- opening / closing cash (codes 1101, 1102) ----
        let opening: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date < ?2
               AND (a.code = '1101' OR a.code = '1102')",
            params![company_id, from_date], |row| row.get(0),
        ).unwrap_or(0.0);

        let closing: f64 = conn.query_row(
            "SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
             FROM journal_lines jl
             JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date <= ?2
               AND (a.code = '1101' OR a.code = '1102')",
            params![company_id, to_date], |row| row.get(0),
        ).unwrap_or(0.0);

        let net_change = closing - opening;

        let operating_items = vec![
            CashFlowItem { label: "سود خالص".to_string(), amount: net_income },
            CashFlowItem { label: "1208".to_string(), amount: depreciation },
            CashFlowItem { label: "تغییر در حساب‌های دریافتنی".to_string(), amount: -wc_ar },
            CashFlowItem { label: "تغییر در موجودی کالا".to_string(), amount: -wc_inv },
            CashFlowItem { label: "تغییر در حساب‌های پرداختنی".to_string(), amount: wc_ap },
        ];
        let investing_items = vec![
            CashFlowItem { label: "خرید دارایی‌های ثابت".to_string(), amount: -investing_total },
        ];
        let financing_items = vec![
            CashFlowItem { label: "دریافت تسهیلات / افزایش سرمایه".to_string(), amount: financing_total },
        ];

        let operating_subtotal: f64 = operating_items.iter().map(|i| i.amount).sum();
        let mut operating_items = operating_items;
        operating_items.push(CashFlowItem { label: "----".to_string(), amount: net_income });
        // debug: trace net_income components
        let mut d_stmt = conn.prepare(
            "SELECT a.code, a.name, a.type, jl.debit, jl.credit
             FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id
             JOIN accounts a ON jl.account_id = a.id
             WHERE a.company_id = ?1 AND je.date >= ?2 AND je.date <= ?3"
        ).unwrap();
        let d_rows = d_stmt.query_map(params![company_id, from_date, to_date], |row| {
            let code: String = row.get(0)?;
            let name: String = row.get(1)?;
            let atype: String = row.get(2)?;
            let dr: f64 = row.get(3)?;
            let cr: f64 = row.get(4)?;
            Ok((code, name, atype, dr, cr))
        }).unwrap();
        for r in d_rows {
            let (code, name, atype, dr, cr) = r.unwrap();
            let contribution = match atype.as_str() {
                "revenue" => cr - dr,
                "expense" => dr - cr,
                _ => 0.0,
            };
            eprintln!("DEBUG NI: code={} name={} type={} dr={} cr={} contrib={}", code, name, atype, dr, cr, contribution);
        }
        let investing_subtotal: f64 = investing_items.iter().map(|i| i.amount).sum();
        let financing_subtotal: f64 = financing_items.iter().map(|i| i.amount).sum();

        let balanced = (opening + operating_subtotal + investing_subtotal + financing_subtotal - closing).abs() < 0.01;

        Ok(CashFlowReport {
            operating: CashFlowSection { title: "فعالیت‌های عملیاتی".to_string(), items: operating_items, subtotal: operating_subtotal },
            investing: CashFlowSection { title: "فعالیت‌های سرمایه‌گذاری".to_string(), items: investing_items, subtotal: investing_subtotal },
            financing: CashFlowSection { title: "فعالیت‌های تأمین مالی".to_string(), items: financing_items, subtotal: financing_subtotal },
            opening_cash: opening, closing_cash: closing, net_change, balanced,
        })
    }

    // ==================== FINANCIAL REPORT COMPARISON ====================

    pub fn get_financial_report_comparison(&self, company_id: i64,
        from_date: Option<&str>, to_date: Option<&str>,
        prev_from: Option<&str>, prev_to: Option<&str>) -> Result<FinancialReportComparison> {
        let current = self.get_financial_report(company_id, from_date, to_date)?;
        let previous = self.get_financial_report(company_id, prev_from, prev_to)?;

        let variance = |c: f64, p: f64| c - p;
        let variance_pct = |c: f64, p: f64| if p != 0.0 { ((c - p) / p) * 100.0 } else if c != 0.0 { 100.0 } else { 0.0 };

        Ok(FinancialReportComparison {
            current_revenue: current.total_revenue, current_expenses: current.total_expenses,
            current_net_income: current.net_income,
            current_total_assets: current.total_assets, current_total_liabilities: current.total_liabilities,
            current_total_equity: current.total_equity,
            previous_revenue: previous.total_revenue, previous_expenses: previous.total_expenses,
            previous_net_income: previous.net_income,
            previous_total_assets: previous.total_assets, previous_total_liabilities: previous.total_liabilities,
            previous_total_equity: previous.total_equity,
            variance_revenue: variance(current.total_revenue, previous.total_revenue),
            variance_expenses: variance(current.total_expenses, previous.total_expenses),
            variance_net_income: variance(current.net_income, previous.net_income),
            variance_total_assets: variance(current.total_assets, previous.total_assets),
            variance_total_liabilities: variance(current.total_liabilities, previous.total_liabilities),
            variance_total_equity: variance(current.total_equity, previous.total_equity),
            variance_pct_revenue: variance_pct(current.total_revenue, previous.total_revenue),
            variance_pct_expenses: variance_pct(current.total_expenses, previous.total_expenses),
            variance_pct_net_income: variance_pct(current.net_income, previous.net_income),
            variance_pct_total_assets: variance_pct(current.total_assets, previous.total_assets),
            variance_pct_total_liabilities: variance_pct(current.total_liabilities, previous.total_liabilities),
            variance_pct_total_equity: variance_pct(current.total_equity, previous.total_equity),
        })
    }

    // ==================== AGING ====================

    pub fn get_receivables_aging(&self, company_id: i64, as_of_date: &str) -> Result<Vec<AgingRow>> {
        let invoices = self.get_overdue_invoices(company_id, as_of_date, Some("sale"))?;
        Ok(invoices.into_iter().map(|i| AgingRow {
            contact_id: i.contact_id,
            contact_name: i.contact_name.unwrap_or_default(),
            invoice_id: i.id,
            invoice_number: i.number.unwrap_or_default(),
            invoice_date: i.date.clone(),
            due_date: i.due_date.unwrap_or_default(),
            balance: i.total,
            aging_bucket: "current".to_string(),
        }).collect())
    }

    pub fn get_payables_aging(&self, company_id: i64, as_of_date: &str) -> Result<Vec<AgingRow>> {
        let invoices = self.get_overdue_invoices(company_id, as_of_date, Some("purchase"))?;
        Ok(invoices.into_iter().map(|i| AgingRow {
            contact_id: i.contact_id,
            contact_name: i.contact_name.unwrap_or_default(),
            invoice_id: i.id,
            invoice_number: i.number.unwrap_or_default(),
            invoice_date: i.date.clone(),
            due_date: i.due_date.unwrap_or_default(),
            balance: i.total,
            aging_bucket: "current".to_string(),
        }).collect())
    }

    pub fn get_aging(&self, company_id: i64, account_type: &str, as_of_date: &str) -> Result<Vec<(String, f64)>> {
        let _accounts = self.get_accounts(company_id)?;

        let mut buckets: Vec<(String, f64)> = vec![
            ("جاری".to_string(), 0.0),
            ("1-30 روز".to_string(), 0.0),
            ("31-60 روز".to_string(), 0.0),
            ("61-90 روز".to_string(), 0.0),
            ("90+ روز".to_string(), 0.0),
        ];

        // Simplified: use invoice due dates
        let invoices = self.get_invoices()?;
        for inv in &invoices {
            if inv.r#type == (if account_type == "receivable" { "sale" } else { "purchase" }) || account_type == "all" {
                if inv.status != "paid" {
                    if let Some(ref due) = inv.due_date {
                        // Calculate days overdue (simplified - just compare strings for Persian dates)
                        let days_overdue = if due.as_str() < as_of_date {
                            // Simplified: assume 30 day buckets based on date string comparison
                            let _diff = as_of_date.to_string(); // placeholder
                            30.0 // simplified
                        } else { 0.0 };

                        if days_overdue <= 0.0 { buckets[0].1 += inv.total; }
                        else if days_overdue <= 30.0 { buckets[1].1 += inv.total; }
                        else if days_overdue <= 60.0 { buckets[2].1 += inv.total; }
                        else if days_overdue <= 90.0 { buckets[3].1 += inv.total; }
                        else { buckets[4].1 += inv.total; }
                    } else {
                        buckets[0].1 += inv.total;
                    }
                }
            }
        }

        Ok(buckets)
    }
}
