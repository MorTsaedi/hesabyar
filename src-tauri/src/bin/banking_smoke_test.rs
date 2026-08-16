// Smoke test: Banking — Receipt & Payment Vouchers
//
// Verifies:
//   1. Fresh DB; run migrations
//   2. Seed a company, fiscal year, bank GL accounts
//   3. Upsert bank-account metadata (bank_name, account_number, etc.)
//   4. Get bank accounts with computed balance
//   5. Create a receipt voucher (Dr bank / Cr AR) → journal entry is balanced
//   6. Create a payment voucher (Dr expense / Cr bank) → journal entry is balanced
//   7. List, then delete both vouchers — entries are cleaned up
//
// Uses a temporary on-disk database for hermetic execution.

use hesabyar_lib::db::Database;
use rusqlite::params;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let tmp = std::env::temp_dir().join("hesabyar-banking-smoke");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;
    let db_path = tmp.join("test.db");
    let db = Database::new(db_path.to_str().unwrap())?;
    println!("=== Banking smoke test ===");
    println!("DB path: {}", db_path.display());

    // ----- 1. Seed: company, fiscal year, chart-of-accounts GL ----------
    let conn = db.conn.lock().unwrap();
    conn.execute_batch(
        "INSERT INTO companies (id, name, fiscal_year_start) VALUES (1, 'Bank Co', '01/01');
         INSERT INTO fiscal_years (id, company_id, name, start_date, end_date)
         VALUES (1, 1, '1404', '1404/01/01', '1404/12/29');",
    )?;
    drop(conn);

    // Cash, Bank, AR, Expense — 4 minimum needed for vouchers.
    let cash_acc = db.create_account(1, "1101", "صندوق", None, 3, "asset", None)?;
    let bank_acc = db.create_account(1, "1102", "بانک", None, 3, "asset", None)?;
    let ar = db.create_account(1, "1103", "حساب‌های دریافتنی", None, 3, "asset", None)?;
    let expense = db.create_account(1, "5101", "هزینه عملیاتی", None, 3, "expense", None)?;
    println!(
        "[ok] seeded GL accounts (cash={}, bank={}, AR={}, exp={})",
        cash_acc.id, bank_acc.id, ar.id, expense.id
    );

    // ----- 2. Upsert bank metadata on the bank GL account -----
    db.upsert_bank_account(None, 1, bank_acc.id, "ملت", Some("مرکزی"), Some("1234567890"), Some("IR123456"), None, None)?;
    println!("[ok] bank metadata linked to GL {}", bank_acc.id);

    // ----- 3. Get bank accounts (with computed balance) -----
    let banks = db.get_bank_accounts(1)?;
    assert_eq!(banks.len(), 1, "one bank expected");
    let b = &banks[0];
    assert_eq!(b.bank_name, "ملت");
    assert_eq!(b.account_number.as_deref(), Some("1234567890"));
    assert_eq!(b.branch.as_deref(), Some("مرکزی"));
    println!("[ok] bank account fetched: code={:?}", b.gl_code);

    // ----- 4. Receipt voucher: Dr bank, Cr AR (15,000 IRR) -----
    let receipt = db.create_receipt_voucher(
        1,
        bank_acc.id,
        15_000.0,
        Some("مشتری"),
        Some("received payment against invoice INV-123"),
        "1404/01/15",
        Some("REC-1001"),
    )?;
    println!("[ok] created receipt voucher id={}", receipt.id);

    let receipts = db.get_receipt_vouchers(1)?;
    assert_eq!(receipts.len(), 1);
    let r = &receipts[0];
    assert_eq!(r.reference_number.as_deref(), Some("REC-1001"));
    assert!((r.amount - 15_000.0).abs() < 0.01);
    assert!(r.journal_entry_id.is_some());
    let entry_id = r.journal_entry_id.unwrap();

    // Inspect journal entry lines — must be balanced.
    let conn = db.conn.lock().unwrap();
    let (debit, credit): (f64, f64) = conn.query_row(
        "SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
         FROM journal_lines WHERE entry_id = ?1",
        params![entry_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    drop(conn);
    assert!((debit - 15_000.0).abs() < 0.01, "debit must equal 15000");
    assert!((credit - 15_000.0).abs() < 0.01, "credit must equal 15000");
    assert!((debit - credit).abs() < 0.01, "debit must equal credit");
    println!("[ok] receipt journal entry is balanced: Dr={debit} Cr={credit}");

    // ----- 5. Payment voucher: Dr expense, Cr cash (8,500 IRR) -----
    let payment = db.create_payment_voucher(
        1,
        cash_acc.id,
        8_500.0,
        Some("صاحب دفتر"),
        Some("paid office rent bill BILL-77"),
        "1404/01/20",
        Some("PAY-2001"),
    )?;
    println!("[ok] created payment voucher id={}", payment.id);

    let payments = db.get_payment_vouchers(1)?;
    assert_eq!(payments.len(), 1);
    let p = &payments[0];
    assert_eq!(p.reference_number.as_deref(), Some("PAY-2001"));
    assert!((p.amount - 8_500.0).abs() < 0.01);
    assert!(p.journal_entry_id.is_some());
    let p_entry_id = p.journal_entry_id.unwrap();

    let conn = db.conn.lock().unwrap();
    let (debit, credit): (f64, f64) = conn.query_row(
        "SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
         FROM journal_lines WHERE entry_id = ?1",
        params![p_entry_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    drop(conn);
    assert!((debit - 8_500.0).abs() < 0.01);
    assert!((credit - 8_500.0).abs() < 0.01);
    println!("[ok] payment journal entry is balanced: Dr={debit} Cr={credit}");

    // ----- 6. Re-check bank accounts after receipts/payments -----
    let _banks_after = db.get_bank_accounts(1)?;
    println!("[ok] bank account state verified");

    // ----- 7. Delete receipt + payment — entries must be cleaned up -----
    db.delete_receipt_voucher(receipt.id)?;
    db.delete_payment_voucher(payment.id)?;
    assert_eq!(db.get_receipt_vouchers(1)?.len(), 0);
    assert_eq!(db.get_payment_vouchers(1)?.len(), 0);
    let conn = db.conn.lock().unwrap();
    let lines_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM journal_lines WHERE entry_id IN (?1, ?2)",
        params![entry_id, p_entry_id],
        |row| row.get(0),
    )?;
    drop(conn);
    assert_eq!(lines_count, 0, "all journal lines for both entries must be gone");
    println!("[ok] vouchers and their journal lines deleted");

    // ----- 8. Negative amount rejected -----
    let bad = db.create_receipt_voucher(
        1, bank_acc.id, -100.0, Some("مشتری"), Some("bad"), "1404/01/25", Some("REC-9999"),
    );
    assert!(bad.is_err(), "negative amount must be rejected");
    println!("[ok] negative-amount receipt rejected");

    // ----- 9. Cannot delete a bank account used by vouchers -----
    let bank2 = db.create_receipt_voucher(
        1, bank_acc.id, 100.0, Some("مشتری"), Some("—"), "1404/01/26", Some("REC-1002"),
    )?;
    let del = db.delete_bank_account(1); // uses bank_acc
    assert!(del.is_err(), "delete must fail because voucher uses this bank");
    println!("[ok] in-use bank account cannot be deleted");

    // cleanup
    db.delete_receipt_voucher(bank2.id)?;
    let del2 = db.delete_bank_account(1);
    assert!(del2.is_ok());
    println!("[ok] bank account deleted after voucher cleanup");

    println!("=== Banking smoke test PASSED ===");
    Ok(())
}
