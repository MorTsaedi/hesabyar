use tauri::State;
use crate::db::{CashFlowReport, Database, TrialBalanceRow, TrialBalanceComparisonRow, FinancialReport, FinancialReportComparison, BalanceSheetDetails, IncomeStatementDetails, JournalEntry, JournalLine};

#[tauri::command(rename_all = "snake_case")]
pub fn get_trial_balance(
    db: State<Database>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Vec<TrialBalanceRow>, String> {
    db.get_trial_balance(1, from_date.as_deref(), to_date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_general_ledger(
    db: State<Database>,
    account_id: i64,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Vec<(JournalEntry, Vec<JournalLine>)>, String> {
    db.get_general_ledger(account_id, from_date.as_deref(), to_date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_trial_balance_comparison(
    db: State<Database>,
    current_from: Option<String>,
    current_to: Option<String>,
    previous_from: Option<String>,
    previous_to: Option<String>,
) -> Result<Vec<TrialBalanceComparisonRow>, String> {
    db.get_trial_balance_comparison(
        1,
        current_from.as_deref(),
        current_to.as_deref(),
        previous_from.as_deref(),
        previous_to.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_financial_report_comparison(
    db: State<Database>,
    current_from: Option<String>,
    current_to: Option<String>,
    previous_from: Option<String>,
    previous_to: Option<String>,
) -> Result<FinancialReportComparison, String> {
    db.get_financial_report_comparison(
        1,
        current_from.as_deref(),
        current_to.as_deref(),
        previous_from.as_deref(),
        previous_to.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_financial_report(
    db: State<Database>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<FinancialReport, String> {
    db.get_financial_report(1, from_date.as_deref(), to_date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_cash_flow_statement(
    db: State<Database>,
    from_date: String,
    to_date: String,
) -> Result<CashFlowReport, String> {
    db.get_cash_flow_statement(1, &from_date, &to_date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_balance_sheet_details(
    db: State<Database>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<BalanceSheetDetails, String> {
    db.get_balance_sheet_details(1, from_date.as_deref(), to_date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_income_statement_details(
    db: State<Database>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<IncomeStatementDetails, String> {
    db.get_income_statement_details(1, from_date.as_deref(), to_date.as_deref())
        .map_err(|e| e.to_string())
}
