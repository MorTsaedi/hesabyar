//! Standalone smoke test for backup/restore.
//!
//! Run with:  `cargo run --bin backup_smoke_test`
//!
//! This binary creates a temporary SQLite database, writes a row,
//! backs it up, deletes the row, restores the backup, and checks
//! that the row came back. Exits 0 on success.

use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // We can't directly use hesabyar_lib::db::Database from a binary
    // because the lib is a private crate, so re-implement the basics
    // here against rusqlite directly. This validates the SQLite-side
    // approach (VACUUM INTO, header magic, file swap) end-to-end.

    let tmp = std::env::temp_dir().join("hesabyar-backup-smoke");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp)?;

    let db_path = tmp.join("source.db");
    let backup_path = tmp.join("backup.db");
    let restored_path = tmp.join("restored.db");

    // 1. Create source DB with a row
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        conn.execute_batch(
            "CREATE TABLE t (k TEXT PRIMARY KEY, v INTEGER);
             INSERT INTO t VALUES ('answer', 42);
             PRAGMA journal_mode=WAL;",
        )?;
    }

    // 2. VACUUM INTO backup
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        let dest = backup_path.to_string_lossy().replace('\'', "''");
        conn.execute_batch(&format!("VACUUM INTO '{}';", dest))?;
    }

    if !backup_path.exists() {
        eprintln!("FAIL: backup file was not created");
        std::process::exit(1);
    }
    println!("OK: backup created at {}", backup_path.display());

    // 3. Validate magic header
    let backup_bytes = std::fs::read(&backup_path)?;
    if backup_bytes.len() < 16 || &backup_bytes[0..16] != b"SQLite format 3\0" {
        eprintln!("FAIL: backup is missing SQLite magic header");
        std::process::exit(1);
    }
    println!("OK: backup has valid SQLite magic header");

    // 4. Delete the row from source
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        let deleted = conn.execute("DELETE FROM t WHERE k = 'answer'", ())?;
        assert_eq!(deleted, 1);
    }

    // 5. Restore: replace source with backup
    let backup_bytes_for_restore = std::fs::read(&backup_path)?;
    std::fs::write(&restored_path, &backup_bytes_for_restore)?;
    std::fs::copy(&restored_path, &db_path)?;

    // Clear WAL sidecars
    for suffix in ["-wal", "-shm", "-journal"] {
        let sidecar = with_ext(&db_path, &format!("db{suffix}"));
        let _ = std::fs::remove_file(sidecar);
    }

    // 6. Reopen and check the row is back
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        let v: i64 = conn.query_row(
            "SELECT v FROM t WHERE k = 'answer'",
            [],
            |row| row.get(0),
        )?;
        if v != 42 {
            eprintln!("FAIL: restored value is {}, expected 42", v);
            std::process::exit(1);
        }
        println!("OK: restored value is {}", v);
    }

    // 7. Verify sidecars gone
    for suffix in ["-wal", "-shm", "-journal"] {
        let sidecar = with_ext(&db_path, &format!("db{suffix}"));
        if sidecar.exists() {
            eprintln!("FAIL: WAL sidecar {} should be removed", sidecar.display());
            std::process::exit(1);
        }
    }
    println!("OK: no WAL sidecars lingering");

    // 8. Backup-after-restore still works (regression for the reopen)
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        let dest = tmp.join("post-restore-backup.db").to_string_lossy().replace('\'', "''");
        conn.execute_batch(&format!("VACUUM INTO '{}';", dest))?;
        let conn2 = rusqlite::Connection::open(&dest)?;
        let v: i64 = conn2.query_row("SELECT v FROM t WHERE k = 'answer'", [], |row| row.get(0))?;
        if v != 42 {
            eprintln!("FAIL: post-restore backup value is {}", v);
            std::process::exit(1);
        }
        println!("OK: backup-after-restore round-trip works");
    }

    // Cleanup
    let _ = std::fs::remove_dir_all(&tmp);
    println!("\nALL CHECKS PASSED");
    Ok(())
}

fn with_ext(path: &PathBuf, new_ext: &str) -> PathBuf {
    let mut p = path.clone();
    p.set_extension(new_ext);
    p
}