use tauri::State;
use crate::db::{Database, BudgetPeriod, BudgetEntry, BudgetVsActualRow};

#[tauri::command(rename_all = "snake_case")]
pub fn get_budget_periods(db: State<Database>) -> Result<Vec<BudgetPeriod>, String> {
    db.get_budget_periods().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_budget_period(
    db: State<Database>,
    company_id: i64,
    name: String,
    start_date: String,
    end_date: String,
) -> Result<BudgetPeriod, String> {
    db.create_budget_period(company_id, &name, &start_date, &end_date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_budget_period(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_budget_period(id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_budget_entries(db: State<Database>, budget_period_id: i64) -> Result<Vec<BudgetEntry>, String> {
    db.get_budget_entries(budget_period_id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn upsert_budget_entry(
    db: State<Database>,
    budget_period_id: i64,
    account_id: i64,
    amount: f64,
) -> Result<BudgetEntry, String> {
    db.upsert_budget_entry(budget_period_id, account_id, amount)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_budget_entry(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_budget_entry(id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_budget_vs_actual(
    db: State<Database>,
    budget_period_id: i64,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Vec<BudgetVsActualRow>, String> {
    db.get_budget_vs_actual(budget_period_id, from_date.as_deref(), to_date.as_deref())
        .map_err(|e| e.to_string())
}
