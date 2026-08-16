#![allow(non_snake_case)]

//! Audit Trail — read-only log of all app events.

use crate::db::{AuditLogEntry, Database};
use tauri::State;

#[tauri::command]
pub fn get_audit_log(db: State<Database>, companyId: i64, limit: i64) -> Result<Vec<AuditLogEntry>, String> {
    db.get_audit_log(companyId, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_audit_entities(db: State<Database>, companyId: i64) -> Result<Vec<String>, String> {
    db.get_audit_entities(companyId).map_err(|e| e.to_string())
}
