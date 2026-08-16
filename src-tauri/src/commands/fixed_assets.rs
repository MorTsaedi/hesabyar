#![allow(non_snake_case)]

//! Fixed Assets — asset register, depreciation engine & disposal.

use crate::db::{Database, DepreciationRun, DepreciationSummary, FixedAsset};
use tauri::State;

#[tauri::command]
pub fn get_fixed_assets(db: State<Database>, companyId: i64) -> Result<Vec<FixedAsset>, String> {
    db.get_fixed_assets(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_fixed_asset(
    db: State<Database>,
    companyId: i64,
    code: String,
    name: String,
    category: Option<String>,
    purchaseDate: String,
    purchaseCost: f64,
    usefulLifeYears: i32,
    salvageValue: f64,
    depreciationMethod: String,
    location: Option<String>,
    description: Option<String>,
) -> Result<FixedAsset, String> {
    db.create_fixed_asset(
        companyId, &code, &name, category.as_deref(), &purchaseDate,
        purchaseCost, usefulLifeYears, salvageValue, &depreciationMethod,
        location.as_deref(), description.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_fixed_asset(
    db: State<Database>,
    id: i64,
    code: String,
    name: String,
    category: Option<String>,
    purchaseDate: String,
    purchaseCost: f64,
    usefulLifeYears: i32,
    salvageValue: f64,
    depreciationMethod: String,
    location: Option<String>,
    description: Option<String>,
    status: String,
) -> Result<(), String> {
    db.update_fixed_asset(
        id, &code, &name, category.as_deref(), &purchaseDate,
        purchaseCost, usefulLifeYears, salvageValue, &depreciationMethod,
        location.as_deref(), description.as_deref(), &status,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_fixed_asset(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_fixed_asset(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_depreciation_summaries(db: State<Database>, companyId: i64) -> Result<Vec<DepreciationSummary>, String> {
    db.get_depreciation_summaries(companyId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn record_depreciation(db: State<Database>, assetId: i64, period: String) -> Result<DepreciationRun, String> {
    db.record_depreciation(assetId, &period).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_depreciation_history(db: State<Database>, assetId: i64) -> Result<Vec<DepreciationRun>, String> {
    db.get_depreciation_history(assetId).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn dispose_asset(db: State<Database>, id: i64, status: String) -> Result<FixedAsset, String> {
    db.dispose_asset(id, &status).map_err(|e| e.to_string())
}
