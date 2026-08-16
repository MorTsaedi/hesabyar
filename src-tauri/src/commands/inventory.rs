//! Inventory valuation commands.
//!
//! Exposes the inventory ledger to the frontend:
//!   * `get_inventory_method` / `set_inventory_method` — pick the
//!     valuation method (WAC or FIFO)
//!   * `get_inventory_valuation` — per-product snapshot
//!   * `get_product_kardex` — movement history for one product
//!   * `record_inventory_adjustment` — manual stock count correction
//!   * `set_stock_levels` — update min/max/reorder-point thresholds
//!   * `get_low_stock_products` — products below reorder point
//!   * `get_overstocked_products` — products above max stock

use crate::db::{Database, InventoryValuation, KardexRow, StockAlertItem, StockStatusRow};
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn get_inventory_method(db: State<Database>) -> Result<String, String> {
    db.get_inventory_method().map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_inventory_method(db: State<Database>, method: String) -> Result<(), String> {
    db.set_inventory_method(&method).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_inventory_valuation(
    db: State<Database>,
    method: String,
    as_of_date: Option<String>,
) -> Result<Vec<InventoryValuation>, String> {
    db.get_inventory_valuation(1, &method, as_of_date.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_product_kardex(
    db: State<Database>,
    product_id: i64,
    from_date: String,
    to_date: String,
) -> Result<Vec<KardexRow>, String> {
    db.get_product_kardex(product_id, &from_date, &to_date)
        .map_err(|e| e.to_string())
}

/// Manual stock-count adjustment. The user enters the new on-hand
/// quantity and the per-unit cost they want it valued at; we record
/// a single inventory_movements row with movement_type='adjustment'
/// whose qty_in/qty_out brings the running total to the requested
/// amount.
#[tauri::command(rename_all = "snake_case")]
pub fn record_inventory_adjustment(
    db: State<Database>,
    product_id: i64,
    date: String,
    new_quantity: f64,
    unit_cost: f64,
    notes: String,
) -> Result<i64, String> {
    let current_qty = db
        .get_product_quantity(product_id)
        .map_err(|e| e.to_string())?;
    let delta = new_quantity - current_qty;
    if delta.abs() < 0.0001 {
        return Err("تغییری در موجودی ایجاد نشد".into());
    }
    let qty_in = if delta > 0.0 { delta } else { 0.0 };
    let qty_out = if delta < 0.0 { -delta } else { 0.0 };
    if qty_in > 0.0 {
        db.record_inventory_movement(product_id, "in", qty_in, unit_cost, &date, None, Some(&notes))
            .map_err(|e| e.to_string())?;
    }
    if qty_out > 0.0 {
        db.record_inventory_movement(product_id, "out", qty_out, unit_cost, &date, None, Some(&notes))
            .map_err(|e| e.to_string())?;
    }
    Ok(product_id)
}

/// Set stock-control thresholds (min stock, max stock, reorder point)
/// for a single product.
#[tauri::command(rename_all = "snake_case")]
pub fn set_stock_levels(
    db: State<Database>,
    product_id: i64,
    min_stock: Option<f64>,
    max_stock: Option<f64>,
    reorder_point: Option<f64>,
) -> Result<(), String> {
    db.set_stock_levels(product_id, min_stock, max_stock, reorder_point)
        .map_err(|e| e.to_string())
}

/// Returns products whose current on-hand quantity is at or below the
/// configured reorder-point (or min-stock if reorder-point is 0).
#[tauri::command(rename_all = "snake_case")]
pub fn get_low_stock_products(
    db: State<Database>,
    company_id: i64,
) -> Result<Vec<StockAlertItem>, String> {
    db.get_low_stock_products(company_id)
        .map_err(|e| e.to_string())
}

/// Returns products whose current on-hand quantity exceeds the
/// configured max-stock level (only when max_stock > 0).
#[tauri::command(rename_all = "snake_case")]
pub fn get_overstocked_products(
    db: State<Database>,
    company_id: i64,
) -> Result<Vec<StockAlertItem>, String> {
    db.get_overstocked_products(company_id)
        .map_err(|e| e.to_string())
}

/// Comprehensive stock-status report — combines product info,
/// current quantity, stock thresholds, and current valuation into
/// a single table. `method` ∈ {wac, fifo}.
#[tauri::command(rename_all = "snake_case")]
pub fn get_stock_status_report(
    db: State<Database>,
    company_id: i64,
    method: String,
) -> Result<Vec<StockStatusRow>, String> {
    db.get_stock_status_report(company_id, &method)
        .map_err(|e| e.to_string())
}