#![allow(non_snake_case)]

//! Price Lists — sale/purchase price lists per product.

use crate::db::{Database, PriceList, PriceListItem};
use tauri::State;

#[tauri::command]
pub fn get_price_lists(db: State<Database>, companyId: i64) -> Result<Vec<PriceList>, String> {
    db.get_price_lists(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_price_list(
    db: State<Database>,
    companyId: i64,
    name: String,
    r#type: String,
    isDefault: bool,
) -> Result<i64, String> {
    db.create_price_list(companyId, &name, &r#type, isDefault).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_price_list(
    db: State<Database>,
    id: i64,
    name: String,
    isDefault: bool,
) -> Result<(), String> {
    db.update_price_list(id, &name, isDefault).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_price_list(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_price_list(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_price_list_items(db: State<Database>, priceListId: i64) -> Result<Vec<PriceListItem>, String> {
    db.get_price_list_items(priceListId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_price_list_item(
    db: State<Database>,
    priceListId: i64,
    productId: i64,
    price: f64,
) -> Result<i64, String> {
    db.upsert_price_list_item(priceListId, productId, price).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_price_list_item(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_price_list_item(id).map_err(|e| e.to_string())
}
