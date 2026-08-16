use rusqlite::{params, OptionalExtension, Result};
use super::core::Database;
use super::structs::*;

impl Database {
    // ==================== FIXED ASSETS ====================

    pub fn get_fixed_assets(&self, company_id: i64) -> Result<Vec<FixedAsset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, code, name, category, purchase_date, purchase_cost,
                    useful_life_years, salvage_value, depreciation_method,
                    accumulated_depreciation, status, location, description, created_at
             FROM fixed_assets WHERE company_id = ?1 ORDER BY code"
        )?;
        let rows = stmt.query_map(params![company_id], |row| {
            let purchase_cost: f64 = row.get(6)?;
            let accumulated: f64 = row.get(10)?;
            let salvage: f64 = row.get(8)?;
            Ok(FixedAsset {
                id: row.get(0)?, company_id: row.get(1)?,
                code: row.get(2)?, name: row.get(3)?,
                category: row.get(4)?, purchase_date: row.get(5)?,
                purchase_cost,
                useful_life_years: row.get(7)?,
                salvage_value: salvage,
                depreciation_method: row.get(9)?,
                accumulated_depreciation: accumulated,
                book_value: (purchase_cost - accumulated).max(0.0),
                status: row.get(11)?, location: row.get(12)?,
                description: row.get(13)?, created_at: row.get(14)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    pub fn get_fixed_asset(&self, id: i64) -> Result<Option<FixedAsset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, company_id, code, name, category, purchase_date, purchase_cost,
                    useful_life_years, salvage_value, depreciation_method,
                    accumulated_depreciation, status, location, description, created_at
             FROM fixed_assets WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            let purchase_cost: f64 = row.get(6)?;
            let accumulated: f64 = row.get(10)?;
            let salvage: f64 = row.get(8)?;
            Ok(FixedAsset {
                id: row.get(0)?, company_id: row.get(1)?,
                code: row.get(2)?, name: row.get(3)?,
                category: row.get(4)?, purchase_date: row.get(5)?,
                purchase_cost,
                useful_life_years: row.get(7)?,
                salvage_value: salvage,
                depreciation_method: row.get(9)?,
                accumulated_depreciation: accumulated,
                book_value: (purchase_cost - accumulated).max(0.0),
                status: row.get(11)?, location: row.get(12)?,
                description: row.get(13)?, created_at: row.get(14)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn create_fixed_asset(
        &self,
        company_id: i64,
        code: &str,
        name: &str,
        category: Option<&str>,
        purchase_date: &str,
        purchase_cost: f64,
        useful_life_years: i32,
        salvage_value: f64,
        depreciation_method: &str,
        location: Option<&str>,
        description: Option<&str>,
    ) -> Result<FixedAsset> {
        let id = {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO fixed_assets (company_id, code, name, category, purchase_date, purchase_cost,
                 useful_life_years, salvage_value, depreciation_method, location, description)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![company_id, code, name, category, purchase_date, purchase_cost,
                        useful_life_years, salvage_value, depreciation_method, location, description],
            )?;
            conn.last_insert_rowid()
        };
        self.get_fixed_asset(id).map(|a| a.unwrap())
    }

    pub fn update_fixed_asset(
        &self,
        id: i64,
        code: &str,
        name: &str,
        category: Option<&str>,
        purchase_date: &str,
        purchase_cost: f64,
        useful_life_years: i32,
        salvage_value: f64,
        depreciation_method: &str,
        location: Option<&str>,
        description: Option<&str>,
        status: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE fixed_assets SET code=?1, name=?2, category=?3, purchase_date=?4,
             purchase_cost=?5, useful_life_years=?6, salvage_value=?7,
             depreciation_method=?8, location=?9, description=?10, status=?11
             WHERE id=?12",
            params![code, name, category, purchase_date, purchase_cost,
                    useful_life_years, salvage_value, depreciation_method, location, description, status, id],
        )?;
        Ok(())
    }

    pub fn delete_fixed_asset(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM depreciation_runs WHERE asset_id = ?1", params![id])?;
        conn.execute("DELETE FROM fixed_assets WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ==================== DEPRECIATION ENGINE ====================

    /// Calculate monthly depreciation for an asset.
    pub fn monthly_depreciation(&self, asset: &FixedAsset) -> f64 {
        if asset.useful_life_years <= 0 || asset.status != "active" {
            return 0.0;
        }
        let depreciable_base = (asset.purchase_cost - asset.salvage_value).max(0.0);
        match asset.depreciation_method.as_str() {
            // Declining balance: % = 1.5 / useful life (150% rule), applied to book value
            "declining_balance" => {
                let annual_rate = 1.5 / asset.useful_life_years as f64;
                let remaining = (asset.purchase_cost - asset.accumulated_depreciation).max(0.0);
                let amount = remaining * annual_rate / 12.0;
                // Cap so book value never falls below salvage value
                let max_allowed = remaining - asset.salvage_value;
                amount.min(max_allowed).max(0.0)
            }
            _ => {
                let monthly = depreciable_base / (asset.useful_life_years as f64 * 12.0);
                let max_allowed = (asset.purchase_cost - asset.accumulated_depreciation - asset.salvage_value).max(0.0);
                monthly.min(max_allowed).max(0.0)
            }
        }
    }

    pub fn get_depreciation_summaries(&self, company_id: i64) -> Result<Vec<DepreciationSummary>> {
        let assets = self.get_fixed_assets(company_id)?;
        let mut result = Vec::new();
        for asset in assets {
            if asset.status != "active" {
                continue;
            }
            let monthly = self.monthly_depreciation(&asset);
            let remaining_months: i64 = if monthly > 0.0 {
                (((asset.purchase_cost - asset.accumulated_depreciation - asset.salvage_value).max(0.0)) / monthly).ceil() as i64
            } else {
                0
            };
            result.push(DepreciationSummary {
                asset_id: asset.id,
                asset_code: asset.code,
                asset_name: asset.name,
                purchase_cost: asset.purchase_cost,
                accumulated_depreciation: asset.accumulated_depreciation,
                book_value: asset.book_value,
                monthly_depreciation: monthly,
                remaining_months,
            });
        }
        Ok(result)
    }

    /// Record a depreciation run for an asset in a given period (format YYYY/MM).
    pub fn record_depreciation(&self, asset_id: i64, period: &str) -> Result<DepreciationRun> {
        let conn = self.conn.lock().unwrap();
        let asset_row: Option<(f64, f64, f64, i32, String)> = conn
            .query_row(
                "SELECT purchase_cost, salvage_value, accumulated_depreciation,
                        useful_life_years, depreciation_method
                 FROM fixed_assets WHERE id = ?1",
                params![asset_id],
                |row| {
                    Ok((
                        row.get(0)?, row.get(1)?, row.get(2)?,
                        row.get(3)?, row.get(4)?,
                    ))
                },
            )
            .optional()?;

        let (purchase_cost, salvage_value, accumulated, useful_life_years, method) =
            match asset_row {
                Some(a) => a,
                None => {
                    return Err(rusqlite::Error::InvalidParameterName("asset not found".into()));
                }
            };
        let amount = if method == "declining_balance" {
            let annual_rate = 1.5 / useful_life_years as f64;
            let remaining = (purchase_cost - accumulated).max(0.0);
            let a = remaining * annual_rate / 12.0;
            a.min(remaining - salvage_value).max(0.0)
        } else {
            let monthly = (purchase_cost - salvage_value).max(0.0) / (useful_life_years as f64 * 12.0);
            monthly.min((purchase_cost - accumulated - salvage_value).max(0.0)).max(0.0)
        };

        if amount <= 0.0 {
            return Err(rusqlite::Error::InvalidParameterName(
                "دارایی مستهلک شده یا غیرفعال است".into(),
            ));
        }
        conn.execute(
            "INSERT INTO depreciation_runs (asset_id, period, amount) VALUES (?1, ?2, ?3)
             ON CONFLICT(asset_id, period) DO UPDATE SET amount = excluded.amount",
            params![asset_id, period, amount],
        )?;
        let id = conn.last_insert_rowid();
        // Recompute accumulated depreciation from history
        let accumulated: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM depreciation_runs WHERE asset_id = ?1",
            params![asset_id],
            |row| row.get(0),
        )?;
        conn.execute(
            "UPDATE fixed_assets SET accumulated_depreciation = ?1 WHERE id = ?2",
            params![accumulated, asset_id],
        )?;
        drop(conn);
        let row = self.get_depreciation_history(asset_id)?.into_iter().find(|r| r.id == id);
        row.ok_or_else(|| rusqlite::Error::InvalidParameterName("run not found".into()))
    }

    pub fn get_depreciation_history(&self, asset_id: i64) -> Result<Vec<DepreciationRun>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT dr.id, dr.asset_id, fa.code, fa.name, dr.period, dr.amount, dr.journal_entry_id, dr.created_at
             FROM depreciation_runs dr JOIN fixed_assets fa ON fa.id = dr.asset_id
             WHERE dr.asset_id = ?1 ORDER BY dr.period DESC"
        )?;
        let rows = stmt.query_map(params![asset_id], |row| {
            Ok(DepreciationRun {
                id: row.get(0)?, asset_id: row.get(1)?,
                asset_code: row.get(2)?, asset_name: row.get(3)?,
                period: row.get(4)?, amount: row.get(5)?,
                journal_entry_id: row.get(6)?, created_at: row.get(7)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows { result.push(row?); }
        Ok(result)
    }

    /// Dispose or sell an asset, resetting accumulated depreciation to full cost.
    pub fn dispose_asset(&self, id: i64, status: &str) -> Result<FixedAsset> {
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "UPDATE fixed_assets SET status = ?1, accumulated_depreciation = purchase_cost WHERE id = ?2",
                params![status, id],
            )?;
        }
        self.get_fixed_asset(id).map(|a| a.unwrap())
    }
}
