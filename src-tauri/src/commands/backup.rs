/**
 * Backup / Restore commands
 *
 * All operations are file-system level. The DB file is the source of
 * truth and SQLite's `VACUUM INTO` is used for snapshots (safe to run
 * while the database is live).
 *
 * Restore is performed by:
 *   1. Validating the backup bytes have the SQLite magic header.
 *   2. Writing them to a staging file inside the backups/ folder.
 *   3. Saving the current DB as `pre-restore-<timestamp>.db` (so the
 *      user can roll back manually).
 *   4. Copying the staged file over the live DB.
 *   5. Closing the existing rusqlite Connection and opening a fresh
 *      one against the new file (plus re-running migrations).
 *
 * The user must restart the app for any open in-flight commands to
 * finish cleanly; in practice no commands are blocked because the
 * Mutex is held only during the swap.
 */

use crate::db::{BackupEntry, Database, DatabaseInfo, RestoreResult};
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn get_database_info(db: State<Database>) -> Result<DatabaseInfo, String> {
    Ok(db.database_info())
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_backups(db: State<Database>) -> Result<Vec<BackupEntry>, String> {
    db.list_backups().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_backup(
    db: State<Database>,
    name: Option<String>,
) -> Result<BackupEntry, String> {
    db.create_backup(name).map_err(|e| e.to_string())
}

/// Restores the database from a backup file supplied as raw bytes.
/// `suggested_name` is the filename to use when staging the file in
/// the backups/ directory (the live DB is replaced separately).
#[tauri::command(rename_all = "snake_case")]
pub fn restore_backup(
    db: State<Database>,
    backup_bytes: Vec<u8>,
    suggested_name: Option<String>,
) -> Result<RestoreResult, String> {
    db.restore_backup(backup_bytes, suggested_name)
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_backup(db: State<Database>, name: String) -> Result<(), String> {
    db.delete_backup(name).map_err(|e| e.to_string())
}