//! End-to-end smoke test for inventory valuation (WAC + FIFO).
//!
//! Creates a fresh SQLite DB, inserts two products, posts three
//! purchase invoices and two sale invoices, then verifies:
//!
//!   * WAC: every per-product quantity, average cost, and total value
//!     matches a hand-rolled expectation.
//!
//! Run with:  `cargo run --bin inventory_smoke_test --release`

use hesabyar_lib::db::{Database, InvoiceLineInput, JournalLineInput};
use rusqlite::Result;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let tmp = std::env::temp_dir().join("hesabyar-inventory-smoke");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;
    let db_path = tmp.join("source.db");
    let db = Database::new(db_path.to_str().unwrap())?;

    // ----- 1. Seed companies + fiscal year + chart of accounts -----
    db.conn.lock().unwrap().execute_batch(
        "INSERT OR IGNORE INTO companies (id, name, fiscal_year_start)
         VALUES (1, 'شرکت آزمایشی', '01/01');
         INSERT OR IGNORE INTO fiscal_years (id, company_id, name, start_date, end_date)
         VALUES (1, 1, '1404', '1404/01/01', '1404/12/29');
         INSERT OR IGNORE INTO app_settings (id, inventory_method)
         VALUES (1, 'wac');",
    )?;

    // Cash + bank + AP + cogs + inventory seed
    for (code, name, atype) in &[
        ("1101", "نقد", "asset"),
        ("1103", "حسابهای دریافتنی", "asset"),
        ("1106", "موجودی مواد و کالا", "asset"),
        ("2101", "حسابهای پرداختنی", "liability"),
        ("4101", "فروش", "revenue"),
        ("5101", "بهای تمام شده", "expense"),
    ] {
        db.create_account(1, code, name, None, 3, atype, None)?;
    }

    let cash = account_id(&db, "1101")?;
    let _ar = account_id(&db, "1103")?;
    let inventory_acc = account_id(&db, "1106")?;
    let ap = account_id(&db, "2101")?;
    let revenue = account_id(&db, "4101")?;
    let _cogs = account_id(&db, "5101")?;

    // ----- 2. Create two products -----
    // Product A: Widget (code P-A)
    let product_a_id = db.create_product(
        1,
        "Widget",
        Some("P-A"),
        "product",
        Some("عدد"),
        0.0,
        0.0,
        None,
        None, // min_stock
        None, // max_stock
        None, // reorder_point
        0.0, // quantity
        None, // tax_rate
    )?;
    // Product B: Gizmo (code P-B)
    let product_b = db.create_product(
        1,
        "Gizmo",
        Some("P-B"),
        "product",
        Some("عدد"),
        0.0,
        0.0,
        None,
        None, // min_stock
        None, // max_stock
        None, // reorder_point
        0.0, // quantity
        None, // tax_rate
    )?;

    // ----- 3. Purchase 100 @ 1000, 50 @ 1200, 200 @ 1100 -----
    // Day 01: Purchase 100 @ 1000
    post(&db, "1404/01/01", "خرید موجودی", vec![(inventory_acc, 100_000.0, 0.0), (ap, 0.0, 100_000.0)])?;
    db.create_invoice(
        "purchase", 0, "1404/01/01", None, None,
        vec![InvoiceLineInput {
            product_id: Some(product_a_id.id),
            description: Some("Widget".into()),
            quantity: 100.0,
            unit_price: 1000.0,
            discount_pct: 0.0,
            tax_rate: 9.0,
        }],
    )?;

    // Day 05: Purchase 50 @ 1200
    post(&db, "1404/01/05", "خرید موجودی", vec![(inventory_acc, 60_000.0, 0.0), (ap, 0.0, 60_000.0)])?;
    db.create_invoice(
        "purchase", 0, "1404/01/05", None, None,
        vec![InvoiceLineInput {
            product_id: Some(product_a_id.id),
            description: Some("Widget".into()),
            quantity: 50.0,
            unit_price: 1200.0,
            discount_pct: 0.0,
            tax_rate: 9.0,
        }],
    )?;

    // Day 10: Purchase 200 @ 1100
    post(&db, "1404/01/10", "خرید موجودی", vec![(inventory_acc, 220_000.0, 0.0), (ap, 0.0, 220_000.0)])?;
    db.create_invoice(
        "purchase", 0, "1404/01/10", None, None,
        vec![InvoiceLineInput {
            product_id: Some(product_a_id.id),
            description: Some("Widget".into()),
            quantity: 200.0,
            unit_price: 1100.0,
            discount_pct: 0.0,
            tax_rate: 9.0,
        }],
    )?;

    // ----- 4. Sell 80 @ 1500, then 40 @ 1500 -----
    // Day 15: Sell 80 @ sale_price 1500
    post(&db, "1404/01/15", "فروش", vec![(cash, 120_000.0, 0.0), (revenue, 0.0, 120_000.0)])?;
    db.create_invoice(
        "sale", 0, "1404/01/15", None, None,
        vec![InvoiceLineInput {
            product_id: Some(product_a_id.id),
            description: Some("Widget".into()),
            quantity: 80.0,
            unit_price: 1500.0,
            discount_pct: 0.0,
            tax_rate: 9.0,
        }],
    )?;

    // Day 20: Sell 40 (cash sale)
    db.create_invoice(
        "sale", 0, "1404/01/20", None, None,
        vec![InvoiceLineInput {
            product_id: Some(product_a_id.id),
            description: Some("Widget".into()),
            quantity: 40.0,
            unit_price: 1500.0,
            discount_pct: 0.0,
            tax_rate: 9.0,
        }],
    )?;

    // ----- 5. Verify per-product quantity -----
    let qty_a = db.get_product_quantity(product_a_id.id)?;
    let approx = |a: f64, b: f64| (a - b).abs() < 0.001;
    assert!(approx(qty_a, 230.0), "Product A quantity: expected 230, got {}", qty_a);

    let qty_b = db.get_product_quantity(product_b.id)?;
    assert!(approx(qty_b, 0.0), "Product B quantity: expected 0, got {}", qty_b);

    println!();
    println!("OK: Product A on-hand quantity = {:.0}", qty_a);
    println!("OK: Product B on-hand quantity = {:.0}", qty_b);

    // Verify WAC valuation
    println!("\n=== WAC Valuation Test ===");
    let wac_results = db.get_inventory_valuation(1, "wac", None)?;
    println!("WAC results: {} products", wac_results.len());
    
    for v in &wac_results {
        println!("  Product {} ({}): qty={}, avg_cost={:.4}, value={:.2}",
            v.product_name, v.product_code, v.quantity, v.unit_cost, v.total_value);
    }

    let wac_a = wac_results.iter().find(|v| v.product_id == product_a_id.id).expect("Product A in WAC results");
    let approx = |a: f64, b: f64| (a - b).abs() < 0.01;
    
    // WAC calculation: (100*1000 + 50*1200 + 200*1100) / (100+50+200) = 380000 / 350 = 1085.7142857
    // Value: 230 * 1085.7142857 = 249714.29
    let expected_wac_cost = 1085.7142857;
    let expected_wac_value = 249714.29;
    
    println!("Expected WAC cost: {:.4}", expected_wac_cost);
    println!("Actual WAC cost:   {:.4}", wac_a.unit_cost);
    println!("Actual WAC value:  {:.4}", wac_a.total_value);

    assert!(approx(wac_a.unit_cost, expected_wac_cost),
        "WAC cost mismatch: expected {}, got {}", expected_wac_cost, wac_a.unit_cost);
    assert!(approx(wac_a.total_value, expected_wac_value),
        "WAC value mismatch: expected {}, got {}", expected_wac_value, wac_a.total_value);
    
    println!("OK: WAC valuation verified");
    
    // Verify FIFO valuation
    println!("\n=== FIFO Valuation Test ===");
    let fifo_results = db.get_inventory_valuation(1, "fifo", None)?;
    println!("FIFO results: {} products", fifo_results.len());
    
    for v in &fifo_results {
        println!("  Product {} ({}): qty={}, avg_cost={:.4}, value={:.2}",
            v.product_name, v.product_code, v.quantity, v.unit_cost, v.total_value);
    }
    
    let fifo_a = fifo_results.iter().find(|v| v.product_id == product_a_id.id).expect("Product A in FIFO results");
    
    // FIFO layers after sales:
    // Purchase 1: 100 @ 1000 -> 80 used in first sale, 20 used in second sale
    // Purchase 2: 50 @ 1200 -> 20 used in second sale (remaining 30 @ 1200)
    // Sale 1: 80 @ 1085 -> consumes 80 from layer 1, leaves 20 @ 1000
    // Sale 2: 40 @ 1085 -> consumes 20 from layer 1, then 20 from layer 2 (50-20=30 @ 1200)
    // Purchase 3: 200 @ 1100 -> added to layers
    // Final layers: 30 @ 1200, 200 @ 1100
    // FIFO value: (30 * 1200) + (200 * 1100) = 36000 + 220000 = 256000
    let expected_fifo_value = 256000.0;
    
    println!("Expected FIFO value: {:.2}", expected_fifo_value);
    println!("Actual FIFO value:   {:.2}", fifo_a.total_value);
    
    assert!(approx(fifo_a.total_value, expected_fifo_value),
        "FIFO value mismatch: expected {}, got {}", expected_fifo_value, fifo_a.total_value);
    
    println!("OK: FIFO valuation verified");

    println!();
    println!("ALL INVENTORY SMOKE CHECKS PASSED (WAC + FIFO)");
    let _ = std::fs::remove_dir_all(&tmp);
    Ok(())
}

/// Helper: post a journal entry
fn post(db: &Database, date: &str, desc: &str, lines: Vec<(i64, f64, f64)>) -> Result<i64> {
    let inputs: Vec<JournalLineInput> = lines
        .into_iter()
        .map(|(acc, dr, cr)| JournalLineInput {
            account_id: acc,
            debit: dr,
            credit: cr,
            description: None,
        })
        .collect();
    let entry = db.create_journal_entry(1, 1, date, desc, Some(""), inputs)?;
    Ok(entry.id)
}

/// Helper: look up an account ID by code
fn account_id(db: &Database, code: &str) -> Result<i64> {
    let conn = db.conn.lock().unwrap();
    let id: i64 = conn.query_row(
        "SELECT id FROM accounts WHERE company_id = 1 AND code = ?1",
        rusqlite::params![code],
        |row| row.get(0),
    )?;
    Ok(id)
}