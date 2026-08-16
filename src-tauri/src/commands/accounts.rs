use tauri::State;
use crate::db::{Database, AccountRow};

#[tauri::command(rename_all = "snake_case")]
pub fn get_accounts(db: State<Database>) -> Result<Vec<AccountRow>, String> {
    // For MVP, we use company_id = 1
    db.get_accounts(1).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_account(
    db: State<Database>,
    code: String,
    name: String,
    parent_id: Option<i64>,
    level: i32,
    account_type: String,
    currency: Option<String>,
) -> Result<i64, String> {
    let acc = db.create_account(1, &code, &name, parent_id, level, &account_type, currency.as_deref())
        .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "create", "account", Some(acc.id), &format!("حساب «{}» با کد {} ایجاد شد", name, code), None);
    Ok(acc.id)
}

#[tauri::command]
pub fn update_account(
    db: State<Database>,
    id: i64,
    code: String,
    name: String,
    is_active: bool,
    description: String,
    currency: Option<String>,
) -> Result<(), String> {
    db.update_account(id, &code, &name, is_active, Some(&description), currency.as_deref())
        .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "update", "account", Some(id), &format!("حساب «{}» ویرایش شد", name), None);
    Ok(())
}

#[tauri::command]
pub fn delete_account(
    db: State<Database>,
    id: i64,
) -> Result<(), String> {
    db.delete_account(id).map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "delete", "account", Some(id), "حساب حذف شد", None);
    Ok(())
}
