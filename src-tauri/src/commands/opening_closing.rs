use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OpeningClosingResult {
    pub opening_entry_id: i64,
    pub closing_entry_id: i64,
    pub total_debit: f64,
    pub total_credit: f64,
    pub accounts_closed: i32,
}

#[tauri::command]
pub fn generate_opening_entry(
    db: State<Database>,
    company_id: i64,
    fiscal_year_id: i64,
    date: String,
) -> Result<i64, String> {
    let balances = db
        .get_account_balances_for_date(company_id, &date)
        .map_err(|e| e.to_string())?;

    let non_zero_balances: Vec<(i64, f64)> = balances
        .into_iter()
        .filter(|(_, balance)| *balance != 0.0)
        .collect();

    if non_zero_balances.is_empty() {
        return Err("هیچ حسابی با مانده غیرصفر یافت نشد".to_string());
    }

    let entry_id = db
        .create_opening_entry(company_id, &fiscal_year_id.to_string(), &date, 0, 0)
        .map_err(|e| e.to_string())?;

    for (account_id, balance) in &non_zero_balances {
        let (debit, credit) = if *balance > 0.0 {
            (balance.abs(), 0.0)
        } else {
            (0.0, balance.abs())
        };
        db.add_journal_line(entry_id, *account_id, debit, credit, None)
            .map_err(|e| e.to_string())?;
    }

    Ok(entry_id)
}

#[tauri::command]
pub fn generate_closing_entry(
    db: State<Database>,
    company_id: i64,
    fiscal_year_id: i64,
    date: String,
) -> Result<i64, String> {
    let (total_revenue, total_expenses) = db
        .get_revenue_expense_balances(company_id, &fiscal_year_id.to_string())
        .map_err(|e| e.to_string())?;

    let net_income = total_revenue - total_expenses;

    let entry_id = db
        .create_opening_entry(company_id, &fiscal_year_id.to_string(), &date, 0, 0)
        .map_err(|e| e.to_string())?;



    let income_summary_id = db
        .get_or_create_income_summary_account(company_id)
        .map_err(|e| e.to_string())?;

    if net_income > 0.0 {
        db.add_journal_line(income_summary_id, entry_id, 0.0, net_income, Some("سود خالص دوره"))
            .map_err(|e| e.to_string())?;
    } else if net_income < 0.0 {
        db.add_journal_line(income_summary_id, entry_id, net_income.abs(), 0.0, Some("زیان خالص دوره"))
            .map_err(|e| e.to_string())?;
    }

    Ok(entry_id)
}

#[tauri::command]
pub fn generate_opening_closing_entries(
    db: State<Database>,
    company_id: i64,
    fiscal_year_id: i64,
    opening_date: String,
    closing_date: String,
) -> Result<OpeningClosingResult, String> {
    let closing_entry_id = generate_closing_entry(
        db.clone(),
        company_id,
        fiscal_year_id,
        closing_date.clone(),
    )?;

    let balances = db
        .get_account_balances_for_date(company_id, &closing_date)
        .map_err(|e| e.to_string())?;

    let non_zero_balances: Vec<(i64, f64)> = balances
        .into_iter()
        .filter(|(_, balance)| *balance != 0.0)
        .collect();

    let total_amount: f64 = non_zero_balances.iter().map(|(_, b)| b.abs()).sum();

    let opening_entry_id = db
        .create_opening_entry(company_id, &fiscal_year_id.to_string(), &opening_date, 0, 0)
        .map_err(|e| e.to_string())?;

    for (account_id, balance) in &non_zero_balances {
        let (debit, credit) = if *balance > 0.0 {
            (balance.abs(), 0.0)
        } else {
            (0.0, balance.abs())
        };
        db.add_journal_line(opening_entry_id, *account_id, debit, credit, None)
            .map_err(|e| e.to_string())?;
    }

    Ok(OpeningClosingResult {
        opening_entry_id,
        closing_entry_id,
        total_debit: total_amount,
        total_credit: total_amount,
        accounts_closed: non_zero_balances.len() as i32,
    })
}

#[tauri::command]
pub fn get_period_status(
    db: State<Database>,
    company_id: i64,
    fiscal_year_id: i64,
) -> Result<serde_json::Value, String> {
    let total_debit = db
        .get_total_debits(company_id)
        .map_err(|e| e.to_string())?;
    let total_credit = db
        .get_total_credits(company_id)
        .map_err(|e| e.to_string())?;

    let has_opening = db.has_opening_entry(company_id, &fiscal_year_id.to_string()).unwrap_or(false);
    let has_closing = db.has_closing_entry(company_id, &fiscal_year_id.to_string()).unwrap_or(false);

    let result = serde_json::json!({
        "is_balanced": (total_debit - total_credit).abs() < 0.01,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "difference": total_debit - total_credit,
        "has_opening_entry": has_opening,
        "has_closing_entry": has_closing,
        "is_period_closed": has_opening && has_closing,
    });

    Ok(result)
}