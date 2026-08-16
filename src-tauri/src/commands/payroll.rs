#![allow(non_snake_case)]

//! Payroll — Employees, salary templates, payroll periods & payslips.

use crate::db::{Database, Employee, PayrollEntry, PayrollEntryView, PayrollPeriod, PayrollPeriodSummary, SalaryPayment, SalaryTemplate, SalaryTemplateItem};
use tauri::State;

// ==================== EMPLOYEES ====================

#[tauri::command]
pub fn get_employees(db: State<Database>, companyId: i64) -> Result<Vec<Employee>, String> {
    db.get_employees(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_employee(
    db: State<Database>,
    companyId: i64,
    code: String,
    firstName: String,
    lastName: String,
    nationalId: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    hireDate: String,
    baseSalary: f64,
    dailyWage: f64,
    insuranceDays: i32,
) -> Result<Employee, String> {
    db.create_employee(
        companyId, &code, &firstName, &lastName,
        nationalId.as_deref(), phone.as_deref(), email.as_deref(), address.as_deref(),
        &hireDate, baseSalary, dailyWage, insuranceDays,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_employee(
    db: State<Database>,
    id: i64,
    code: String,
    firstName: String,
    lastName: String,
    nationalId: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    hireDate: String,
    baseSalary: f64,
    dailyWage: f64,
    insuranceDays: i32,
    status: String,
) -> Result<(), String> {
    db.update_employee(
        id, &code, &firstName, &lastName,
        nationalId.as_deref(), phone.as_deref(), email.as_deref(), address.as_deref(),
        &hireDate, baseSalary, dailyWage, insuranceDays, &status,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_employee(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_employee(id).map_err(|e| e.to_string())
}

// ==================== SALARY TEMPLATES ====================

#[tauri::command]
pub fn get_salary_templates(db: State<Database>, companyId: i64) -> Result<Vec<SalaryTemplate>, String> {
    db.get_salary_templates(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_salary_template(
    db: State<Database>,
    companyId: i64,
    name: String,
    description: Option<String>,
) -> Result<SalaryTemplate, String> {
    db.create_salary_template(companyId, &name, description.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_salary_template(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_salary_template(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_salary_template_items(db: State<Database>, templateId: i64) -> Result<Vec<SalaryTemplateItem>, String> {
    db.get_salary_template_items(templateId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_salary_template_item(
    db: State<Database>,
    templateId: i64,
    r#type: String,
    name: String,
    calculationType: String,
    value: f64,
    priority: i32,
    basedOn: String,
) -> Result<SalaryTemplateItem, String> {
    db.upsert_salary_template_item(templateId, &r#type, &name, &calculationType, value, priority, &basedOn)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_salary_template_item(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_salary_template_item(id).map_err(|e| e.to_string())
}

// ==================== PAYROLL PERIODS ====================

#[tauri::command]
pub fn get_payroll_periods(db: State<Database>, companyId: i64) -> Result<Vec<PayrollPeriodSummary>, String> {
    db.get_payroll_period_summaries(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_payroll_period(
    db: State<Database>,
    companyId: i64,
    name: String,
    startDate: String,
    endDate: String,
) -> Result<PayrollPeriod, String> {
    db.create_payroll_period(companyId, &name, &startDate, &endDate)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_payroll_period(db: State<Database>, id: i64) -> Result<(), String> {
    db.close_payroll_period(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_payroll_period(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_payroll_period(id).map_err(|e| e.to_string())
}

// ==================== PAYROLL ENTRIES ====================

#[tauri::command]
pub fn get_payroll_entries(db: State<Database>, periodId: i64) -> Result<Vec<PayrollEntryView>, String> {
    db.get_payroll_entries_view(periodId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calculate_payroll_entry(
    db: State<Database>,
    periodId: i64,
    employeeId: i64,
    templateId: Option<i64>,
    workingDays: i32,
    notes: Option<String>,
) -> Result<PayrollEntry, String> {
    db.calculate_payroll_entry(periodId, employeeId, templateId, workingDays, notes.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn approve_payroll_entry(db: State<Database>, id: i64) -> Result<(), String> {
    db.approve_payroll_entry(id).map_err(|e| e.to_string())
}

// ==================== SALARY PAYMENTS ====================

#[tauri::command]
pub fn get_salary_payments(db: State<Database>, payrollEntryId: i64) -> Result<Vec<SalaryPayment>, String> {
    db.get_salary_payments(payrollEntryId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn record_salary_payment(
    db: State<Database>,
    payrollEntryId: i64,
    paidDate: String,
    amount: f64,
    method: String,
    reference: Option<String>,
) -> Result<SalaryPayment, String> {
    db.record_salary_payment(payrollEntryId, &paidDate, amount, &method, reference.as_deref())
        .map_err(|e| e.to_string())
}
