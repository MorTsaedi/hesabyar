pub mod commands;
pub mod db;
pub mod moadian;

use db::Database;
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Use a default database path for MVP
    let db_path = get_default_db_path();

    let database = Database::new(db_path.to_str().expect("Invalid database path"))
        .expect("Failed to initialize database");

    // Seed default accounts for company 1 if not already seeded
    seed_default_accounts(&database);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(database)
        .invoke_handler(tauri::generate_handler![
            commands::accounts::get_accounts,
            commands::accounts::create_account,
            commands::accounts::update_account,
            commands::accounts::delete_account,
            commands::journal::get_journal_entries,
            commands::journal::get_journal_entry,
            commands::journal::create_journal_entry,
            commands::journal::update_journal_entry,
            commands::journal::delete_journal_entry,
            commands::journal::get_account_balance,
            commands::reports::get_trial_balance,
            commands::reports::get_trial_balance_comparison,
            commands::reports::get_financial_report_comparison,
            commands::reports::get_general_ledger,
            commands::reports::get_financial_report,
            commands::reports::get_cash_flow_statement,
            commands::reports::get_balance_sheet_details,
            commands::reports::get_income_statement_details,
            commands::contacts::get_contacts,
            commands::contacts::create_contact,
            commands::contacts::update_contact,
            commands::contacts::delete_contact,
            commands::contacts::get_contact,
            commands::contacts::search_contacts,
            commands::invoices::get_invoices,
            commands::invoices::get_invoice,
            commands::invoices::create_invoice,
            commands::invoices::update_invoice,
            commands::invoices::delete_invoice,
            commands::invoices::update_invoice_status,
            commands::invoices::search_invoices,
            commands::products::get_products,
            commands::products::search_products,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::delete_product,
            commands::company::get_current_company,
            commands::company::update_company,
            commands::company::get_companies,
            commands::company::get_company,
            commands::company::create_company,
            commands::company::switch_company,
            commands::company::set_active_fiscal_year,
            commands::recurring::get_recurring_entries,
            commands::recurring::create_recurring_entry,
            commands::recurring::update_recurring_entry,
            commands::recurring::delete_recurring_entry,
            commands::recurring::generate_entries_from_recurring,
            commands::opening_closing::generate_opening_entry,
            commands::opening_closing::generate_closing_entry,
            commands::opening_closing::generate_opening_closing_entries,
            commands::opening_closing::get_period_status,
            commands::aging::get_receivables_aging,
            commands::aging::get_payables_aging,
            commands::aging::get_aging_summary,
            commands::backup::get_database_info,
            commands::backup::list_backups,
            commands::backup::create_backup,
            commands::backup::restore_backup,
            commands::backup::delete_backup,
            commands::moadian::get_moadian_config,
            commands::moadian::save_moadian_config,
            commands::moadian::save_moadian_credentials,
            commands::moadian::clear_moadian_credentials,
            commands::moadian::test_moadian_connection,
            commands::moadian::dry_run_invoice_packet,
            commands::moadian::send_invoice_to_moadian,
            commands::moadian::inquiry_invoice_status,
            commands::inventory::get_inventory_method,
            commands::inventory::set_inventory_method,
            commands::inventory::get_inventory_valuation,
            commands::inventory::get_product_kardex,
            commands::inventory::record_inventory_adjustment,
            commands::inventory::set_stock_levels,
            commands::inventory::get_low_stock_products,
            commands::inventory::get_overstocked_products,
            commands::inventory::get_stock_status_report,
            commands::invoices::get_overdue_invoices,
            commands::invoices::update_contact_payment_terms,
            commands::invoices::calculate_early_payment_discount,
            commands::invoices::calculate_late_payment_penalty,
            commands::invoices::record_invoice_payment,
            commands::invoices::update_contact_discounts,
            commands::currency::set_exchange_rate,
            commands::currency::get_exchange_rate,
            commands::currency::get_exchange_rates,
            commands::currency::get_foreign_currency_accounts,
            commands::currency::get_account_balance_as_of,
            commands::currency::perform_currency_revaluation,
            commands::currency::get_revaluation_history,
            commands::tax::get_tax_settings,
            commands::tax::update_tax_settings,
            commands::tax::set_product_tax_rate,
            commands::tax::compute_vat_summary,
            commands::tax::get_tax_returns,
            commands::tax::create_tax_return,
            commands::tax::record_tax_payment,
            commands::tax::delete_tax_return,
            commands::banking::get_bank_accounts,
            commands::banking::upsert_bank_account,
            commands::banking::delete_bank_account,
            commands::banking::get_receipt_vouchers,
            commands::banking::create_receipt_voucher,
            commands::banking::delete_receipt_voucher,
            commands::banking::get_payment_vouchers,
            commands::banking::create_payment_voucher,
            commands::banking::delete_payment_voucher,
            commands::budget::get_budget_periods,
            commands::budget::create_budget_period,
            commands::budget::delete_budget_period,
            commands::budget::get_budget_entries,
            commands::budget::upsert_budget_entry,
            commands::budget::delete_budget_entry,
            commands::budget::get_budget_vs_actual,
            commands::payroll::get_employees,
            commands::payroll::create_employee,
            commands::payroll::update_employee,
            commands::payroll::delete_employee,
            commands::payroll::get_salary_templates,
            commands::payroll::create_salary_template,
            commands::payroll::delete_salary_template,
            commands::payroll::get_salary_template_items,
            commands::payroll::upsert_salary_template_item,
            commands::payroll::delete_salary_template_item,
            commands::payroll::get_payroll_periods,
            commands::payroll::create_payroll_period,
            commands::payroll::close_payroll_period,
            commands::payroll::delete_payroll_period,
            commands::payroll::get_payroll_entries,
            commands::payroll::calculate_payroll_entry,
            commands::payroll::approve_payroll_entry,
            commands::payroll::get_salary_payments,
            commands::payroll::record_salary_payment,
            commands::fixed_assets::get_fixed_assets,
            commands::fixed_assets::create_fixed_asset,
            commands::fixed_assets::update_fixed_asset,
            commands::fixed_assets::delete_fixed_asset,
            commands::fixed_assets::get_depreciation_summaries,
            commands::fixed_assets::record_depreciation,
            commands::fixed_assets::get_depreciation_history,
            commands::fixed_assets::dispose_asset,
            commands::checks::get_checks,
            commands::checks::create_check,
            commands::checks::update_check,
            commands::checks::delete_check,
            commands::checks::update_check_status,
            commands::checks::get_check_summary,
            commands::checks::get_due_checks,
            commands::reconciliation::get_bank_statement_entries,
            commands::reconciliation::add_bank_statement_entry,
            commands::reconciliation::delete_bank_statement_entry,
            commands::reconciliation::reconcile_statement_entry,
            commands::reconciliation::unreconcile_statement_entry,
            commands::reconciliation::get_reconciliation_summary,
            commands::reconciliation::get_unmatched_vouchers,
            commands::price_lists::get_price_lists,
            commands::price_lists::create_price_list,
            commands::price_lists::update_price_list,
            commands::price_lists::delete_price_list,
            commands::price_lists::get_price_list_items,
            commands::price_lists::upsert_price_list_item,
            commands::price_lists::delete_price_list_item,
            commands::audit::get_audit_log,
            commands::audit::get_audit_entities,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_default_db_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    let mut path = PathBuf::from(home);
    path.push("HesabYar");
    path.push("data");
    path.push("hesabyar.db");
    path
}

fn seed_default_accounts(db: &Database) {
    // Check if accounts already exist
    if let Ok(accounts) = db.get_accounts(1) {
        if !accounts.is_empty() {
            return; // Already seeded
        }
    }

    let conn = db.conn.lock().unwrap();

    // Create default company
    conn.execute_batch("
        INSERT OR IGNORE INTO companies (id, name, fiscal_year_start)
        VALUES (1, 'شرکت من', '01/01');

        INSERT OR IGNORE INTO fiscal_years (company_id, name, start_date, end_date)
        VALUES (1, '1404', '1404/01/01', '1404/12/29');

        INSERT OR IGNORE INTO app_settings (id) VALUES (1);
    ").ok();

    // Build seed accounts directly in Rust (avoid subquery issues)
    // Level 1: Main groups
    let level1: Vec<(&str, &str, &str)> = vec![
        ("1", "دارایی‌ها", "asset"),
        ("2", "بدهی‌ها", "liability"),
        ("3", "حقوق صاحبان سرمایه", "equity"),
        ("4", "درآمدها", "revenue"),
        ("5", "هزینه‌ها", "expense"),
    ];

    let _parent_ids: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    for (code, name, atype) in &level1 {
        conn.execute(
            "INSERT OR IGNORE INTO accounts (company_id, code, name, level, type) VALUES (1, ?1, ?2, 1, ?3)",
            rusqlite::params![code, name, atype],
        ).ok();
    }

    // Level 2
    let level2: Vec<(&str, &str, &str, &str)> = vec![
        ("11", "دارایی‌های جاری", "asset", "1"),
        ("12", "دارایی‌های غیرجاری", "asset", "1"),
        ("21", "بدهی‌های جاری", "liability", "2"),
        ("22", "بدهی‌های غیرجاری", "liability", "2"),
        ("31", "سرمایه", "equity", "3"),
        ("32", "اندوخته‌ها و سود و زیان", "equity", "3"),
        ("41", "درآمدهای عملیاتی", "revenue", "4"),
        ("42", "درآمدهای غیرعملیاتی", "revenue", "4"),
        ("51", "هزینه‌های عملیاتی", "expense", "5"),
        ("52", "هزینه‌های غیرعملیاتی", "expense", "5"),
    ];

    for (code, name, atype, parent_code) in &level2 {
        let parent_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM accounts WHERE company_id = 1 AND code = ?1",
                rusqlite::params![parent_code],
                |row| row.get(0),
            )
            .ok();

        if let Some(pid) = parent_id {
            conn.execute(
                "INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type)
                 VALUES (1, ?1, ?2, ?3, 2, ?4)",
                rusqlite::params![code, name, pid, atype],
            ).ok();
        }
    }

    // Level 3: Detail accounts
    let level3: Vec<(&str, &str, &str, &str)> = vec![
        // Current assets
        ("1101", "موجودی نقد", "asset", "11"),
        ("1102", "بانک", "asset", "11"),
        ("1103", "حساب‌های دریافتنی", "asset", "11"),
        ("1104", "اسناد دریافتنی", "asset", "11"),
        ("1105", "چک‌های دریافتی", "asset", "11"),
        ("1106", "موجودی مواد و کالا", "asset", "11"),
        ("1107", "پیش‌پرداخت‌ها", "asset", "11"),
        ("1108", "سپرده‌ها", "asset", "11"),
        // Non-current assets
        ("1201", "زمین", "asset", "12"),
        ("1202", "ساختمان", "asset", "12"),
        ("1203", "تأسیسات", "asset", "12"),
        ("1204", "ماشین‌آلات و تجهیزات", "asset", "12"),
        ("1205", "وسایل نقلیه", "asset", "12"),
        ("1206", "اثاثه و لوازم اداری", "asset", "12"),
        ("1207", "سرقفلی و حق امتیاز", "asset", "12"),
        ("1208", "استهلاک انباشته", "contra", "12"),
        // Current liabilities
        ("2101", "حساب‌های پرداختنی", "liability", "21"),
        ("2102", "اسناد پرداختنی", "liability", "21"),
        ("2103", "چک‌های پرداختنی", "liability", "21"),
        ("2104", "حقوق و دستمزد پرداختنی", "liability", "21"),
        ("2105", "مالیات پرداختنی", "liability", "21"),
        ("2106", "سهم بیمه پرداختنی", "liability", "21"),
        ("2107", "پیش‌دریافت‌ها", "liability", "21"),
        // Non-current liabilities
        ("2201", "تسهیلات مالی بلندمدت", "liability", "22"),
        ("2202", "ذخیره مزایای پایان خدمت", "liability", "22"),
        // Equity
        ("3101", "سرمایه", "equity", "31"),
        ("3201", "اندوخته قانونی", "equity", "32"),
        ("3202", "سود (زیان) انباشته", "equity", "32"),
        ("3203", "سود (زیان) سال جاری", "equity", "32"),
        // Revenue
        ("4101", "فروش کالا و خدمات", "revenue", "41"),
        ("4102", "برگشت از فروش", "contra", "41"),
        ("4201", "درآمد سرمایه‌گذاری", "revenue", "42"),
        ("4202", "سایر درآمدها", "revenue", "42"),
        // Expenses
        ("5101", "قیمت تمام شده کالای فروش رفته", "expense", "51"),
        ("5102", "هزینه حقوق و دستمزد", "expense", "51"),
        ("5103", "هزینه اجاره", "expense", "51"),
        ("5104", "هزینه آب، برق و گاز", "expense", "51"),
        ("5105", "هزینه تلفن و ارتباطات", "expense", "51"),
        ("5106", "هزینه تعمیر و نگهداری", "expense", "51"),
        ("5107", "هزینه استهلاک", "expense", "51"),
        ("5108", "هزینه بیمه", "expense", "51"),
        ("5109", "هزینه تبلیغات و بازاریابی", "expense", "51"),
        ("5110", "هزینه حمل و نقل", "expense", "51"),
        ("5111", "هزینه اداری و عمومی", "expense", "51"),
        ("5201", "هزینه مالی (بهره)", "expense", "52"),
        ("5202", "هزینه جرایم", "expense", "52"),
        ("5203", "سایر هزینه‌ها", "expense", "52"),
    ];

    for (code, name, atype, parent_code) in &level3 {
        let parent_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM accounts WHERE company_id = 1 AND code = ?1",
                rusqlite::params![parent_code],
                |row| row.get(0),
            )
            .ok();

        if let Some(pid) = parent_id {
            conn.execute(
                "INSERT OR IGNORE INTO accounts (company_id, code, name, parent_id, level, type)
                 VALUES (1, ?1, ?2, ?3, 3, ?4)",
                rusqlite::params![code, name, pid, atype],
            ).ok();
        }
    }
}
