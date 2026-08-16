#![allow(non_snake_case)]

//! Bank Reconciliation — match bank statements against GL vouchers.

use crate::db::{BankStatementEntry, Database, ReconciliationSummary};
use tauri::State;

#[tauri::command]
pub fn get_bank_statement_entries(
    db: State<Database>,
    bankAccountId: i64,
) -> Result<Vec<BankStatementEntry>, String> {
    db.get_bank_statement_entries(bankAccountId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_bank_statement_entry(
    db: State<Database>,
    bankAccountId: i64,
    statementDate: String,
    description: String,
    amount: f64,
    reference: Option<String>,
) -> Result<i64, String> {
    db.add_bank_statement_entry(bankAccountId, &statementDate, &description, amount, reference.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bank_statement_entry(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_bank_statement_entry(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reconcile_statement_entry(
    db: State<Database>,
    id: i64,
    voucherId: i64,
    voucherType: String,
) -> Result<(), String> {
    db.reconcile_statement_entry(id, voucherId, &voucherType).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unreconcile_statement_entry(db: State<Database>, id: i64) -> Result<(), String> {
    db.unreconcile_statement_entry(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_reconciliation_summary(
    db: State<Database>,
    bankAccountId: i64,
) -> Result<ReconciliationSummary, String> {
    db.get_reconciliation_summary(bankAccountId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_unmatched_vouchers(
    db: State<Database>,
    bankAccountId: i64,
) -> Result<Vec<(i64, String, String, f64, String)>, String> {
    db.get_unmatched_vouchers(bankAccountId).map_err(|e| e.to_string())
}
