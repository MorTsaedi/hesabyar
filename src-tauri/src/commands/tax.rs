//! Tax (VAT / مالیات بر ارزش افزوده) Tauri commands.
//!
//! Exposes tax settings, per-product tax rates, VAT summary computation,
//! and tax-return tracking.

use crate::db::{Database, TaxReturn, TaxSettings, VatSummary};
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn get_tax_settings(db: State<Database>) -> Result<TaxSettings, String> {
    db.get_tax_settings().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_tax_settings(
    db: State<Database>,
    vat_enabled: bool,
    vat_number: String,
    default_vat_rate: f64,
    _vat_output_account_id: Option<i64>,
    _vat_input_account_id: Option<i64>,
    _withholding_enabled: bool,
    _default_withholding_rate: f64,
    _withholding_account_id: Option<i64>,
) -> Result<(), String> {
    db.update_tax_settings(default_vat_rate, Some(&vat_number), vat_enabled)
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_product_tax_rate(
    db: State<Database>,
    product_id: i64,
    tax_rate: f64,
) -> Result<(), String> {
    db.set_product_tax_rate(product_id, tax_rate)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn compute_vat_summary(
    db: State<Database>,
    _start_date: String,
    _end_date: String,
) -> Result<VatSummary, String> {
    db.compute_vat_summary(1)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_tax_returns(
    db: State<Database>,
    _company_id: i64,
) -> Result<Vec<TaxReturn>, String> {
    db.get_tax_returns().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_tax_return(
    db: State<Database>,
    _company_id: i64,
    period_label: String,
    _start_date: String,
    _end_date: String,
    _due_date: String,
    _notes: String,
) -> Result<i64, String> {
    db.create_tax_return(&period_label, 0.0, 0.0, 0.0)
    .map(|tr| tr.id)
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn record_tax_payment(
    db: State<Database>,
    return_id: i64,
    paid_amount: f64,
    payment_date: String,
    _is_filed: bool,
) -> Result<(), String> {
    db.record_tax_payment(return_id, &payment_date, paid_amount)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_tax_return(db: State<Database>, return_id: i64) -> Result<(), String> {
    db.delete_tax_return(return_id).map_err(|e| e.to_string())
}
