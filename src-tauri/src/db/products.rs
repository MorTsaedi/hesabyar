use rusqlite::{params, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== PRODUCTS ====================

    pub fn get_products(&self, company_id: Option<i64>) -> Result<Vec<Product>> {
        let company_id = company_id.unwrap_or(1);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.company_id, p.code, p.name, p.type, p.unit, p.sale_price,
                    p.purchase_price, p.min_stock, p.max_stock, p.reorder_point,
                    p.current_stock, p.tax_rate, p.status, p.created_at
             FROM products p WHERE p.company_id = ?1 ORDER BY p.code"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            Ok(Product {
                id: row.get(0)?, company_id: row.get(1)?, code: row.get(2)?,
                name: row.get(3)?, r#type: row.get(4)?, unit: row.get(5)?,
                sale_price: row.get(6)?, purchase_price: row.get(7)?,
                min_stock: row.get(8)?, max_stock: row.get(9)?, reorder_point: row.get(10)?,
                current_stock: row.get(11)?, tax_rate: row.get(12)?,
                status: row.get(13)?, created_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn search_products(&self, query: &str) -> Result<Vec<Product>> {
        let conn = self.conn.lock().unwrap();
        let pat = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT p.id, p.company_id, p.code, p.name, p.type, p.unit, p.sale_price,
                    p.purchase_price, p.min_stock, p.max_stock, p.reorder_point,
                    p.current_stock, p.tax_rate, p.status, p.created_at
             FROM products p WHERE p.name LIKE ?1 OR p.code LIKE ?1 ORDER BY p.code"
        )?;
        let rows = stmt.query_map(params![pat], |row| {
            Ok(Product {
                id: row.get(0)?, company_id: row.get(1)?, code: row.get(2)?,
                name: row.get(3)?, r#type: row.get(4)?, unit: row.get(5)?,
                sale_price: row.get(6)?, purchase_price: row.get(7)?,
                min_stock: row.get(8)?, max_stock: row.get(9)?, reorder_point: row.get(10)?,
                current_stock: row.get(11)?, tax_rate: row.get(12)?,
                status: row.get(13)?, created_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_product(&self, company_id: i64, name: &str, code: Option<&str>,
        product_type: &str, unit: Option<&str>, purchase_price: f64, sale_price: f64,
        _description: Option<&str>, min_stock: Option<f64>, max_stock: Option<f64>,
        reorder_point: Option<f64>, quantity: f64, tax_rate: Option<f64>) -> Result<Product> {
        let conn = self.conn.lock().unwrap();
        let code = code.unwrap_or("");
        let unit = unit.unwrap_or("");
        conn.execute(
            "INSERT INTO products (company_id, code, name, type, unit, purchase_price, sale_price, min_stock, max_stock, reorder_point, current_stock, tax_rate, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'active')",
            params![company_id, code, name, product_type, unit, purchase_price, sale_price,
                    min_stock, max_stock, reorder_point, quantity, tax_rate],
        )?;
        let id = conn.last_insert_rowid();
        drop(conn);
        self.get_products(Some(company_id)).map(|v| v.into_iter().find(|p| p.id == id).unwrap())
    }

    pub fn update_product(&self, id: i64, name: &str, code: Option<&str>,
        product_type: &str, unit: Option<&str>, purchase_price: f64, sale_price: f64,
        _description: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let code = code.unwrap_or("");
        let unit = unit.unwrap_or("");
        conn.execute(
            "UPDATE products SET name=?1, code=?2, type=?3, unit=?4, purchase_price=?5, sale_price=?6 WHERE id=?7",
            params![name, code, product_type, unit, purchase_price, sale_price, id],
        )?;
        Ok(())
    }

    pub fn delete_product(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM products WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== INVENTORY ====================

    pub fn record_inventory_movement(&self, product_id: i64, movement_type: &str,
        quantity: f64, unit_cost: f64, date: &str, _reference: Option<&str>, description: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let total_cost = quantity * unit_cost;
        let qty_in = if movement_type == "purchase" { quantity } else { 0.0 };
        let qty_out = if movement_type == "sale" { quantity } else { 0.0 };
        conn.execute(
            "INSERT INTO inventory_movements (company_id, product_id, movement_type, qty_in, qty_out, unit_cost, total_cost, date, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![1, product_id, movement_type, qty_in, qty_out, unit_cost, total_cost, date, description],
        )?;
        // ponytail: keep current_stock in sync with movements
        if movement_type == "purchase" {
            conn.execute("UPDATE products SET current_stock = current_stock + ?1 WHERE id = ?2",
                params![quantity, product_id])?;
        } else if movement_type == "sale" {
            conn.execute("UPDATE products SET current_stock = current_stock - ?1 WHERE id = ?2",
                params![quantity, product_id])?;
        }
        Ok(())
    }

    pub fn get_inventory_method(&self) -> Result<String> {
        let conn = self.conn.lock().unwrap();
        let method: String = conn.query_row(
            "SELECT COALESCE((SELECT value FROM settings WHERE key='inventory_method'), 'wac')",
            [], |row| row.get(0))?;
        Ok(method)
    }

    pub fn set_inventory_method(&self, method: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('inventory_method', ?1)", params![method])?;
        Ok(())
    }

    pub fn get_inventory_valuation(&self, company_id: i64, method: &str, as_of_date: Option<&str>) -> Result<Vec<InventoryValuation>> {
        let products = self.get_products(Some(company_id))?;
        let conn = self.conn.lock().unwrap();
        let mut result = Vec::new();
        for product in products {
            let qty_sql = if let Some(ref d) = as_of_date {
                format!(
                    "SELECT COALESCE(SUM(qty_in - qty_out), 0),
                            COALESCE(SUM(CASE WHEN movement_type = 'purchase' THEN total_cost ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN movement_type = 'purchase' THEN qty_in ELSE 0 END), 0)
                     FROM inventory_movements WHERE product_id = {} AND date <= '{}'",
                    product.id, d
                )
            } else {
                format!(
                    "SELECT COALESCE(SUM(qty_in - qty_out), 0),
                            COALESCE(SUM(CASE WHEN movement_type = 'purchase' THEN total_cost ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN movement_type = 'purchase' THEN qty_in ELSE 0 END), 0)
                     FROM inventory_movements WHERE product_id = {}",
                    product.id
                )
            };
            let (qty, total_purchase_cost, total_purchase_qty): (f64, f64, f64) = conn.query_row(
                &qty_sql, [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            )?;
            if method == "fifo" && qty > 0.0 {
                // FIFO: simulate layer consumption
                let fifo_sql = if let Some(ref d) = as_of_date {
                    format!(
                        "SELECT date, qty_in, qty_out, unit_cost, total_cost FROM inventory_movements
                         WHERE product_id = {} AND date <= '{}' ORDER BY date",
                        product.id, d
                    )
                } else {
                    format!(
                        "SELECT date, qty_in, qty_out, unit_cost, total_cost FROM inventory_movements
                         WHERE product_id = {} ORDER BY date", product.id
                    )
                };
                let mut stmt = conn.prepare(&fifo_sql)?;
                let rows = stmt.query_map([], |row| {
                    let date: String = row.get(0)?;
                    let qty_in: f64 = row.get(1)?;
                    let qty_out: f64 = row.get(2)?;
                    let unit_cost: f64 = row.get(3)?;
                    let total_cost: f64 = row.get(4)?;
                    Ok((date, qty_in, qty_out, unit_cost, total_cost))
                })?;
                let mut layers: Vec<(f64, f64)> = Vec::new(); // (remaining_qty, unit_cost)
                for row in rows {
                    let (_date, qty_in, qty_out, unit_cost, _total_cost) = row?;
                    if qty_in > 0.0 {
                        layers.push((qty_in, unit_cost));
                    }
                    if qty_out > 0.0 {
                        let mut remaining = qty_out;
                        for layer in layers.iter_mut() {
                            if remaining <= 0.0 { break; }
                            let consume = layer.0.min(remaining);
                            layer.0 -= consume;
                            remaining -= consume;
                        }
                    }
                }
                let fifo_value: f64 = layers.iter().map(|(q, c)| q * c).sum();
                let avg = if qty > 0.0 { fifo_value / qty } else { 0.0 };
                result.push(InventoryValuation {
                    product_id: product.id,
                    product_code: product.code,
                    product_name: product.name,
                    unit: product.unit,
                    quantity: qty,
                    unit_cost: avg,
                    total_value: fifo_value,
                    valuation_method: method.to_string(),
                });
            } else {
                // WAC (default)
                let avg = if total_purchase_qty > 0.0 { total_purchase_cost / total_purchase_qty } else { 0.0 };
                result.push(InventoryValuation {
                    product_id: product.id,
                    product_code: product.code,
                    product_name: product.name,
                    unit: product.unit,
                    quantity: qty,
                    unit_cost: avg,
                    total_value: qty * avg,
                    valuation_method: method.to_string(),
                });
            }
        }
        Ok(result)
    }

    pub fn get_product_kardex(&self, product_id: i64, from_date: &str, to_date: &str) -> Result<Vec<KardexRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT date, movement_type, qty_in, qty_out, unit_cost, total_cost, notes FROM inventory_movements
             WHERE product_id = ?1 AND date >= ?2 AND date <= ?3 ORDER BY date"
        )?;
        let mut result = Vec::new();
        let mut qty_bal = 0.0;
        let mut cost_bal = 0.0;
        let rows = stmt.query_map(params![product_id, from_date, to_date], |row| {
            let date: String = row.get(0)?;
            let movement_type: String = row.get(1)?;
            let qty_in: f64 = row.get(2)?;
            let qty_out: f64 = row.get(3)?;
            let unit_cost: f64 = row.get(4)?;
            let total_cost: f64 = row.get(5)?;
            let notes: Option<String> = row.get(6)?;
            Ok((date, movement_type, qty_in, qty_out, unit_cost, total_cost, notes))
        })?;
        for row in rows {
            let (date, movement_type, qty_in, qty_out, unit_cost, total_cost, notes) = row?;
            qty_bal += qty_in - qty_out;
            cost_bal += (qty_in - qty_out) * unit_cost;
            result.push(KardexRow {
                date, r#type: movement_type, reference: None,
                description: notes, qty_in, qty_out, unit_cost,
                total_cost, qty_balance: qty_bal, cost_balance: cost_bal,
            });
        }
        Ok(result)
    }

    pub fn set_stock_levels(&self, product_id: i64, min_stock: Option<f64>, max_stock: Option<f64>, reorder_point: Option<f64>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE products SET min_stock=?1, max_stock=?2, reorder_point=?3 WHERE id=?4",
            params![min_stock, max_stock, reorder_point, product_id])?;
        Ok(())
    }

    pub fn get_low_stock_products(&self, company_id: i64) -> Result<Vec<StockAlertItem>> {
        let all = self.get_products(Some(company_id))?;
        Ok(all.into_iter().filter(|p| {
            if let Some(min) = p.min_stock { p.current_stock <= min } else { false }
        }).map(|p| StockAlertItem {
            product_id: p.id,
            product_code: p.code,
            product_name: p.name,
            current_quantity: p.current_stock,
            min_stock: p.min_stock,
            max_stock: p.max_stock,
            reorder_point: p.reorder_point,
        }).collect())
    }

    pub fn get_overstocked_products(&self, company_id: i64) -> Result<Vec<StockAlertItem>> {
        let all = self.get_products(Some(company_id))?;
        Ok(all.into_iter().filter(|p| {
            if let Some(max) = p.max_stock { p.current_stock >= max } else { false }
        }).map(|p| StockAlertItem {
            product_id: p.id,
            product_code: p.code,
            product_name: p.name,
            current_quantity: p.current_stock,
            min_stock: p.min_stock,
            max_stock: p.max_stock,
            reorder_point: p.reorder_point,
        }).collect())
    }

    pub fn get_stock_status_report(&self, company_id: i64, _method: &str) -> Result<Vec<StockStatusRow>> {
        let all = self.get_products(Some(company_id))?;
        Ok(all.into_iter().map(|p| StockStatusRow {
            product_id: p.id,
            product_code: p.code,
            product_name: p.name,
            unit: p.unit,
            current_quantity: p.current_stock,
            min_stock: p.min_stock,
            max_stock: p.max_stock,
            reorder_point: p.reorder_point,
            unit_cost: p.purchase_price,
            total_value: p.current_stock * p.purchase_price,
            status: p.status,
        }).collect())
    }

    // ==================== Tax Settings ====================

    pub fn get_tax_settings(&self) -> Result<TaxSetting> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, default_vat_rate, vat_number, vat_enabled, updated_at FROM tax_settings LIMIT 1",
            [],
            |row| Ok(TaxSetting {
                id: row.get(0)?, vat_rate: row.get(1)?,
                vat_registration_number: row.get(2)?,
                is_registered: row.get::<_, i32>(3)? != 0,
                created_at: row.get(4)?,
            })
        )
    }

    pub fn update_tax_settings(&self, vat_rate: f64, vat_registration_number: Option<&str>, is_registered: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tax_settings (id, default_vat_rate, vat_number, vat_enabled)
             VALUES (1, ?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET default_vat_rate=excluded.default_vat_rate, vat_number=excluded.vat_number, vat_enabled=excluded.vat_enabled",
            params![vat_rate, vat_registration_number, is_registered],
        )?;
        Ok(())
    }

    pub fn set_product_tax_rate(&self, product_id: i64, tax_rate: f64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE products SET tax_rate=?1 WHERE id=?2", params![tax_rate, product_id])?;
        Ok(())
    }

    pub fn compute_vat_summary(&self, _company_id: i64) -> Result<VatSummary> {
        let conn = self.conn.lock().unwrap();
        let (total_sales, total_purchases, vat_on_sales, vat_on_purchases): (f64, f64, f64, f64) = conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN type = 'sale' THEN subtotal END), 0),
                COALESCE(SUM(CASE WHEN type = 'purchase' THEN subtotal END), 0),
                COALESCE(SUM(CASE WHEN type = 'sale' THEN tax END), 0),
                COALESCE(SUM(CASE WHEN type = 'purchase' THEN tax END), 0)
             FROM invoices WHERE status != 'draft'",
            [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?;
        Ok(VatSummary {
            total_sales,
            total_purchases,
            vat_on_sales,
            vat_on_purchases,
            net_vat_payable: vat_on_sales - vat_on_purchases,
            tax_period_start: String::new(),
            tax_period_end: String::new(),
        })
    }

    pub fn get_tax_returns(&self) -> Result<Vec<TaxReturn>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, period, total_sales_vat, total_purchase_vat, net_vat_payable,
                    status, return_date, payment_date, paid_amount, created_at
             FROM tax_returns ORDER BY period DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(TaxReturn {
                id: row.get(0)?, period: row.get(1)?, total_sales_vat: row.get(2)?,
                total_purchase_vat: row.get(3)?, net_vat_payable: row.get(4)?,
                status: row.get(5)?, return_date: row.get(6)?,
                payment_date: row.get(7)?, paid_amount: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn create_tax_return(&self, period: &str, total_sales_vat: f64,
        total_purchase_vat: f64, net_vat_payable: f64) -> Result<TaxReturn> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tax_returns (company_id, period, period_label, start_date, end_date, total_sales_vat, total_purchase_vat, net_vat_payable, status)
             VALUES (1, ?1, ?1, '', '', ?2, ?3, ?4, 'draft')",
            params![period, total_sales_vat, total_purchase_vat, net_vat_payable],
        )?;
        let id = conn.last_insert_rowid();
        Ok(TaxReturn {
            id, period: period.to_string(), total_sales_vat, total_purchase_vat,
            net_vat_payable, status: "draft".to_string(), return_date: None,
            payment_date: None, paid_amount: None, created_at: String::new(),
        })
    }

    pub fn record_tax_payment(&self, id: i64, payment_date: &str, amount: f64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tax_returns SET paid_amount = COALESCE(paid_amount, 0) + ?1,
             payment_date = ?2,
             status = CASE WHEN COALESCE(paid_amount, 0) + ?1 >= net_vat_payable THEN 'paid' ELSE 'draft' END
             WHERE id = ?3",
            params![amount, payment_date, id],
        )?;
        Ok(())
    }

    pub fn delete_tax_return(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let status: String = conn.query_row(
            "SELECT status FROM tax_returns WHERE id = ?1", params![id], |r| r.get(0),
        ).unwrap_or_else(|_| "draft".to_string());
        if status != "draft" {
            return Err(rusqlite::Error::InvalidParameterName(
                "اظهارنامه پرداخت‌شده قابل حذف نیست".into(),
            ));
        }
        conn.execute("DELETE FROM tax_returns WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_product_quantity(&self, product_id: i64) -> Result<f64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT current_stock FROM products WHERE id = ?1",
            params![product_id], |row| row.get(0),
        )
    }

}
