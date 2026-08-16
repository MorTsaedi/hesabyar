//! Banking — Bank accounts, Receipt Vouchers (رسید دریافت) and
//! Payment Vouchers (رسید پرداخت).

use crate::db::{Database, BankAccount, PaymentVoucher, ReceiptVoucher};
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn get_bank_accounts(db: State<Database>, company_id: i64) -> Result<Vec<BankAccount>, String> {
    db.get_bank_accounts(company_id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn upsert_bank_account(
    db: State<Database>,
    company_id: i64,
    account_id: i64,
    bank_name: String,
    account_number: String,
    branch: String,
    iban: String,
) -> Result<i64, String> {
    db.upsert_bank_account(
        Some(account_id),
        company_id,
        account_id,
        &bank_name,
        Some(&branch),
        Some(&account_number),
        Some(&iban),
        None,
        None,
    )
    .map(|ba| ba.id)
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_bank_account(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_bank_account(id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_receipt_vouchers(
    db: State<Database>,
    company_id: i64,
) -> Result<Vec<ReceiptVoucher>, String> {
    db.get_receipt_vouchers(company_id)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::too_many_arguments)]
pub fn create_receipt_voucher(
    db: State<Database>,
    company_id: i64,
    _fiscal_year_id: i64,
    _number: String,
    date: String,
    contact_id: Option<i64>,
    _contact_account_id: Option<i64>,
    bank_account_id: i64,
    amount: f64,
    _payment_method: String,
    reference: String,
    description: String,
) -> Result<i64, String> {
    db.create_receipt_voucher(
        company_id,
        bank_account_id,
        amount,
        contact_id.map(|cid| cid.to_string()).as_deref(),
        Some(&description),
        &date,
        Some(&reference),
    )
    .map(|rv| rv.id)
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_receipt_voucher(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_receipt_voucher(id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_payment_vouchers(
    db: State<Database>,
    company_id: i64,
) -> Result<Vec<PaymentVoucher>, String> {
    db.get_payment_vouchers(company_id)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
#[allow(clippy::too_many_arguments)]
pub fn create_payment_voucher(
    db: State<Database>,
    company_id: i64,
    _fiscal_year_id: i64,
    _number: String,
    date: String,
    contact_id: Option<i64>,
    _contact_account_id: Option<i64>,
    bank_account_id: i64,
    amount: f64,
    _payment_method: String,
    reference: String,
    description: String,
) -> Result<i64, String> {
    db.create_payment_voucher(
        company_id,
        bank_account_id,
        amount,
        contact_id.map(|cid| cid.to_string()).as_deref(),
        Some(&description),
        &date,
        Some(&reference),
    )
    .map(|pv| pv.id)
    .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_payment_voucher(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_payment_voucher(id).map_err(|e| e.to_string())
}
