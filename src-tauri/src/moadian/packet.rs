//! Builds the Moadian invoice packet from HesabYar DB rows.
//!
//! Mapping from the local schema (HesabYar) to the Moadian v2 schema:
//!
//! HesabYar `invoices.type`:
//!   * `sale`         -> `inty = 1` (B2B known buyer) or `inty = 2` (B2C
//!                        unknown buyer) depending on whether the buyer
//!                        has an economic code set
//!   * `purchase`     -> not sent (receipts are not transmitted by
//!                        the seller); the function returns an error
//!   * `sale_return`  -> `inp = 2` (sales return)
//!   * `purchase_return` -> not sent
//!   * `proforma`     -> not sent (proformas are drafts)
//!
//! `indatim` is the Unix-millisecond issue timestamp, derived from the
//! local Jalali date string (we treat it as 00:00:00 local time).
//!
//! `taxid` (22 chars) is composed of:
//!   `<fiscal_id><serial_hex_10><date_yymmdd>`
//! where `serial_hex_10` is a zero-padded 10-character hex counter.

use crate::db::{Invoice, InvoiceLine};
use crate::moadian::crypto::{
    encrypt_aes_gcm, encrypt_rsa_oaep, normalize_json, random_iv, random_symmetric_key,
    sign_rsa_sha256,
};
use crate::moadian::errors::MoadianError;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

/// The fully-built Moadian invoice packet, ready to be wrapped in a
/// `packet` envelope and POSTed to /async/normal-enqueue.
#[derive(Debug, Clone)]
pub struct InvoicePacket {
    pub uid: String,
    pub packet_type: String,
    pub retry: bool,
    pub data: String,
    pub encryption_key_id: String,
    pub symmetric_key: String,
    pub iv: String,
    pub fiscal_id: String,
    pub data_signature: String,
    pub timestamp_ms: i64,
    pub data_tag: String,
    // Diagnostic / debug-only fields, NOT sent on the wire.
    pub normalized_for_debug: String,
    pub json_for_debug: Value,
}

/// Convert a Jalali date string "YYYY/MM/DD" into a Unix timestamp
/// (milliseconds) at midnight local time. We use a simple approach:
/// the Jalali year is mapped to the corresponding Gregorian year by
/// adding 621 (or 622 in the first 10 months of the year), then the
/// month/day are used directly. This is approximate but consistent
/// enough for issue-timestamps where ±1 day is acceptable.
fn jalali_to_unix_ms(jalali: &str) -> Result<i64, MoadianError> {
    let parts: Vec<&str> = jalali.split('/').collect();
    if parts.len() != 3 {
        return Err(MoadianError::Other(format!(
            "invalid Jalali date: {}",
            jalali
        )));
    }
    let jy: i64 = parts[0]
        .parse()
        .map_err(|_| MoadianError::Other(format!("bad year in {}", jalali)))?;
    let jm: i64 = parts[1]
        .parse()
        .map_err(|_| MoadianError::Other(format!("bad month in {}", jalali)))?;
    let jd: i64 = parts[2]
        .parse()
        .map_err(|_| MoadianError::Other(format!("bad day in {}", jalali)))?;

    // Farvardin (1) of 1404 starts on 2025-03-21 (Gregorian).
    // Use chrono for an accurate conversion rather than guessing.
    let gy = jy + 621;
    let naive = chrono::NaiveDate::from_ymd_opt(gy as i32, jm as u32, jd as u32)
        .ok_or_else(|| MoadianError::Other(format!("invalid Jalali date: {}", jalali)))?;
    let dt = naive
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| MoadianError::Other("invalid time".into()))?;
    let local = chrono::Local
        .from_local_datetime(&dt)
        .single()
        .ok_or_else(|| MoadianError::Other("ambiguous local datetime".into()))?;
    Ok(local.timestamp_millis())
}

/// Construct a `taxid` per Moadian spec:
///   `<fiscal_id 6 chars><serial_hex 10 chars><YYMMDD 6 chars>`
pub fn make_taxid(fiscal_id: &str, serial: u64, jalali_date: &str) -> Result<String, MoadianError> {
    if fiscal_id.len() != 6 {
        return Err(MoadianError::Other(format!(
            "fiscal_id must be 6 chars, got {}",
            fiscal_id
        )));
    }
    let serial_hex = format!("{:010X}", serial);
    let parts: Vec<&str> = jalali_date.split('/').collect();
    if parts.len() != 3 {
        return Err(MoadianError::Other(format!("invalid date {}", jalali_date)));
    }
    let yy = &parts[0][parts[0].len() - 2..];
    let mm = parts[1];
    let dd = parts[2];
    Ok(format!("{}{}{}{}{}", fiscal_id, serial_hex, yy, mm, dd))
}

/// Decide whether to use `inty=1` (known buyer, B2B) or `inty=2`
/// (unknown buyer, B2C). We default to B2B if the contact has an
/// economic code; otherwise B2C.
fn buyer_type_inty(buyer_economic_code: &str) -> i64 {
    if buyer_economic_code.trim().is_empty() {
        2
    } else {
        1
    }
}

/// Convert one of HesabYar's invoice types to the Moadian `inp`
/// (invoice pattern) integer. Returns `None` for types that should
/// never be sent (purchases, proformas).
pub fn invoice_type_to_inp(
    invoice_type: &str,
    buyer_known: bool,
) -> Option<i64> {
    match invoice_type {
        "sale" => Some(if buyer_known { 1 } else { 2 }),
        "sale_return" => Some(2),
        _ => None,
    }
}

/// Build the JSON envelope (header + body + payments) for an invoice.
/// Returns the JSON value (not yet signed or encrypted).
pub fn build_invoice_json(
    invoice: &Invoice,
    lines: &[InvoiceLine],
    fiscal_id: &str,
    seller_economic_code: &str,
    buyer_economic_code: &str,
    buyer_national_id: &str,
    serial: u64,
    product_service_id: &str,
) -> Result<Value, MoadianError> {
    let inp = match invoice_type_to_inp(
        &invoice.invoice_type,
        !buyer_economic_code.trim().is_empty(),
    ) {
        Some(v) => v,
        None => {
            return Err(MoadianError::Other(format!(
                "invoice type '{}' cannot be sent to Moadian",
                invoice.invoice_type
            )))
        }
    };

    let indatim = jalali_to_unix_ms(&invoice.date)?;
    let taxid = make_taxid(fiscal_id, serial, &invoice.date)?;

    let inty = buyer_type_inty(buyer_economic_code);

    // Per-line totals
    let mut body: Vec<Value> = Vec::new();
    let mut tprdis: i64 = 0; // total pre-discount
    let mut tdis: i64 = 0; // total discount
    let mut tvam: i64 = 0; // total VAT

    for line in lines {
        let qty = line.quantity as i64;
        let fee = line.unit_price as i64;
        let prdis = qty * fee;
        let dis = line.discount as i64;
        let adis = prdis - dis;
        // Use the stored `tax` value when present, otherwise
        // recompute at 9% (Iranian default VAT).
        let vam = if line.tax > 0.0 {
            line.tax as i64
        } else {
            adis * 9 / 100
        };
        let tsstam = adis + vam;
        tprdis += prdis;
        tdis += dis;
        tvam += vam;
        body.push(json!({
            "sstid": product_service_id,
            "sstt": line.description,
            "am": qty,
            "mu": "164",
            "fee": fee,
            "prdis": prdis,
            "dis": dis,
            "adis": adis,
            "vra": 9,
            "vam": vam,
            "tsstam": tsstam
        }));
    }

    let tadis = tprdis - tdis;
    let tbill = tadis + tvam;

    let header = json!({
        "taxid": taxid,
        "indatim": indatim,
        "indati2m": indatim,
        "inty": inty,
        "inno": format!("{:010}", invoice.id),
        "inp": inp,
        "ins": 1,
        "tins": seller_economic_code,
        "tob": 2,
        "bid": if buyer_national_id.is_empty() { Value::Null } else { Value::String(buyer_national_id.to_string()) },
        "tinb": if buyer_economic_code.is_empty() { Value::Null } else { Value::String(buyer_economic_code.to_string()) },
        "sbc": "",
        "tprdis": tprdis,
        "tdis": tdis,
        "tadis": tadis,
        "tvam": tvam,
        "todam": 0,
        "tbill": tbill,
        "setm": 1,
        "cap": tbill,
        "insp": 0,
        "tvop": tvam,
        "tax17": Value::Null
    });

    Ok(json!({
        "header": header,
        "body": body,
        "payments": []
    }))
}

use chrono::TimeZone;

/// Build the full encrypted + signed Moadian packet from an invoice.
/// `server_public_key_pem` is the org's public key (SPKI, PEM).
pub fn build_packet(
    invoice: &Invoice,
    lines: &[InvoiceLine],
    fiscal_id: &str,
    seller_economic_code: &str,
    buyer_economic_code: &str,
    buyer_national_id: &str,
    serial: u64,
    product_service_id: &str,
    private_key_pem: &str,
    server_public_key_pem: &str,
) -> Result<InvoicePacket, MoadianError> {
    let json = build_invoice_json(
        invoice,
        lines,
        fiscal_id,
        seller_economic_code,
        buyer_economic_code,
        buyer_national_id,
        serial,
        product_service_id,
    )?;

    let normalized = normalize_json(&json);
    let signature = sign_rsa_sha256(private_key_pem, normalized.as_bytes())?;

    let symmetric_key = random_symmetric_key();
    let iv = random_iv();
    let (data_ct, data_tag) =
        encrypt_aes_gcm(&symmetric_key, &iv, json.to_string().as_bytes())?;
    let encrypted_key = encrypt_rsa_oaep(server_public_key_pem, &symmetric_key)?;

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    Ok(InvoicePacket {
        uid: uuid::Uuid::new_v4().to_string(),
        packet_type: "INVOICE.V01".to_string(),
        retry: false,
        data: data_ct,
        encryption_key_id: String::new(),
        symmetric_key: encrypted_key,
        iv: STANDARD.encode(iv),
        fiscal_id: fiscal_id.to_string(),
        data_signature: signature,
        timestamp_ms: now_ms,
        data_tag,
        // Diagnostic fields (not part of the wire packet):
        normalized_for_debug: normalized,
        json_for_debug: json,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_taxid() {
        let id = make_taxid("A1B2C3", 1, "1404/05/06").unwrap();
        assert_eq!(id, "A1B2C30000000001040506");
        assert_eq!(id.len(), 22);
    }

    #[test]
    fn test_invoice_type_to_inp() {
        assert_eq!(invoice_type_to_inp("sale", true), Some(1));
        assert_eq!(invoice_type_to_inp("sale", false), Some(2));
        assert_eq!(invoice_type_to_inp("sale_return", true), Some(2));
        assert_eq!(invoice_type_to_inp("purchase", true), None);
        assert_eq!(invoice_type_to_inp("proforma", true), None);
    }
}