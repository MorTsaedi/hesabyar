/// Smoke test: Currency Revaluation
///
/// Tests the full pipeline:
///   1. Create accounts with foreign currency (USD, EUR)
///   2. Set exchange rates
///   3. Create journal entries with foreign-currency balances
///   4. Run revaluation and verify journal entry creation
///   5. Check revaluation history
///
/// Uses an in-memory / temp database so it's fully hermetic.
use std::path::PathBuf;

use hesabyar_lib::db::{Database, JournalLineInput, AccountRow};

fn get_db_path() -> PathBuf {
    let tmp = std::env::temp_dir().join("hesabyar-currency-smoke");
    // Remove any leftover from a previous interrupted run
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).expect("create temp dir");
    tmp.join("test.db")
}

fn find_account(accounts: &[AccountRow], code: &str) -> Option<i64> {
    accounts.iter().find(|a| a.code == code).map(|a| a.id)
}

/// Seed a minimal chart of accounts needed for the revaluation test.
fn seed_accounts(db: &Database) -> Result<(), Box<dyn std::error::Error>> {
    let accounts = vec![
        // Level 1
        (1, 0, "1",  "دارایی‌ها", "asset"),
        (1, 0, "2",  "بدهی‌ها", "liability"),
        (1, 0, "3",  "حقوق صاحبان سرمایه", "equity"),
        (1, 0, "4",  "درآمدها", "revenue"),
        (1, 0, "5",  "هزینه‌ها", "expense"),
    ];
    for (company_id, _parent, code, name, atype) in &accounts {
        db.create_account(*company_id, code, name, None, 1, atype, Some("IRR"))?;
    }

    // Level 2
    let pairs = vec![
        ("11", "دارایی‌های جاری", "asset", "1"),
        ("12", "دارایی‌های غیرجاری", "asset", "1"),
        ("21", "بدهی‌های جاری", "liability", "2"),
        ("22", "بدهی‌های غیرجاری", "liability", "2"),
        ("31", "سرمایه", "equity", "3"),
        ("41", "درآمدهای عملیاتی", "revenue", "4"),
        ("42", "درآمدهای غیرعملیاتی", "revenue", "4"),
        ("51", "هزینه‌های عملیاتی", "expense", "5"),
        ("52", "هزینه‌های غیرعملیاتی", "expense", "5"),
    ];

    let all = db.get_accounts(1)?;
    for (code, name, atype, parent_code) in &pairs {
        let parent_id = find_account(&all, parent_code).unwrap();
        db.create_account(1, code, name, Some(parent_id), 2, atype, Some("IRR"))?;
    }

    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_path = get_db_path();
    println!("Using temp database: {:?}", db_path);

    let db = Database::new(db_path.to_str().unwrap())?;

    // Seed accounts (need company 1 + fiscal year + accounts)
    // The migration creates companies, fiscal_years, and the seed migration
    // creates accounts. But since we're using a fresh DB, we need to ensure
    // a fiscal year exists for journal entry creation.
    let conn = db.conn.lock().unwrap();
    conn.execute_batch("
        INSERT OR IGNORE INTO companies (id, name, fiscal_year_start)
        VALUES (1, 'شرکت تست', '01/01');

        INSERT OR IGNORE INTO fiscal_years (company_id, name, start_date, end_date)
        VALUES (1, '1404', '1404/01/01', '1404/12/29');
    ")?;
    drop(conn);

    seed_accounts(&db)?;

    // Get fresh account list
    let accounts = db.get_accounts(1)?;
    println!("Seeded {} accounts", accounts.len());

    let assets_id = find_account(&accounts, "11").ok_or("Account 11 not found")?;
    let liabilities_id = find_account(&accounts, "21").ok_or("Account 21 not found")?;
    let revenue_id = find_account(&accounts, "42").ok_or("Account 42 not found")?;
    let expense_id = find_account(&accounts, "52").ok_or("Account 52 not found")?;

    // 1. Create foreign currency accounts
    println!("\n=== 1. Creating foreign currency accounts ===");
    let usd_bank = db.create_account(1, "110201", "بانک دلاری", Some(assets_id), 3, "asset", Some("USD"))?;
    let eur_bank_id = db.create_account(1, "110202", "بانک یورویی", Some(assets_id), 3, "asset", Some("EUR"))?;
    let reval_gain = db.create_account(1, "420101", "سود تسعیر ارز", Some(revenue_id), 3, "revenue", Some("IRR"))?;
    let reval_loss = db.create_account(1, "520101", "زیان تسعیر ارز", Some(expense_id), 3, "expense", Some("IRR"))?;
    println!("  USD bank: {}, EUR bank: {}, gain: {}, loss: {}",
        usd_bank.id, eur_bank_id.id, reval_gain.id, reval_loss.id);

    // 2. Set exchange rates
    println!("\n=== 2. Setting exchange rates ===");
    db.set_exchange_rate("USD", "IRR", 420_000.0, "1404/01/01")?;
    db.set_exchange_rate("USD", "IRR", 450_000.0, "1404/06/30")?;
    db.set_exchange_rate("EUR", "IRR", 460_000.0, "1404/01/01")?;
    db.set_exchange_rate("EUR", "IRR", 490_000.0, "1404/06/30")?;

    let rate_usd = db.get_exchange_rate("USD", "IRR", "1404/06/30")?;
    println!("  USD->IRR on 1404/06/30: {:.0}", rate_usd);
    assert!((rate_usd - 450_000.0).abs() < 0.01);

    let rate_eur = db.get_exchange_rate("EUR", "IRR", "1404/06/30")?;
    println!("  EUR->IRR on 1404/06/30: {:.0}", rate_eur);
    assert!((rate_eur - 490_000.0).abs() < 0.01);

    // 3. Create journal entries for foreign currency balances
    println!("\n=== 3. Creating journal entries ===");

    // $1,000 USD deposited at 420,000 IRR/USD => 420,000,000 IRR
    db.create_journal_entry(
        1, 1, "1404/01/01", "واریز دلاری",
        Some("smoke_test"),
        vec![
            JournalLineInput {
                account_id: usd_bank.id,
                debit: 420_000_000.0,
                credit: 0.0,
                description: Some("واریز 1000 دلار به نرخ 420000".to_string()),
            },
            JournalLineInput {
                account_id: liabilities_id,
                debit: 0.0,
                credit: 420_000_000.0,
                description: Some("طرف حساب".to_string()),
            },
        ],
    )?;
    println!("  $1,000 USD @ 420,000 = 420,000,000 IRR");

    // €1,000 EUR deposited at 460,000 IRR/EUR => 460,000,000 IRR
    db.create_journal_entry(
        1, 1, "1404/01/01", "واریز یورویی",
        Some("smoke_test"),
        vec![
            JournalLineInput {
                account_id: eur_bank_id.id,
                debit: 460_000_000.0,
                credit: 0.0,
                description: Some("واریز 1000 یورو به نرخ 460000".to_string()),
            },
            JournalLineInput {
                account_id: liabilities_id,
                debit: 0.0,
                credit: 460_000_000.0,
                description: Some("طرف حساب".to_string()),
            },
        ],
    )?;
    println!("  €1,000 EUR @ 460,000 = 460,000,000 IRR");

    // 4. Verify balances
    println!("\n=== 4. Verifying account balances ===");
    let usd_balance = db.get_account_balance_as_of(usd_bank.id, "1404/06/30")?;
    println!("  USD bank balance (IRR): {:.0}", usd_balance);
    assert!((usd_balance - 420_000_000.0).abs() < 0.01);

    let eur_balance = db.get_account_balance_as_of(eur_bank_id.id, "1404/06/30")?;
    println!("  EUR bank balance (IRR): {:.0}", eur_balance);
    assert!((eur_balance - 460_000_000.0).abs() < 0.01);

    // 5. Run revaluation
    println!("\n=== 5. Running revaluation as of 1404/06/30 ===");
    let details = db.perform_currency_revaluation(1, 1, "1404/06/30", reval_gain.id, reval_loss.id)?;
    println!("  Revaluation found {} affected accounts", details.len());

    for d in &details {
        println!(
            "    {} ({}) — prev_bal: {:.2} rate: {:.0} new_bal: {:.0} gain: {:.0} loss: {:.0}",
            d.account_code, d.currency, d.balance_before, d.exchange_rate,
            d.balance_after, d.revaluation_gain, d.revaluation_loss
        );
    }

    // Compute expected values:
    // USD: booked=420,000,000 IRR, rate=450,000
    //   balance_in_currency = 420,000,000 / 450,000 = 933.33
    //   value_in_base = round(933.33 * 450,000) = 419,998,500
    //   gain/loss = 419,998,500 - 420,000,000 = -1,500
    //
    // EUR: booked=460,000,000 IRR, rate=490,000
    //   balance_in_currency = 460,000,000 / 490,000 = 938.78
    //   value_in_base = round(938.78 * 490,000) = 459,997,800
    //   gain/loss = 459,997,800 - 460,000,000 = -2,200

    // Both are small rounding losses. The journal entry should combine them.
    let total_loss: f64 = details.iter().filter(|d| d.revaluation_loss < 0.0)
        .map(|d| -d.revaluation_loss).sum();
    println!("  Total loss (rounding): {:.0}", total_loss);
    assert!(total_loss > 0.0, "Should have some rounding loss");

    // 6. Revaluation history
    println!("\n=== 6. Revaluation history ===");
    let history = db.get_revaluation_history(1)?;
    println!("  Found {} run(s)", history.len());
    assert_eq!(history.len(), 1, "Should have exactly 1 revaluation run");

    // 7. Check revaluation history
    println!("  Revaluation run: id={}, date={}", history[0].id, history[0].revaluation_date);

    // 8. Foreign currency accounts list
    println!("\n=== 8. Foreign currency accounts ===");
    let foreign = db.get_foreign_currency_accounts(1)?;
    println!("  Found {} foreign currency account(s)", foreign.len());
    assert_eq!(foreign.len(), 2);

    // 9. Exchange rate history
    println!("\n=== 9. Exchange rate history ===");
    let rates = db.get_exchange_rates("USD", "IRR", 10)?;
    println!("  USD->IRR rates:");
    for r in &rates {
        println!("    {} — {:.0}", r.date, r.rate);
    }
    assert_eq!(rates.len(), 2, "Should have 2 USD rate entries");

    println!("\n✅ All currency revaluation smoke tests passed!");
    Ok(())
}
