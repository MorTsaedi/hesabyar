//! End-to-end smoke test for the Cash Flow Statement.
//!
//! Creates a fresh SQLite database in a temp directory, seeds the
//! minimal chart of accounts, posts a series of journal entries
//! that exercise every section of the statement, and verifies the
//! computed cash flow matches a hand-rolled expectation.
//!
//! Run with:  `cargo run --bin cashflow_smoke_test --release`

use hesabyar_lib::db::{Database, JournalLineInput};
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ---------- 1. Temp DB ----------
    let tmp = std::env::temp_dir().join("hesabyar-cashflow-smoke");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;
    let db_path: PathBuf = tmp.join("source.db");
    let db = Database::new(db_path.to_str().unwrap())?;

    // ---------- 2. Minimal chart of accounts ----------
    // We seed only what we need (cash, AR, inventory, fixed assets,
    // AP, equity, revenue, expenses).
    let _ = db.conn.lock().unwrap().execute_batch(
        "INSERT OR IGNORE INTO companies (id, name, fiscal_year_start)
         VALUES (1, 'شرکت آزمایشی', '01/01');
         INSERT OR IGNORE INTO fiscal_years (id, company_id, name, start_date, end_date)
         VALUES (1, 1, '1404', '1404/01/01', '1404/12/29');
         INSERT OR IGNORE INTO app_settings (id) VALUES (1);",
    )?;

    let accounts: Vec<(&str, &str, &str, Option<&str>, i32)> = vec![
        // cash + bank (cash equivalents)
        ("1101", "نقد", "asset", None, 3),
        ("1102", "بانک", "asset", None, 3),
        // current assets
        ("1103", "حساب‌های دریافتنی", "asset", None, 3),
        ("1106", "موجودی مواد و کالا", "asset", None, 3),
        // non-current assets
        ("1201", "زمین", "asset", None, 3),
        ("1202", "ساختمان", "asset", None, 3),
        ("1208", "استهلاک انباشته", "contra", None, 3),
        // current liabilities
        ("2101", "حساب‌های پرداختنی", "liability", None, 3),
        // long-term liabilities
        ("2201", "تسهیلات مالی بلندمدت", "liability", None, 3),
        // equity
        ("3101", "سرمایه", "equity", None, 3),
        // revenue
        ("4101", "فروش کالا و خدمات", "revenue", None, 3),
        // expenses
        ("5101", "بهای تمام شده", "expense", None, 3),
        ("5102", "هزینه حقوق", "expense", None, 3),
        ("5107", "هزینه استهلاک", "expense", None, 3),
    ];
    for (code, name, atype, _parent, level) in &accounts {
        insert_account(&db, 1, code, name, atype, *level)?;
    }

    // Resolve account IDs we need.
    let cash = account_id(&db, "1101")?;
    let bank = account_id(&db, "1102")?;
    let ar = account_id(&db, "1103")?;
    let inventory = account_id(&db, "1106")?;
    let land = account_id(&db, "1201")?;
    let building = account_id(&db, "1202")?;
    let accum_dep = account_id(&db, "1208")?;
    let ap = account_id(&db, "2101")?;
    let loan = account_id(&db, "2201")?;
    let equity = account_id(&db, "3101")?;
    let revenue = account_id(&db, "4101")?;
    let cogs = account_id(&db, "5101")?;
    let salaries = account_id(&db, "5102")?;
    let dep_exp = account_id(&db, "5107")?;

    // Helper to post an entry with lines.
    let post = |db: &Database,
                date: &str,
                desc: &str,
                lines: Vec<(i64, f64, f64)>|
     -> Result<i64, Box<dyn std::error::Error>> {
        let inputs: Vec<JournalLineInput> = lines
            .into_iter()
            .map(|(account_id, debit, credit)| JournalLineInput {
                account_id,
                debit,
                credit,
                description: None,
            })
            .collect();
        let entry = db.create_journal_entry(1, 1, date, desc, Some(""), inputs)?;
        Ok(entry.id)
    };

    // ---------- 3. Post the test ledger ----------
    //
    // Scenario: A company starts with 1,000,000 rial cash and no
    // other balances, then during 1404/01 it does the following:
    //
    //   Day 01: Owner invests 50,000,000 cash  → equity +50M, cash +50M
    //   Day 05: Buys land for 20,000,000 cash  → land +20M, cash -20M
    //   Day 10: Sells goods on credit for 30M (AR +30M, revenue +30M)
    //   Day 12: Customer pays 25M cash          → cash +25M, AR -25M
    //   Day 15: Pays salaries 8M cash           → salaries +8M, cash -8M
    //   Day 18: Buys inventory on credit 12M    → inventory +12M, AP +12M
    //   Day 20: Pays AP 10M cash                → AP -10M, cash -10M
    //   Day 22: Takes a 40M long-term loan      → cash +40M, loan +40M
    //   Day 25: Records depreciation 5M         → dep_exp +5M, accum_dep +5M
    //   Day 28: Sells goods for 60M cash        → cash +60M, revenue +60M
    //   Day 30: Pays COGS-related AP 4M cash    → AP -4M, cash -4M
    //
    // Closing entries also: record the matching COGS against
    //   the inventory that was sold (20M cash equivalents).

    // owner invests (Day 01)
    post(&db, "1404/01/01", "سرمایه اولیه", vec![(cash, 50_000_000.0, 0.0), (equity, 0.0, 50_000_000.0)])?;

    // buys land (Day 05)
    post(&db, "1404/01/05", "خرید زمین", vec![(land, 20_000_000.0, 0.0), (cash, 0.0, 20_000_000.0)])?;

    // credit sale (Day 10)
    post(&db, "1404/01/10", "فروش نسیه", vec![(ar, 30_000_000.0, 0.0), (revenue, 0.0, 30_000_000.0)])?;

    // customer pays 25M (Day 12)
    post(&db, "1404/01/12", "دریافت از مشتری", vec![(cash, 25_000_000.0, 0.0), (ar, 0.0, 25_000_000.0)])?;

    // salaries (Day 15)
    post(&db, "1404/01/15", "حقوق", vec![(salaries, 8_000_000.0, 0.0), (cash, 0.0, 8_000_000.0)])?;

    // inventory on credit (Day 18)
    post(&db, "1404/01/18", "خرید موجودی نسیه", vec![(inventory, 12_000_000.0, 0.0), (ap, 0.0, 12_000_000.0)])?;

    // pays AP (Day 20)
    post(&db, "1404/01/20", "پرداخت بدهی", vec![(ap, 10_000_000.0, 0.0), (cash, 0.0, 10_000_000.0)])?;

    // takes long-term loan (Day 22)
    post(&db, "1404/01/22", "تسهیلات", vec![(cash, 40_000_000.0, 0.0), (loan, 0.0, 40_000_000.0)])?;

    // depreciation (Day 25)
    post(&db, "1404/01/25", "استهلاک", vec![(dep_exp, 5_000_000.0, 0.0), (accum_dep, 0.0, 5_000_000.0)])?;

    // cash sale (Day 28)
    post(&db, "1404/01/28", "فروش نقد", vec![(cash, 60_000_000.0, 0.0), (revenue, 0.0, 60_000_000.0)])?;

    // pays more AP (Day 30)
    post(&db, "1404/01/30", "پرداخت بدهی", vec![(ap, 4_000_000.0, 0.0), (cash, 0.0, 4_000_000.0)])?;

    // ---------- 4. Compute cash flow ----------
    let r = db.get_cash_flow_statement(1, "1404/01/01", "1404/01/31")?;

    // ---------- 5. Hand-computed expectations ----------
    //
    //   Net income = revenue - expenses
    //     revenue total: 30M (credit sale) + 60M (cash sale) = 90M
    //     expenses total: 8M salaries + 5M depreciation     = 13M
    //     net income                                       = 77M
    //
    //   Operating adjustments:
    //     depreciation (1208) +5M (added back)
    //     AR change: 30M increase → -30M (used cash)
    //     Inventory change: 12M increase → -12M (used cash)
    //     AP change: (10+4) paid, 12M incurred → net -2M change → +2M (source of cash)
    //
    //   Operating subtotal = 77 + 5 - 30 - 12 + 2 = 42M
    //
    //   Investing:
    //     Land +20M → -20M (used cash)
    //     Building: 0
    //   Investing subtotal = -20M
    //
    //   Financing:
    //     Equity +50M, Loan +40M → +90M
    //   Financing subtotal = 90M
    //
    //   Net change = 42 - 20 + 90 = 112M
    //   Opening cash = 0
    //   Closing cash = opening + net change = 112M
    //
    //   Quick check via the cash account directly:
    //     50 - 20 + 25 - 8 - 10 + 40 + 60 - 4 = 133M (cash account only)
    //     The 21M discrepancy is the cash impact of the credit
    //     sale (no cash movement for the sale, but revenue +30M
    //     and AR +30M). With indirect method, the AR change is
    //     already removed from operating income, so:
    //       operating = 77 + 5 - 30 + 2 = 54
    //     Hmm, let me recompute carefully:

    // Net income = revenue - expenses
    // revenue = 90,000,000 (30 credit + 60 cash)
    // expenses = 13,000,000 (8 salaries + 5 dep)
    // net income = 77,000,000

    // Working capital deltas:
    //   AR: prior 0, closing 5M (30 incurred, 25 received) → +5M, so -5M on operating
    //   Inventory: prior 0, closing 12M → +12M, so -12M on operating
    //   AP: prior 0, closing -2M (12 incurred, 14 paid) → -2M, so -2M on operating

    // Operating = 77 (NI) + 5 (dep) - 5 (AR) - 12 (inventory) - 2 (AP) = 63M

    // Investing = -20 (land)

    // Financing = +50 (equity) + 40 (loan) = 90M

    // Net = 63 - 20 + 90 = 133M ✓

    let expected_net_income = 77_000_000.0_f64;
    let expected_operating = 63_000_000.0_f64;
    let expected_investing = -20_000_000.0_f64;
    let expected_financing = 90_000_000.0_f64;
    let expected_net_change = 133_000_000.0_f64;
    let expected_closing_cash = 133_000_000.0_f64;

    println!("=== Cash Flow Statement (period 1404/01/01 — 1404/01/31) ===");
    println!();

    let print_section = |title: &str, lines: &[hesabyar_lib::db::CashFlowItem], subtotal: f64| {
        println!("  {}:", title);
        if lines.is_empty() {
            println!("    (هیچ موردی)");
        }
        for line in lines {
            println!(
                "    {:<10} {:<40} {:>20}",
                line.label,
                line.label,
                format!("{:+.0}", line.amount)
            );
        }
        println!("    {}", "─".repeat(72));
        println!(
            "    {:<10} {:<40} {:>20}",
            "",
            "جمع",
            format!("{:+.0}", subtotal)
        );
        println!();
    };

    print_section(&r.operating.title, &r.operating.items, r.operating.subtotal);
    print_section(&r.investing.title, &r.investing.items, r.investing.subtotal);
    print_section(&r.financing.title, &r.financing.items, r.financing.subtotal);

    println!("  تغییر خالص در موجودی نقد: {:+.0}", r.net_change);
    println!("  موجودی نقد در ابتدای دوره: {:+.0}", r.opening_cash);
    println!("  موجودی نقد در پایان دوره: {:+.0}", r.closing_cash);
    println!("  تراز: {}", r.balanced);
    println!();

    let approx = |a: f64, b: f64| (a - b).abs() < 1.0;

    println!("=== Assertions ===");
    assert!(approx(r.operating.subtotal, expected_operating),
        "operating subtotal: expected {}, got {}", expected_operating, r.operating.subtotal);
    println!("OK: operating subtotal = {:.0} (expected {:.0})", r.operating.subtotal, expected_operating);

    assert!(approx(r.investing.subtotal, expected_investing),
        "investing subtotal: expected {}, got {}", expected_investing, r.investing.subtotal);
    println!("OK: investing subtotal = {:.0} (expected {:.0})", r.investing.subtotal, expected_investing);

    assert!(approx(r.financing.subtotal, expected_financing),
        "financing subtotal: expected {}, got {}", expected_financing, r.financing.subtotal);
    println!("OK: financing subtotal = {:.0} (expected {:.0})", r.financing.subtotal, expected_financing);

    assert!(approx(r.net_change, expected_net_change),
        "net change: expected {}, got {}", expected_net_change, r.net_change);
    println!("OK: net change = {:.0} (expected {:.0})", r.net_change, expected_net_change);

    assert!(approx(r.closing_cash, expected_closing_cash),
        "closing cash: expected {}, got {}", expected_closing_cash, r.closing_cash);
    println!("OK: closing cash = {:.0} (expected {:.0})", r.closing_cash, expected_closing_cash);

    // Net income sanity check
    let net_income_line = r.operating.items.iter().find(|l| l.label == "----");
    if let Some(line) = net_income_line {
        assert!(approx(line.amount, expected_net_income),
            "net income line: expected {}, got {}", expected_net_income, line.amount);
        println!("OK: net income line = {:.0} (expected {:.0})", line.amount, expected_net_income);
    } else {
        return Err("missing net income line".into());
    }

    // Depreciation should appear in operating lines.
    let dep_line = r.operating.items.iter().find(|l| l.label == "1208");
    if let Some(line) = dep_line {
        assert!(approx(line.amount, 5_000_000.0),
            "depreciation line: expected 5_000_000, got {}", line.amount);
        println!("OK: depreciation line = {:.0} (expected 5_000_000)", line.amount);
    } else {
        return Err("missing depreciation line".into());
    }

    assert!(r.balanced, "balanced flag should be true");
    println!("OK: balanced = true");

    let _ = (cogs, bank, building); // suppress unused warnings

    println!();
    println!("ALL CASH-FLOW SMOKE CHECKS PASSED");
    let _ = std::fs::remove_dir_all(&tmp);
    Ok(())
}

fn insert_account(
    db: &Database,
    company_id: i64,
    code: &str,
    name: &str,
    account_type: &str,
    level: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    let id = db.create_account(
        company_id,
        code,
        name,
        None,
        level,
        account_type,
        None,
    )?;
    let _ = id;
    Ok(())
}

fn account_id(db: &Database, code: &str) -> Result<i64, Box<dyn std::error::Error>> {
    let conn = db.conn.lock().unwrap();
    let id: i64 = conn.query_row(
        "SELECT id FROM accounts WHERE company_id = 1 AND code = ?1",
        rusqlite::params![code],
        |row| row.get(0),
    )?;
    Ok(id)
}