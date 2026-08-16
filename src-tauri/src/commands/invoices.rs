use crate::db::{Database, Invoice, InvoiceLine, InvoiceLineInput};
use serde::{Serialize, Deserialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceLineCreate {
    pub product_id: Option<i64>,
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_invoices(db: State<'_, Database>) -> Result<Vec<Invoice>, String> {
    db.get_invoices().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_invoice(db: State<'_, Database>, id: i64) -> Result<(Invoice, Vec<InvoiceLine>), String> {
    db.get_invoice(id).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_invoice(
    db: State<'_, Database>,
    contact_id: Option<i64>,
    date: String,
    due_date: Option<String>,
    invoice_type: String,
    lines: Vec<InvoiceLineCreate>,
    notes: Option<String>,
) -> Result<Invoice, String> {
    let allowed_types = ["sale", "purchase", "sale_return", "purchase_return", "proforma"];
    let itype = if allowed_types.contains(&invoice_type.as_str()) {
        invoice_type
    } else {
        "sale".to_string()
    };

    let line_tuples: Vec<(Option<i64>, String, f64, f64, f64)> = lines
        .into_iter()
        .map(|l| (l.product_id, l.description, l.quantity, l.unit_price, l.tax_rate))
        .collect();

    let lines_input: Vec<InvoiceLineInput> = line_tuples.into_iter().map(|(pid, desc, qty, price, tax)| InvoiceLineInput {
        product_id: pid,
        description: Some(desc),
        quantity: qty,
        unit_price: price,
        discount_pct: 0.0,
        tax_rate: tax,
    }).collect();
    let invoice_id = db.create_invoice(
        &itype,
        contact_id.unwrap_or(0),
        &date,
        due_date.as_deref(),
        notes.as_deref(),
        lines_input,
    )
    .map_err(|e| e.to_string())?;

    let (invoice, _) = db.get_invoice(invoice_id).map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "create", "invoice", Some(invoice.id), &format!("فاکتور شماره {} ایجاد شد", invoice.number.as_deref().unwrap_or("")), None);
    Ok(invoice)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_invoice(
    db: State<'_, Database>,
    id: i64,
    invoice_type: String,
    contact_id: Option<i64>,
    date: String,
    due_date: Option<String>,
    status: String,
    lines: Vec<InvoiceLineCreate>,
    notes: Option<String>,
) -> Result<Invoice, String> {
    let allowed_statuses = ["draft", "confirmed", "cancelled"];
    let s = if allowed_statuses.contains(&status.as_str()) {
        status
    } else {
        "draft".to_string()
    };

    let line_tuples: Vec<(Option<i64>, String, f64, f64, f64)> = lines
        .into_iter()
        .map(|l| (l.product_id, l.description, l.quantity, l.unit_price, l.tax_rate))
        .collect();

    let lines_input: Vec<InvoiceLineInput> = line_tuples.into_iter().map(|(pid, desc, qty, price, tax)| InvoiceLineInput {
        product_id: pid,
        description: Some(desc),
        quantity: qty,
        unit_price: price,
        discount_pct: 0.0,
        tax_rate: tax,
    }).collect();
    db.update_invoice(
        id,
        &invoice_type,
        contact_id.unwrap_or(0),
        &date,
        due_date.as_deref(),
        &s,
        notes.as_deref(),
        lines_input,
    )
    .map_err(|e| e.to_string())?;

    let (invoice, _) = db.get_invoice(id).map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "update", "invoice", Some(id), &format!("فاکتور شماره {} ویرایش شد", invoice.number.as_deref().unwrap_or("")), None);
    Ok(invoice)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_invoice(db: State<'_, Database>, id: i64) -> Result<(), String> {
    db.delete_invoice(id)
        .map_err(|e| {
            if e.to_string().contains("فقط فاکتورهای پیشنویس قابل حذف هستند") {
                "فقط فاکتورهای پیشنویس قابل حذف هستند".to_string()
            } else {
                e.to_string()
            }
        })?;
    let _ = db.log_audit(1, "delete", "invoice", Some(id), "فاکتور حذف شد", None);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_invoice_status(db: State<'_, Database>, id: i64, status: String) -> Result<(), String> {
    let allowed = ["draft", "confirmed", "cancelled"];
    let s = if allowed.contains(&status.as_str()) {
        status
    } else {
        "draft".to_string()
    };
    db.update_invoice_status(id, &s)
        .map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "status", "invoice", Some(id), &format!("وضعیت فاکتور به «{}» تغییر کرد", s), None);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn search_invoices(db: State<'_, Database>, query: String) -> Result<Vec<Invoice>, String> {
    db.search_invoices(&query).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_overdue_invoices(
    db: State<'_, Database>,
    as_of_date: String,
    invoice_type: Option<String>,
) -> Result<Vec<Invoice>, String> {
    db.get_overdue_invoices(1, &as_of_date, invoice_type.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_contact_payment_terms(
    db: State<'_, Database>,
    contact_id: i64,
    payment_term_days: i32,
    credit_limit: f64,
) -> Result<(), String> {
    db.update_contact_payment_terms(contact_id, payment_term_days, credit_limit)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn calculate_early_payment_discount(
    db: State<'_, Database>,
    invoice_id: i64,
    payment_date: String,
) -> Result<f64, String> {
    db.calculate_early_payment_discount(invoice_id, &payment_date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn calculate_late_payment_penalty(
    db: State<'_, Database>,
    invoice_id: i64,
    payment_date: String,
) -> Result<f64, String> {
    db.calculate_late_payment_penalty(invoice_id, &payment_date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn record_invoice_payment(
    db: State<'_, Database>,
    invoice_id: i64,
    amount: f64,
    payment_date: String,
) -> Result<(), String> {
    db.record_invoice_payment(invoice_id, amount, &payment_date)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn update_contact_discounts(
    db: State<'_, Database>,
    contact_id: i64,
    early_payment_discount_pct: f64,
    early_payment_discount_days: i32,
    late_payment_penalty_pct: f64,
) -> Result<(), String> {
    db.update_contact_discounts(contact_id, early_payment_discount_pct, early_payment_discount_days, late_payment_penalty_pct)
        .map_err(|e| e.to_string())
}
