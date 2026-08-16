use crate::db::{Database, AgingRow};
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgingSummary {
    pub total_current: f64,
    pub total_1_30: f64,
    pub total_31_60: f64,
    pub total_61_90: f64,
    pub total_90_plus: f64,
    pub grand_total: f64,
    pub items: Vec<AgingRow>,
}

fn summarize(items: Vec<AgingRow>) -> AgingSummary {
    let grand_total: f64 = items.iter().map(|r| r.balance).sum();
    let mut s = AgingSummary {
        total_current: 0.0,
        total_1_30: 0.0,
        total_31_60: 0.0,
        total_61_90: 0.0,
        total_90_plus: 0.0,
        grand_total,
        items,
    };
    for item in &s.items {
        match item.aging_bucket.as_str() {
            "current" => s.total_current += item.balance,
            "1-30" => s.total_1_30 += item.balance,
            "31-60" => s.total_31_60 += item.balance,
            "61-90" => s.total_61_90 += item.balance,
            _ => s.total_90_plus += item.balance,
        }
    }
    s
}

#[tauri::command]
pub fn get_receivables_aging(
    db: State<Database>,
    company_id: i64,
    as_of_date: String,
) -> Result<AgingSummary, String> {
    let rows = db
        .get_receivables_aging(company_id, &as_of_date)
        .map_err(|e| e.to_string())?;
    Ok(summarize(rows))
}

#[tauri::command]
pub fn get_payables_aging(
    db: State<Database>,
    company_id: i64,
    as_of_date: String,
) -> Result<AgingSummary, String> {
    let rows = db
        .get_payables_aging(company_id, &as_of_date)
        .map_err(|e| e.to_string())?;
    Ok(summarize(rows))
}

#[tauri::command]
pub fn get_aging_summary(
    db: State<Database>,
    company_id: i64,
    as_of_date: String,
) -> Result<serde_json::Value, String> {
    let receivables = db
        .get_receivables_aging(company_id, &as_of_date)
        .map_err(|e| e.to_string())?;
    let payables = db
        .get_payables_aging(company_id, &as_of_date)
        .map_err(|e| e.to_string())?;

    let rec_total: f64 = receivables.iter().map(|r| r.balance).sum();
    let pay_total: f64 = payables.iter().map(|r| r.balance).sum();

    Ok(serde_json::json!({
        "receivables_total": rec_total,
        "payables_total": pay_total,
        "net_receivables": rec_total - pay_total,
        "receivables_count": receivables.len(),
        "payables_count": payables.len(),
    }))
}
