// Smoke test: New modules — Payroll, Fixed Assets, Checks, Bank Reconciliation,
// Price Lists, Audit Trail.
//
// Verifies end-to-end CRUD and business logic for each new module against a
// fresh temporary database.

use hesabyar_lib::db::Database;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let tmp = std::env::temp_dir().join("hesabyar-new-modules-smoke");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;
    let db_path = tmp.join("test.db");
    let db = Database::new(db_path.to_str().unwrap())?;
    println!("=== New modules smoke test ===");

    // ----- Seed company + fiscal year + accounts -----
    let conn = db.conn.lock().unwrap();
    conn.execute_batch(
        "INSERT INTO companies (id, name, fiscal_year_start) VALUES (1, 'NewCo', '01/01');
         INSERT INTO fiscal_years (id, company_id, name, start_date, end_date)
         VALUES (1, 1, '1404', '1404/01/01', '1404/12/29');",
    )?;
    drop(conn);
    let bank_acc = db.create_account(1, "1102", "بانک", None, 3, "asset", None)?;
    let ar = db.create_account(1, "1103", "حساب‌های دریافتنی", None, 3, "asset", None)?;
    let expense = db.create_account(1, "5101", "هزینه عملیاتی", None, 3, "expense", None)?;
    let _ = (bank_acc.id, ar.id, expense.id);

    // ==================== PAYROLL ====================
    println!("\n--- Payroll ---");
    let emp = db.create_employee(1, "1001", "علی", "رضایی", Some("001"), None, None, None,
        "1403/01/01", 25_000_000.0, 1_000_000.0, 30)?;
    assert_eq!(db.get_employees(1)?.len(), 1);
    println!("[ok] employee created: {} {}", emp.first_name, emp.last_name);

    let tpl = db.create_salary_template(1, "قالب ماهانه", Some("مزایا + کسورات"))?;
    db.upsert_salary_template_item(tpl.id, "allowance", "بن و مسکن", "fixed", 2_000_000.0, 1, "base")?;
    db.upsert_salary_template_item(tpl.id, "deduction", "جریمه", "fixed", 100_000.0, 2, "base")?;
    assert_eq!(db.get_salary_template_items(tpl.id)?.len(), 2);
    println!("[ok] salary template + items created");

    let period = db.create_payroll_period(1, "فروردین ۱۴۰۴", "1404/01/01", "1404/01/31")?;
    let entry = db.calculate_payroll_entry(period.id, emp.id, Some(tpl.id), 30, None)?;
    assert!((entry.gross_salary - 27_000_000.0).abs() < 0.01, "gross = base + allowances");
    assert!((entry.employee_insurance - 1_750_000.0).abs() < 0.01, "insurance = 7% of base");
    assert!((entry.employer_insurance - 5_750_000.0).abs() < 0.01, "employer insurance = 23% of base");
    println!("[ok] payroll entry calculated: gross={} net={}", entry.gross_salary, entry.net_salary);

    db.approve_payroll_entry(entry.id)?;
    let views = db.get_payroll_entries_view(period.id)?;
    assert_eq!(views.len(), 1);
    assert_eq!(views[0].employee_name, "علی رضایی");
    println!("[ok] payroll entry view joined with employee name");

    let summaries = db.get_payroll_period_summaries(1)?;
    assert_eq!(summaries.len(), 1);
    assert!((summaries[0].gross_total - 27_000_000.0).abs() < 0.01);
    println!("[ok] payroll period summary: {} employees, gross={}", summaries[0].employee_count, summaries[0].gross_total);

    let pay = db.record_salary_payment(entry.id, "1404/02/05", entry.net_salary, "bank", Some("PAY-1"))?;
    assert!(pay.amount > 0.0);
    println!("[ok] salary payment recorded");

    // ==================== FIXED ASSETS ====================
    println!("\n--- Fixed Assets ---");
    let asset = db.create_fixed_asset(1, "FA-001", "ماشین‌آلات", Some("تجهیزات"), "1403/01/01",
        120_000_000.0, 5, 0.0, "straight_line", None, None)?;
    let monthly = db.monthly_depreciation(&asset);
    assert!((monthly - 2_000_000.0).abs() < 0.01, "120M / 60 months = 2M");
    println!("[ok] straight-line monthly depreciation = {}", monthly);

    let run = db.record_depreciation(asset.id, "1404/01")?;
    assert!((run.amount - 2_000_000.0).abs() < 0.01);
    let run2 = db.record_depreciation(asset.id, "1404/02")?;
    assert!((run2.amount - 2_000_000.0).abs() < 0.01);
    let assets_after = db.get_fixed_assets(1)?;
    assert!((assets_after[0].accumulated_depreciation - 4_000_000.0).abs() < 0.01);
    assert!((assets_after[0].book_value - 116_000_000.0).abs() < 0.01);
    println!("[ok] depreciation accumulated = 4M, book value = {}", assets_after[0].book_value);

    let sums = db.get_depreciation_summaries(1)?;
    assert_eq!(sums.len(), 1);
    assert!((sums[0].monthly_depreciation - 2_000_000.0).abs() < 0.01);
    println!("[ok] depreciation summary: {} months remaining", sums[0].remaining_months);

    let history = db.get_depreciation_history(asset.id)?;
    assert_eq!(history.len(), 2);
    println!("[ok] depreciation history has {} runs", history.len());

    // Declining balance asset
    let db_asset = db.create_fixed_asset(1, "FA-002", "خودرو", None, "1403/01/01",
        100_000_000.0, 5, 10_000_000.0, "declining_balance", None, None)?;
    let db_monthly = db.monthly_depreciation(&db_asset);
    assert!(db_monthly > 0.0 && db_monthly < 100_000_000.0);
    println!("[ok] declining-balance monthly depreciation = {}", db_monthly);

    let disposed = db.dispose_asset(asset.id, "disposed")?;
    assert_eq!(disposed.status, "disposed");
    assert!((disposed.accumulated_depreciation - disposed.purchase_cost).abs() < 0.01);
    println!("[ok] asset disposed");

    // ==================== CHECKS ====================
    println!("\n--- Checks ---");
    let check_id = db.create_check(1, "received", "12345", Some("123"), Some("ملت"),
        5_000_000.0, "1404/01/01", "1404/03/15", None, Some("دریافت از مشتری"), None)?;
    let check_id2 = db.create_check(1, "issued", "54321", None, Some("ملی"),
        3_000_000.0, "1404/01/02", "1404/03/20", None, None, None)?;
    let checks = db.get_checks(1)?;
    assert_eq!(checks.len(), 2);
    assert!(checks.iter().any(|c| c.r#type == "received") && checks.iter().any(|c| c.r#type == "issued"));
    println!("[ok] checks created: {} total", checks.len());

    db.update_check_status(check_id, "passed")?;
    let summary = db.get_check_summary(1, "1404/03/01")?;
    assert_eq!(summary.passed, 1);
    assert_eq!(summary.pending, 1);
    assert!(summary.due_soon >= 1, "due-soon window should catch 1404/03/15-20");
    println!("[ok] check summary: passed={} pending={} dueSoon={}", summary.passed, summary.pending, summary.due_soon);

    let due = db.get_due_checks(1, "1404/03/01")?;
    assert_eq!(due.len(), 1, "only check due 03/15 is within the 14-day window");
    assert_eq!(due[0].check_number, "12345");
    println!("[ok] due checks: {} (reminders)", due.len());

    db.update_check_status(check_id, "returned")?;
    let summary2 = db.get_check_summary(1, "1404/03/01")?;
    assert_eq!(summary2.returned, 1);
    db.update_check_status(check_id2, "cashed")?;
    println!("[ok] check status transitions verified");

    // ==================== BANK RECONCILIATION ====================
    println!("\n--- Bank Reconciliation ---");
    db.upsert_bank_account(None, 1, bank_acc.id, "ملت", Some("مرکزی"), Some("111"), Some("IR1"), None, None)?;
    let banks = db.get_bank_accounts(1)?;
    assert_eq!(banks.len(), 1);
    let bank_row_id = banks[0].id;
    println!("[ok] bank account upserted (id={})", bank_row_id);

    let s1 = db.add_bank_statement_entry(bank_row_id, "1404/01/10", "واریز مشتری", 10_000_000.0, Some("REF-1"))?;
    let s2 = db.add_bank_statement_entry(bank_row_id, "1404/01/12", "برداشت اجاره", -2_000_000.0, Some("REF-2"))?;
    let entries = db.get_bank_statement_entries(bank_row_id)?;
    assert_eq!(entries.len(), 2);
    assert!(!entries[0].is_reconciled);
    println!("[ok] statement entries added: {} total", entries.len());

    let receipt = db.create_receipt_voucher(1, bank_acc.id, 10_000_000.0, Some("مشتری"), Some("دریافت"), "1404/01/10", Some("REC-1"))?;
    let entry_id = receipt.journal_entry_id.ok_or("receipt should create journal entry")?;
    assert!(entry_id > 0);
    println!("[ok] receipt voucher created with journal entry {}", entry_id);

    db.reconcile_statement_entry(s1, receipt.id, "receipt")?;
    let entries2 = db.get_bank_statement_entries(bank_row_id)?;
    let matched = entries2.iter().find(|e| e.id == s1).unwrap();
    assert!(matched.is_reconciled);
    assert_eq!(matched.linked_voucher_id, Some(receipt.id));
    println!("[ok] statement entry reconciled against receipt voucher");

    let summary_rec = db.get_reconciliation_summary(bank_row_id)?;
    assert_eq!(summary_rec.statement_entries, 2);
    assert_eq!(summary_rec.unreconciled_entries, 1);
    println!("[ok] reconciliation summary: GL balance={} diff={}", summary_rec.gl_balance, summary_rec.difference);

    let unmatched = db.get_unmatched_vouchers(bank_row_id)?;
    assert_eq!(unmatched.len(), 0, "receipt already matched; no unmatched vouchers");
    println!("[ok] unmatched vouchers check (matched = excluded)");

    db.unreconcile_statement_entry(s1)?;
    let entries3 = db.get_bank_statement_entries(bank_row_id)?;
    assert!(!entries3.iter().find(|e| e.id == s1).unwrap().is_reconciled);
    println!("[ok] unreconcile works");

    db.delete_bank_statement_entry(s2)?;
    assert_eq!(db.get_bank_statement_entries(bank_row_id)?.len(), 1);
    println!("[ok] statement entry deleted");

    // ==================== PRICE LISTS ====================
    println!("\n--- Price Lists ---");
    let product = db.create_product(1, "قلم", Some("P-001"), "product", Some("عدد"), 3_000.0, 5_000.0, None, None, None, None, 0.0, None)?;
    let list_id = db.create_price_list(1, "قیمت عمده", "sale", true)?;
    let list2_id = db.create_price_list(1, "قیمت نمایندگی", "sale", false)?;
    db.upsert_price_list_item(list_id, product.id, 4_200.0)?;
    db.upsert_price_list_item(list_id, product.id, 4_300.0)?; // upsert (same product)
    let items = db.get_price_list_items(list_id)?;
    assert_eq!(items.len(), 1, "upsert should overwrite");
    assert!((items[0].price - 4_300.0).abs() < 0.01);
    println!("[ok] price list items: {} (upsert works)", items.len());

    let lists = db.get_price_lists(1)?;
    assert_eq!(lists.len(), 2);
    let list2 = lists.iter().find(|l| l.id == list2_id).unwrap();
    assert!(!list2.is_default);
    println!("[ok] price lists created; default flag respected");

    db.delete_price_list_item(items[0].id)?;
    assert_eq!(db.get_price_list_items(list_id)?.len(), 0);
    db.delete_price_list(list2_id)?;
    assert_eq!(db.get_price_lists(1)?.len(), 1);
    println!("[ok] price list item + list deleted");

    // ==================== AUDIT TRAIL ====================
    println!("\n--- Audit Trail ---");
    db.log_audit(1, "create", "check", Some(check_id), "چک جدید ثبت شد", Some("{\"amount\": 5000000}"))?;
    db.log_audit(1, "update", "asset", Some(asset.id), "دارایی ویرایش شد", None)?;
    db.log_audit(1, "delete", "price_list", Some(list2_id), "لیست قیمت حذف شد", None)?;
    let log = db.get_audit_log(1, 100)?;
    // 3 manual entries + 3 automatic check-status entries
    assert_eq!(log.len(), 6);
    assert_eq!(log[0].action, "delete");
    assert_eq!(log[0].entity, "price_list");
    assert!(log.iter().any(|e| e.action == "status" && e.entity == "check"), "check status changes should be auto-logged");
    println!("[ok] audit log entries: {} (auto-logging works)", log.len());

    let entities = db.get_audit_entities(1)?;
    assert_eq!(entities.len(), 3);
    println!("[ok] audit entities: {:?}", entities);

    println!("\n=== ALL NEW MODULE SMOKE CHECKS PASSED ===");
    Ok(())
}
