use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== INVOICES ====================

    pub fn get_invoices(&self) -> Result<Vec<Invoice>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT i.id, i.number, i.type, i.contact_id, c.name, i.date, i.due_date,
                    i.total, i.status, i.notes, i.created_at, i.moadian_status
             FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id ORDER BY i.date DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            let inv_type: String = row.get(2)?;
            Ok(Invoice {
                id: row.get(0)?, number: row.get(1)?, r#type: inv_type.clone(),
                invoice_type: inv_type,
                contact_id: row.get(3)?, contact_name: row.get(4)?,
                date: row.get(5)?, due_date: row.get(6)?, total: row.get(7)?,
                status: row.get(8)?, notes: row.get(9)?, created_at: row.get(10)?,
                lines: vec![], moadian_uid: None, moadian_status: row.get(11)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            let mut inv = row?;
            let mut ls = conn.prepare(
                "SELECT il.id, il.invoice_id, il.product_id, il.description,
                        il.quantity, il.unit_price, il.discount_pct, il.tax_rate, il.total
                 FROM invoice_lines il WHERE il.invoice_id = ?1"
            )?;
            inv.lines = ls.query_map(params![inv.id], |row| {
                Ok(InvoiceLine {
                    id: row.get(0)?, invoice_id: row.get(1)?, product_id: row.get(2)?,
                    description: row.get(3)?, quantity: row.get(4)?, unit_price: row.get(5)?,
                    discount_pct: row.get(6)?, discount: row.get::<_, f64>(6)? * row.get::<_, f64>(4)?,
                    tax_rate: row.get(7)?, tax: row.get::<_, f64>(7)? * row.get::<_, f64>(8)? / 100.0,
                    total: row.get(8)?,
                })
            })?.collect::<Result<Vec<_>>>()?;
            result.push(inv);
        }
        Ok(result)
    }

    pub fn get_invoice(&self, id: i64) -> Result<(Invoice, Vec<InvoiceLine>)> {
        let conn = self.conn.lock().unwrap();
        let inv = conn.query_row(
            "SELECT i.id, i.number, i.type, i.contact_id, c.name, i.date, i.due_date,
                    i.total, i.status, i.notes, i.created_at, i.moadian_status
             FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE i.id = ?1",
            params![id],
            |row| Ok(Invoice {
                id: row.get(0)?, number: row.get(1)?, r#type: row.get(2)?,
                invoice_type: row.get::<_, String>(2)?,
                contact_id: row.get(3)?, contact_name: row.get(4)?,
                date: row.get(5)?, due_date: row.get(6)?, total: row.get(7)?,
                status: row.get(8)?, notes: row.get(9)?, created_at: row.get(10)?,
                lines: vec![], moadian_uid: None, moadian_status: row.get(11)?,
            })
        )?;
        let mut ls = conn.prepare(
            "SELECT il.id, il.invoice_id, il.product_id, il.description,
                    il.quantity, il.unit_price, il.discount_pct, il.tax_rate, il.total
             FROM invoice_lines il WHERE il.invoice_id = ?1"
        )?;
        let lines = ls.query_map(params![id], |row| {
            Ok(InvoiceLine {
                id: row.get(0)?, invoice_id: row.get(1)?, product_id: row.get(2)?,
                description: row.get(3)?, quantity: row.get(4)?, unit_price: row.get(5)?,
                discount_pct: row.get(6)?, discount: row.get::<_, f64>(6)? * row.get::<_, f64>(4)?,
                tax_rate: row.get(7)?, tax: row.get::<_, f64>(7)? * row.get::<_, f64>(8)? / 100.0,
                total: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok((inv, lines))
    }

    pub fn create_invoice(&self, invoice_type: &str, contact_id: i64, date: &str,
        due_date: Option<&str>, notes: Option<&str>, lines: Vec<InvoiceLineInput>) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let total: f64 = lines.iter().map(|l| l.quantity * l.unit_price * (1.0 - l.discount_pct / 100.0) * (1.0 + l.tax_rate / 100.0)).sum();
        let cid: Option<i64> = if contact_id > 0 { Some(contact_id) } else { None };
        conn.execute(
            "INSERT INTO invoices (company_id, fiscal_year_id, number, type, contact_id, date, due_date, total, status, notes)
             VALUES (?1, (SELECT id FROM fiscal_years WHERE company_id = ?1 ORDER BY id DESC LIMIT 1),
                     (SELECT COALESCE(MAX(CAST(number AS INTEGER)), 0) + 1 FROM invoices), ?2, ?3, ?4, ?5, ?6, 'draft', ?7)",
            params![1, invoice_type, cid, date, due_date, total, notes],
        )?;
        let inv_id = conn.last_insert_rowid();
        for l in &lines {
            let line_total = l.quantity * l.unit_price * (1.0 - l.discount_pct / 100.0) * (1.0 + l.tax_rate / 100.0);
            conn.execute(
                "INSERT INTO invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount_pct, tax_rate, total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![inv_id, l.product_id, l.description, l.quantity, l.unit_price, l.discount_pct, l.tax_rate, line_total],
            )?;
        }
        // ponytail: hardcoded company_id=1 (per-company DB pattern)
        for l in &lines {
            if let Some(pid) = l.product_id {
                if invoice_type == "purchase" {
                    conn.execute(
                        "INSERT INTO inventory_movements (company_id, product_id, movement_type, qty_in, unit_cost, total_cost, date, notes)
                         VALUES (?1, ?2, 'purchase', ?3, ?4, ?5, ?6, ?7)",
                        params![1, pid, l.quantity, l.unit_price, l.quantity * l.unit_price, date, notes],
                    )?;
                    conn.execute("UPDATE products SET current_stock = current_stock + ?1 WHERE id = ?2",
                        params![l.quantity, pid])?;
                } else if invoice_type == "sale" {
                    conn.execute(
                        "INSERT INTO inventory_movements (company_id, product_id, movement_type, qty_out, unit_cost, total_cost, date, notes)
                         VALUES (?1, ?2, 'sale', ?3, ?4, ?5, ?6, ?7)",
                        params![1, pid, l.quantity, l.unit_price, l.quantity * l.unit_price, date, notes],
                    )?;
                    conn.execute("UPDATE products SET current_stock = current_stock - ?1 WHERE id = ?2",
                        params![l.quantity, pid])?;
                }
            }
        }
        Ok(inv_id)
    }

    pub fn update_invoice(&self, id: i64, invoice_type: &str, contact_id: i64, date: &str,
        due_date: Option<&str>, status: &str, notes: Option<&str>, lines: Vec<InvoiceLineInput>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let total: f64 = lines.iter().map(|l| l.quantity * l.unit_price * (1.0 - l.discount_pct / 100.0) * (1.0 + l.tax_rate / 100.0)).sum();
        conn.execute(
            "UPDATE invoices SET type=?1, contact_id=?2, date=?3, due_date=?4, total=?5, status=?6, notes=?7 WHERE id=?8",
            params![invoice_type, contact_id, date, due_date, total, status, notes, id],
        )?;
        conn.execute("DELETE FROM invoice_lines WHERE invoice_id = ?1", params![id])?;
        for l in &lines {
            let line_total = l.quantity * l.unit_price * (1.0 - l.discount_pct / 100.0) * (1.0 + l.tax_rate / 100.0);
            conn.execute(
                "INSERT INTO invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount_pct, tax_rate, total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![id, l.product_id, l.description, l.quantity, l.unit_price, l.discount_pct, l.tax_rate, line_total],
            )?;
        }
        Ok(())
    }

    pub fn delete_invoice(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM invoice_lines WHERE invoice_id = ?1", params![id])?;
        conn.execute("DELETE FROM invoices WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_invoice_status(&self, id: i64, status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE invoices SET status=?1 WHERE id=?2", params![status, id])?;
        Ok(())
    }

    pub fn update_invoice_moadian(&self, id: i64, moadian_status: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE invoices SET moadian_status=?1 WHERE id=?2", params![moadian_status, id])?;
        Ok(())
    }

    pub fn search_invoices(&self, query: &str) -> Result<Vec<Invoice>> {
        let conn = self.conn.lock().unwrap();
        let pat = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT i.id, i.number, i.type, i.contact_id, c.name, i.date, i.due_date,
                    i.total, i.status, i.notes, i.created_at, i.moadian_status
             FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id
             WHERE i.number LIKE ?1 OR c.name LIKE ?1 OR i.description LIKE ?1
             ORDER BY i.date DESC"
        )?;
        let rows = stmt.query_map(params![pat], |row| {
            let inv_type: String = row.get(2)?;
            Ok(Invoice {
                id: row.get(0)?, number: row.get(1)?, r#type: inv_type.clone(),
                invoice_type: inv_type,
                contact_id: row.get(3)?, contact_name: row.get(4)?,
                date: row.get(5)?, due_date: row.get(6)?, total: row.get(7)?,
                status: row.get(8)?, notes: row.get(9)?, created_at: row.get(10)?,
                lines: vec![], moadian_uid: None, moadian_status: row.get(11)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn get_overdue_invoices(&self, _company_id: i64, as_of_date: &str, invoice_type: Option<&str>) -> Result<Vec<Invoice>> {
        let all = self.get_invoices()?;
        Ok(all.into_iter().filter(|i| {
            if let Some(ref d) = i.due_date {
                if let Some(ref t) = invoice_type { if &i.r#type != t { return false; } }
                d.as_str() < as_of_date && i.status != "paid"
            } else { false }
        }).collect())
    }

    pub fn record_invoice_payment(&self, id: i64, _amount: f64, _payment_date: &str) -> Result<()> {
        self.update_invoice_status(id, "paid")?;
        // Future: record payment as journal entry
        Ok(())
    }

    pub fn calculate_early_payment_discount(&self, invoice_id: i64, _payment_date: &str) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        let (total, due_date, contact_id): (f64, Option<String>, i64) = conn.query_row(
            "SELECT i.total, i.due_date, i.contact_id FROM invoices i WHERE i.id = ?1",
            params![invoice_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;
        if let Some(ref _due) = due_date {
            let discount_info: (Option<f64>, Option<i32>) = conn.query_row(
                "SELECT early_payment_discount_pct, early_payment_discount_days FROM contacts WHERE id = ?1",
                params![contact_id], |row| Ok((row.get(0)?, row.get(1)?)))?;
            if let (Some(pct), Some(days)) = discount_info {
                if days > 0 { return Ok(total * pct / 100.0); }
            }
        }
        Ok(0.0)
    }

    pub fn calculate_late_payment_penalty(&self, invoice_id: i64, payment_date: &str) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        let (total, due_date, contact_id): (f64, Option<String>, i64) = conn.query_row(
            "SELECT i.total, i.due_date, i.contact_id FROM invoices i WHERE i.id = ?1",
            params![invoice_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;
        if let Some(ref due) = due_date {
            if payment_date > due.as_str() {
                let penalty_pct: Option<f64> = conn.query_row(
                    "SELECT late_payment_penalty_pct FROM contacts WHERE id = ?1",
                    params![contact_id], |row| row.get(0))?;
                if let Some(pct) = penalty_pct { return Ok(total * pct / 100.0); }
            }
        }
        Ok(0.0)
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct InvoiceLineInput {
    pub product_id: Option<i64>,
    pub description: Option<String>,
    pub quantity: f64,
    pub unit_price: f64,
    pub discount_pct: f64,
    pub tax_rate: f64,
}
