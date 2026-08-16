use crate::db::{Database, Contact};
use tauri::State;

#[tauri::command]
pub async fn get_contacts(db: State<'_, Database>) -> Result<Vec<Contact>, String> {
    db.get_contacts().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_contact(
    db: State<'_, Database>,
    name: String,
    contact_type: Option<String>,
    _code: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    tax_id: Option<String>,
    notes: Option<String>,
    payment_term_days: Option<i32>,
    credit_limit: Option<f64>,
    early_payment_discount_pct: Option<f64>,
    early_payment_discount_days: Option<i32>,
    late_payment_penalty_pct: Option<f64>,
) -> Result<Contact, String> {
    let allowed = ["customer", "supplier", "employee", "other"];
    let ctype = contact_type
        .as_deref()
        .filter(|t| allowed.contains(t))
        .unwrap_or("customer")
        .to_string();

    let id = db.create_contact(
        &ctype,
        &name,
        phone.as_deref(),
        email.as_deref(),
        address.as_deref(),
        tax_id.as_deref(),
        notes.as_deref(),
        payment_term_days,
        credit_limit,
        early_payment_discount_pct,
        early_payment_discount_days,
        late_payment_penalty_pct,
    )
    .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "create", "contact", Some(id), &format!("شخص «{}» ایجاد شد", name), None);
    db.get_contact(id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_contact(
    db: State<'_, Database>,
    id: i64,
    name: String,
    contact_type: Option<String>,
    _code: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    tax_id: Option<String>,
    notes: Option<String>,
    payment_term_days: Option<i32>,
    credit_limit: Option<f64>,
    early_payment_discount_pct: Option<f64>,
    early_payment_discount_days: Option<i32>,
    late_payment_penalty_pct: Option<f64>,
) -> Result<Contact, String> {
    let allowed = ["customer", "supplier", "employee", "other"];
    let ctype = contact_type
        .as_deref()
        .filter(|t| allowed.contains(t))
        .unwrap_or("customer")
        .to_string();

    db.update_contact(
        id,
        &ctype,
        &name,
        phone.as_deref(),
        email.as_deref(),
        address.as_deref(),
        tax_id.as_deref(),
        notes.as_deref(),
        payment_term_days,
        credit_limit,
        early_payment_discount_pct,
        early_payment_discount_days,
        late_payment_penalty_pct,
    )
    .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "update", "contact", Some(id), &format!("شخص «{}» ویرایش شد", name), None);
    db.get_contact(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_contact(db: State<'_, Database>, id: i64) -> Result<(), String> {
    db.delete_contact(id)
        .map_err(|e| {
            if e.to_string().contains("FOREIGN KEY constraint failed") || e.to_string().contains("ExecuteReturnedResults") {
                "این مخاطب در فاکتورهای موجود استفاده شده و قابل حذف نیست".to_string()
            } else {
                e.to_string()
            }
        })?;
    let _ = db.log_audit(1, "delete", "contact", Some(id), "شخص حذف شد", None);
    Ok(())
}

#[tauri::command]
pub async fn get_contact(db: State<'_, Database>, id: i64) -> Result<Contact, String> {
    db.get_contact(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_contacts(db: State<'_, Database>, query: String) -> Result<Vec<Contact>, String> {
    db.search_contacts(&query).map_err(|e| e.to_string())
}
