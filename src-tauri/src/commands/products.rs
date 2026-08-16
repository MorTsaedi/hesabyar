use crate::db::{Database, Product};
use tauri::State;

#[tauri::command]
pub fn get_products(db: State<Database>) -> Result<Vec<Product>, String> {
    db.get_products(None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_products(
    db: State<Database>,
    query: String,
) -> Result<Vec<crate::db::Product>, String> {
    db.search_products(&query).map_err(|e| e.to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn create_product(
    db: State<Database>,
    name: String,
    code: Option<String>,
    product_type: Option<String>,
    unit: Option<String>,
    purchase_price: f64,
    sale_price: f64,
    description: Option<String>,
    min_stock: Option<f64>,
    max_stock: Option<f64>,
    reorder_point: Option<f64>,
    quantity: Option<f64>,
    tax_rate: Option<f64>,
) -> Result<Product, String> {
    let allowed = ["product", "service"];
    let ptype = product_type
        .as_deref()
        .filter(|t| allowed.contains(t))
        .unwrap_or("product")
        .to_string();

    let qty = quantity.unwrap_or(0.0);

    let created_product = db.create_product(
        1,
        &name,
        code.as_deref(),
        &ptype,
        unit.as_deref(),
        purchase_price,
        sale_price,
        description.as_deref(),
        min_stock,
        max_stock,
        reorder_point,
        qty,
        tax_rate,
    ).map_err(|e| e.to_string())?;

    let _ = db.log_audit(1, "create", "product", Some(created_product.id), &format!("کالا/خدمت «{}» ایجاد شد", name), None);
    Ok(created_product)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_product(
    db: State<Database>,
    id: i64,
    name: String,
    code: Option<String>,
    product_type: Option<String>,
    unit: Option<String>,
    purchase_price: f64,
    sale_price: f64,
    description: Option<String>,
) -> Result<Product, String> {
    let allowed = ["product", "service"];
    let ptype = product_type
        .as_deref()
        .filter(|t| allowed.contains(t))
        .unwrap_or("product")
        .to_string();

    db.update_product(
        id,
        &name,
        code.as_deref(),
        &ptype,
        unit.as_deref(),
        purchase_price,
        sale_price,
        description.as_deref(),
    ).map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "update", "product", Some(id), &format!("کالا/خدمت «{}» ویرایش شد", name), None);

    // Fetch and return the updated product
    let products = db.get_products(None).map_err(|e| e.to_string())?;
    for product in products {
        if product.id == id {
            return Ok(product);
        }
    }
    Err(format!("Product with id {} not found", id))
}

#[tauri::command]
pub fn delete_product(db: State<Database>, id: i64) -> Result<(), String> {
    db.delete_product(id).map_err(|e| e.to_string())?;
    let _ = db.log_audit(1, "delete", "product", Some(id), "کالا/خدمت حذف شد", None);
    Ok(())
}
