use tauri::State;
use crate::db::{Database, ExchangeRate, CurrencyRevaluationRow, RevaluationDetail, AccountRow};

#[tauri::command(rename_all = "snake_case")]
pub fn set_exchange_rate(
    db: State<Database>,
    from_currency: String,
    to_currency: String,
    rate: f64,
    date: String,
) -> Result<(), String> {
    db.set_exchange_rate(&from_currency, &to_currency, rate, &date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_exchange_rate(
    db: State<Database>,
    from_currency: String,
    to_currency: String,
    date: String,
) -> Result<f64, String> {
    db.get_exchange_rate(&from_currency, &to_currency, &date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_exchange_rates(
    db: State<Database>,
    from_currency: String,
    to_currency: String,
    limit: Option<i64>,
) -> Result<Vec<ExchangeRate>, String> {
    let lim = limit.unwrap_or(20);
    db.get_exchange_rates(&from_currency, &to_currency, lim)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_foreign_currency_accounts(
    db: State<Database>,
) -> Result<Vec<AccountRow>, String> {
    db.get_foreign_currency_accounts(1)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_account_balance_as_of(
    db: State<Database>,
    account_id: i64,
    as_of_date: String,
) -> Result<f64, String> {
    db.get_account_balance_as_of(account_id, &as_of_date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn perform_currency_revaluation(
    db: State<Database>,
    fiscal_year_id: i64,
    as_of_date: String,
    revaluation_gain_account_id: i64,
    revaluation_loss_account_id: i64,
) -> Result<Vec<RevaluationDetail>, String> {
    db.perform_currency_revaluation(1, fiscal_year_id, &as_of_date, revaluation_gain_account_id, revaluation_loss_account_id)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_revaluation_history(
    db: State<Database>,
) -> Result<Vec<CurrencyRevaluationRow>, String> {
    db.get_revaluation_history(1)
        .map_err(|e| e.to_string())
}
