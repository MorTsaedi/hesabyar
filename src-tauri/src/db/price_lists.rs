use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== PRICE LISTS ====================

    pub fn get_price_lists(&self, company_id: i64) -> Result<Vec<PriceList>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, name, type, is_default, created_at
             FROM price_lists WHERE company_id = ?1 ORDER BY type, name"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(PriceList {
                id: row.get(0)?, company_id: row.get(1)?,
                name: row.get(2)?, r#type: row.get(3)?,
                is_default: row.get::<_, i64>(4)? != 0,
                created_at: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_price_list(&self, company_id: i64, name: &str, r#type: &str, is_default: bool) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        if is_default {
            conn.execute(
                "UPDATE price_lists SET is_default = 0 WHERE company_id = ?1 AND type = ?2",
                params![company_id, r#type],
            )?;
        }
        conn.execute(
            "INSERT INTO price_lists (company_id, name, type, is_default) VALUES (?1, ?2, ?3, ?4)",
            params![company_id, name, r#type, is_default as i64],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_price_list(&self, id: i64, name: &str, is_default: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        if is_default {
            let company_type: (i64, String) = conn.query_row(
                "SELECT company_id, type FROM price_lists WHERE id = ?1", params![id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )?;
            conn.execute(
                "UPDATE price_lists SET is_default = 0 WHERE company_id = ?1 AND type = ?2",
                params![company_type.0, company_type.1],
            )?;
        }
        conn.execute(
            "UPDATE price_lists SET name = ?1, is_default = ?2 WHERE id = ?3",
            params![name, is_default as i64, id],
        )?;
        Ok(())
    }

    pub fn delete_price_list(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM price_list_items WHERE price_list_id = ?1", params![id])?;
        conn.execute("DELETE FROM price_lists WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== PRICE LIST ITEMS ====================

    pub fn get_price_list_items(&self, price_list_id: i64) -> Result<Vec<PriceListItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT pli.id, pli.price_list_id, pli.product_id, p.code, p.name, pli.price
             FROM price_list_items pli
             JOIN products p ON p.id = pli.product_id
             WHERE pli.price_list_id = ?1
             ORDER BY p.name"
        )?;
        let rows = stmt.query_map(params![price_list_id], |row| {
            Ok(PriceListItem {
                id: row.get(0)?, price_list_id: row.get(1)?,
                product_id: row.get(2)?, product_code: row.get(3)?,
                product_name: row.get(4)?, price: row.get(5)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn upsert_price_list_item(
        &self,
        price_list_id: i64,
        product_id: i64,
        price: f64,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO price_list_items (price_list_id, product_id, price) VALUES (?1, ?2, ?3)
             ON CONFLICT(price_list_id, product_id) DO UPDATE SET price = excluded.price",
            params![price_list_id, product_id, price],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_price_list_item(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM price_list_items WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Clear all items of a list (used before bulk import from products).
    pub fn clear_price_list_items(&self, price_list_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM price_list_items WHERE price_list_id = ?1", params![price_list_id])?;
        Ok(())
    }
}
