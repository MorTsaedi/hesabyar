use tauri::State;
use crate::db::{Database, JournalEntryRow, JournalLineInput};

#[tauri::command]
pub fn get_journal_entries(db: State<Database>) -> Result<Vec<JournalEntryRow>, String> {
    db.get_journal_entries(1).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_journal_entry(db: State<Database>, id: i64) -> Result<JournalEntryRow, String> {
    db.get_journal_entry(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_journal_entry(
    db: State<Database>,
    date: String,
    description: String,
    reference: Option<String>,
    lines: Vec<JournalLineInput>,
) -> Result<JournalEntryRow, String> {
    let entry = db.create_journal_entry(1, 1, &date, &description, reference.as_deref(), lines)
        .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "create", "journal", Some(entry.id), &format!("سند روزنامه شماره {} ثبت شد", entry.entry_number), Some(&description));
    Ok(entry)
}

#[tauri::command]
pub fn update_journal_entry(
    db: State<Database>,
    id: i64,
    date: String,
    description: String,
    reference: Option<String>,
    lines: Vec<JournalLineInput>,
) -> Result<JournalEntryRow, String> {
    let entry = db.update_journal_entry(id, &date, &description, reference.as_deref(), lines)
        .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "update", "journal", Some(id), &format!("سند روزنامه شماره {} ویرایش شد", entry.entry_number), Some(&description));
    Ok(entry)
}

#[tauri::command]
pub fn delete_journal_entry(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_journal_entry(id).map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "delete", "journal", Some(id), "سند روزنامه حذف شد", None);
    Ok(())
}

#[tauri::command]
pub fn get_account_balance(db: State<Database>, account_id: i64) -> Result<f64, String> {
    db.get_account_balance(account_id).map_err(|e| e.to_string())
}
