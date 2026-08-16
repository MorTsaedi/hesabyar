use crate::db::Database;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Company {
    pub id: i64,
    pub name: String,
    pub national_id: String,
    pub economic_code: String,
    pub registration_number: String,
    pub address: String,
    pub phone: String,
    pub email: String,
    pub website: String,
    pub fiscal_year_start: String,
    pub created_at: String,
}

impl From<crate::db::CompanyRow> for Company {
    fn from(r: crate::db::CompanyRow) -> Self {
        Company {
            id: r.id,
            name: r.name,
            national_id: r.national_id.unwrap_or_default(),
            economic_code: r.economic_code.unwrap_or_default(),
            registration_number: r.registration_number.unwrap_or_default(),
            address: r.address.unwrap_or_default(),
            phone: r.phone.unwrap_or_default(),
            email: r.email.unwrap_or_default(),
            website: r.website.unwrap_or_default(),
            fiscal_year_start: r.fiscal_year_start,
            created_at: r.created_at.unwrap_or_default(),
        }
    }
}

impl From<crate::db::Company> for Company {
    fn from(r: crate::db::Company) -> Self {
        Company {
            id: r.id,
            name: r.name,
            national_id: r.national_id.unwrap_or_default(),
            economic_code: r.economic_code.unwrap_or_default(),
            registration_number: r.registration_number.unwrap_or_default(),
            address: r.address.unwrap_or_default(),
            phone: r.phone.unwrap_or_default(),
            email: r.email.unwrap_or_default(),
            website: r.website.unwrap_or_default(),
            fiscal_year_start: String::new(),
            created_at: r.created_at,
        }
    }
}

#[tauri::command]
pub fn get_companies(db: State<Database>) -> Result<Vec<Company>, String> {
    db.list_companies()
        .map(|rows| rows.into_iter().map(Company::from).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_company(db: State<Database>, id: i64) -> Result<Company, String> {
    db.get_company(id)
        .map(Company::from)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_current_company(db: State<Database>) -> Result<Company, String> {
    db.get_current_company()
        .map(Company::from)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_company(
    db: State<Database>,
    name: String,
    national_id: Option<String>,
    economic_code: Option<String>,
    fiscal_year: String,
) -> Result<Company, String> {
    let db_company = db
        .create_company(&name, None, national_id.as_deref(), economic_code.as_deref(), None, None, None, None, None)
        .map_err(|e| e.to_string())?;

    db.seed_accounts_for_company(db_company.id).map_err(|e| e.to_string())?;
    db.create_fiscal_year(db_company.id, &fiscal_year).map_err(|e| e.to_string())?;

    Ok(Company::from(db_company))
}

#[tauri::command]
pub fn update_company(
    db: State<Database>,
    id: i64,
    name: String,
    national_id: Option<String>,
    economic_code: Option<String>,
    registration_number: Option<String>,
    address: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    website: Option<String>,
) -> Result<(), String> {
    db.update_company(
        id, &name,
        national_id.as_deref(),
        economic_code.as_deref(),
        registration_number.as_deref(),
        address.as_deref(), phone.as_deref(),
        email.as_deref(), website.as_deref(),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn switch_company(db: State<Database>, id: i64) -> Result<(), String> {
    db.switch_company(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_active_fiscal_year(db: State<Database>, company_id: i64, year: String) -> Result<(), String> {
    db.set_active_fiscal_year(company_id, &year).map_err(|e| e.to_string())
}
