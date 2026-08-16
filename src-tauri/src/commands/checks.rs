#![allow(non_snake_case)]

//! Check Management — issued/received checks (دسته چک), status tracking & reminders.

use crate::db::{Check, CheckSummary, Database};
use tauri::State;

#[tauri::command]
pub fn get_checks(db: State<Database>, companyId: i64) -> Result<Vec<Check>, String> {
    db.get_checks(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_check(
    db: State<Database>,
    companyId: i64,
    r#type: String,
    checkNumber: String,
    serial: Option<String>,
    bankName: Option<String>,
    amount: f64,
    issueDate: String,
    dueDate: String,
    contactId: Option<i64>,
    description: Option<String>,
    notes: Option<String>,
) -> Result<i64, String> {
    db.create_check(
        companyId, &r#type, &checkNumber, serial.as_deref(), bankName.as_deref(),
        amount, &issueDate, &dueDate, contactId, description.as_deref(), notes.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_check(
    db: State<Database>,
    id: i64,
    checkNumber: String,
    serial: Option<String>,
    bankName: Option<String>,
    amount: f64,
    issueDate: String,
    dueDate: String,
    contactId: Option<i64>,
    description: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    db.update_check(
        id, &checkNumber, serial.as_deref(), bankName.as_deref(), amount,
        &issueDate, &dueDate, contactId, description.as_deref(), notes.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_check(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_check(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_check_status(db: State<Database>, id: i64, status: String) -> Result<(), String> {
    db.update_check_status(id, &status).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_check_summary(db: State<Database>, companyId: i64, today: String) -> Result<CheckSummary, String> {
    db.get_check_summary(companyId, &today).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_due_checks(db: State<Database>, companyId: i64, today: String) -> Result<Vec<Check>, String> {
    db.get_due_checks(companyId, &today).map_err(|e| e.to_string())
}
