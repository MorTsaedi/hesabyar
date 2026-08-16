/// Smoke test: Tax / VAT
///
/// Tests the full pipeline:
///   1. Open fresh DB, migrations apply automatically
///   2. Seed a company + fiscal year + VAT/WHT accounts
///   3. Read default tax settings (migration 010 inserted them)
///   4. Update settings (enable VAT + WHT, link accounts)
///   5. Per-product tax rate
///   6. Insert sale + purchase invoices with VAT amounts
///   7. Compute VAT summary for the period
///   8. Create tax return, record partial payment
///   9. Delete unfilled return (succeeds); filed return (rejected)

use hesabyar_lib::db::{Database, TaxSettings};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let tmp = std::env::temp_dir().join("hesabyar-tax-smoke");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;
    let db_path = tmp.join("test.db");
    let db = Database::new(db_path.to_str().unwrap())?;
    println!("=== Tax / VAT smoke test ===");
    println!("DB path: {}", db_path.display());

    // ----- 1. Read the auto-seeded tax settings (migration 010) -----
    let initial: TaxSettings = db.get_tax_settings()?;
    assert!(!initial.is_registered, "is_registered defaults false");
    assert!(initial.vat_rate > 0.0, "default rate seeded");
    println!(
        "[ok] initial settings: vat_enabled={}, default_rate={}",
        initial.is_registered, initial.vat_rate
    );

    // ----- 2. Create a company + fiscal year + VAT/WHT GL accounts -----
    let conn = db.conn.lock().unwrap();
    conn.execute_batch(
        "INSERT INTO companies (id, name, fiscal_year_start) VALUES (1, 'Tax Smoke Co', '01/01');
         INSERT INTO fiscal_years (id, company_id, name, start_date, end_date)
         VALUES (1, 1, '1404', '1404/01/01', '1404/12/29');",
    )?;
    drop(conn);
    println!("[ok] inserted company + fiscal year");

    let output_acc = db.create_account(
        1, "2103", "مالیات بر ارزش افزوده (فروش)", None, 3, "liability", None,
    )?;
    let input_acc = db.create_account(
        1, "1108", "مالیات بر ارزش افزوده (خرید)", None, 3, "asset", None,
    )?;
    let withholding_acc = db.create_account(
        1, "2104", "مالیات علی‌الحساب پرداختنی", None, 3, "liability", None,
    )?;
    println!(
        "[ok] seeded VAT/WHT accounts (output={output_acc} input={input_acc} wht={withholding_acc})"
    );

    // ----- 3. Update settings: enable VAT -----
    db.update_tax_settings(
        10.0,
        Some("VAT-REG-12345"),
        true,
    )?;
    let updated = db.get_tax_settings()?;
    assert!(updated.is_registered, "is_registered now true");
    assert_eq!(updated.vat_rate, 10.0);
    println!(
        "[ok] updated settings: rate={}, vat_number={:?}",
        updated.vat_rate, updated.vat_registration_number
    );

    // ----- 4. Per-product tax rate -----
    db.set_product_tax_rate(1, 10.0)?;
    println!("[ok] product 1 tax_rate = 10%");

    // ----- 5. Insert sale + purchase invoices with manual VAT amounts -----
    let conn = db.conn.lock().unwrap();
    conn.execute_batch(
        "INSERT INTO invoices (company_id, fiscal_year_id, type, number, date,
                               contact_id, subtotal, discount, tax, total,
                               description, status)
         VALUES (1, 1, 'sale', 'S-1001', '1404/01/15',
                 NULL, 1000, 0, 100, 1100,
                 'sale for smoke test', 'confirmed');
         INSERT INTO invoices (company_id, fiscal_year_id, type, number, date,
                               contact_id, subtotal, discount, tax, total,
                               description, status)
         VALUES (1, 1, 'purchase', 'P-1001', '1404/01/20',
                 NULL, 600, 0, 60, 660,
                 'purchase for smoke test', 'confirmed');",
    )?;
    drop(conn);
    println!("[ok] inserted sale (tax=100) + purchase (tax=60)");

    // ----- 6. Compute VAT summary for the period -----
    let summary = db.compute_vat_summary(1)?;
    println!(
        "[ok] vat summary: total_sales={} vat_on_sales={} net_vat={}",
        summary.total_sales,
        summary.vat_on_sales,
        summary.net_vat_payable
    );

    // ----- 7. Create tax return + partial payment -----
    let return_id = db.create_tax_return(
        "بهار ۱۴۰۴",
        summary.vat_on_sales,
        0.0,
        summary.net_vat_payable,
    )?;
    db.record_tax_payment(return_id.id, "1404/04/10", 20.0)?;
    let returns = db.get_tax_returns()?;
    assert_eq!(returns.len(), 1);
    let r = &returns[0];
    assert!((r.net_vat_payable - 40.0).abs() < 0.01);
    assert!(r.status == "draft");
    println!(
        "[ok] tax return id={} payable={} paid={:?}",
        return_id.id, r.net_vat_payable, r.paid_amount
    );

    // ----- 8. Delete unfilled return -> ok -----
    db.delete_tax_return(return_id.id)?;
    let returns_after = db.get_tax_returns()?;
    assert_eq!(returns_after.len(), 0);
    println!("[ok] unfilled return deleted");

    // ----- 9. File a return and attempt to delete -> rejected -----
    let rid2 = db.create_tax_return(
        "تابستان ۱۴۰۴",
        100.0,
        60.0,
        40.0,
    )?;
    db.record_tax_payment(rid2.id, "1404/07/10", 40.0)?;
    let deleted = db.delete_tax_return(rid2.id);
    assert!(
        deleted.is_err(),
        "deleting a filed return should fail; got {deleted:?}"
    );
    println!("[ok] filed return cannot be deleted (error: {:?})", deleted.err());

    println!("=== Tax / VAT smoke test PASSED ===");
    Ok(())
}
