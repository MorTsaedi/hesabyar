use tauri::State;
use crate::db::Database;
use serde::{Deserialize, Serialize};
use rusqlite::params;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecurringEntry {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub description: String,
    pub account_id: i64,
    pub account_code: String,
    pub account_name: String,
    pub amount: f64,
    pub r#type: String,
    pub frequency: String,
    pub day_of_month: Option<i32>,
    pub day_of_week: Option<i32>,
    pub month: Option<i32>,
    pub start_date: String,
    pub end_date: Option<String>,
    pub last_generated_date: Option<String>,
    pub next_generation_date: String,
    pub is_active: bool,
    pub created_at: String,
}

#[tauri::command]
pub fn get_recurring_entries(db: State<Database>, company_id: i64) -> Result<Vec<RecurringEntry>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT r.id, r.company_id, r.name, r.description, r.account_id,
         a.code, a.name,
         r.amount, r.type, r.frequency, r.day_of_month, r.day_of_week,
         r.month, r.start_date, r.end_date, r.last_generated_date,
         r.next_generation_date, r.is_active, r.created_at
         FROM recurring_entries r
         JOIN accounts a ON r.account_id = a.id
         WHERE r.company_id = ?1
         ORDER BY r.name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([company_id], |row| {
        Ok(RecurringEntry {
            id: row.get(0)?,
            company_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            account_id: row.get(4)?,
            account_code: row.get(5)?,
            account_name: row.get(6)?,
            amount: row.get(7)?,
            r#type: row.get(8)?,
            frequency: row.get(9)?,
            day_of_month: row.get(10)?,
            day_of_week: row.get(11)?,
            month: row.get(12)?,
            start_date: row.get(13)?,
            end_date: row.get(14)?,
            last_generated_date: row.get(15)?,
            next_generation_date: row.get(16)?,
            is_active: row.get::<_, i64>(17)? != 0,
            created_at: row.get(18)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row.map_err(|e| e.to_string())?);
    }
    Ok(entries)
}

#[tauri::command]
pub fn create_recurring_entry(
    db: State<Database>,
    company_id: i64,
    name: String,
    description: Option<String>,
    account_id: i64,
    amount: f64,
    r#type: String,
    frequency: String,
    day_of_month: Option<i32>,
    day_of_week: Option<i32>,
    month: Option<i32>,
    start_date: String,
    end_date: Option<String>,
) -> Result<i64, String> {
    let conn = db.conn.lock().unwrap();
    let next_date = &start_date;

    conn.execute(
        "INSERT INTO recurring_entries (
            company_id, name, description, account_id, amount, type, frequency,
            day_of_month, day_of_week, month, start_date, end_date, next_generation_date, is_active
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 1)",
        params![
            company_id, name, description.unwrap_or_default(), account_id,
            amount, r#type, frequency,
            day_of_month, day_of_week, month, start_date, end_date, next_date
        ],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_recurring_entry(
    db: State<Database>,
    id: i64,
    name: String,
    description: Option<String>,
    account_id: i64,
    amount: f64,
    r#type: String,
    frequency: String,
    day_of_month: Option<i32>,
    day_of_week: Option<i32>,
    month: Option<i32>,
    start_date: String,
    end_date: Option<String>,
    is_active: bool,
) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let next_date = &start_date;

    conn.execute(
        "UPDATE recurring_entries SET
            name = ?1, description = ?2, account_id = ?3, amount = ?4, type = ?5,
            frequency = ?6, day_of_month = ?7, day_of_week = ?8, month = ?9,
            start_date = ?10, end_date = ?11, next_generation_date = ?12, is_active = ?13,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?14",
        params![
            name, description.unwrap_or_default(), account_id, amount, r#type,
            frequency, day_of_month, day_of_week, month, start_date, end_date,
            next_date, if is_active { 1i64 } else { 0i64 }, id
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_recurring_entry(db: State<Database>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM recurring_entries WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn generate_entries_from_recurring(
    db: State<Database>,
    company_id: i64,
    target_date: String,
) -> Result<i64, String> {
    let conn = db.conn.lock().unwrap();

    // Find all due recurring entries
    let mut stmt = conn.prepare(
        "SELECT r.id, r.name, r.account_id, r.amount, r.type, r.end_date, r.next_generation_date
         FROM recurring_entries r
         WHERE r.company_id = ?1 AND r.is_active = 1
         AND r.next_generation_date <= ?2"
    ).map_err(|e| e.to_string())?;

    let due_entries: Vec<(i64, String, i64, f64, String, Option<String>)> = stmt
        .query_map(params![company_id, target_date], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);

    let mut generated = 0i64;
    for (id, name, account_id, amount, entry_type, end_date) in due_entries {
        if let Some(ref end) = end_date {
            if end.as_str() < target_date.as_str() {
                continue;
            }
        }

        // Get fiscal year
        let fiscal_year_id: i64 = conn
            .query_row(
                "SELECT id FROM fiscal_years WHERE company_id = ?1 AND is_closed = 0 LIMIT 1",
                [company_id],
                |r| r.get(0),
            )
            .map_err(|_| "هیچ سال مالی بازي یافت نشد".to_string())?;

        // Get next entry number
        let entry_number: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries
                 WHERE company_id = ?1 AND fiscal_year_id = ?2",
                params![company_id, fiscal_year_id],
                |r| r.get(0),
            )
            .unwrap_or(1);

        // Create journal entry
        conn.execute(
            "INSERT INTO journal_entries (company_id, fiscal_year_id, entry_number, date, description)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![company_id, fiscal_year_id, entry_number, target_date, name],
        ).map_err(|e| e.to_string())?;

        let entry_id = conn.last_insert_rowid();

        let (debit, credit) = if entry_type == "debit" { (amount, 0.0) } else { (0.0, amount) };
        conn.execute(
            "INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entry_id, account_id, debit, credit, "سند تولید شده از قالب تکرارشونده"],
        ).map_err(|e| e.to_string())?;

        // Update next generation date
        conn.execute(
            "UPDATE recurring_entries SET last_generated_date = ?1, next_generation_date = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![target_date, id],
        ).map_err(|e| e.to_string())?;

        generated += 1;
    }

    Ok(generated)
}