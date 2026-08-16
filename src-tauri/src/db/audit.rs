use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    /// Log an action to the audit trail.
    pub fn log_audit(
        &self,
        company_id: i64,
        action: &str,
        entity: &str,
        entity_id: Option<i64>,
        description: &str,
        details: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO audit_log (company_id, action, entity, entity_id, description, details)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![company_id, action, entity, entity_id, description, details],
        )?;
        Ok(())
    }

    pub fn get_audit_log(&self, company_id: i64, limit: i64) -> Result<Vec<AuditLogEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, action, entity, entity_id, description, details, created_at
             FROM audit_log
             WHERE company_id = ?1
             ORDER BY id DESC
             LIMIT ?2"
        )?;
        let rows = stmt.query_map(params![company_id, limit], |row| {
            Ok(AuditLogEntry {
                id: row.get(0)?, company_id: row.get(1)?,
                action: row.get(2)?, entity: row.get(3)?,
                entity_id: row.get(4)?, description: row.get(5)?,
                details: row.get(6)?, created_at: row.get(7)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    /// Distinct entity types present in the log (for filters).
    pub fn get_audit_entities(&self, company_id: i64) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT DISTINCT entity FROM audit_log WHERE company_id = ?1 ORDER BY entity"
        )?;
        let rows = stmt.query_map(params![company_id], |r| r.get(0))?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }
}
