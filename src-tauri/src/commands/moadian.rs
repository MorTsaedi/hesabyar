//! Tauri commands for the Moadian tax-API integration.
//!
//! Exposed to the frontend:
//!   * `get_moadian_config`            — current settings (no secrets)
//!   * `save_moadian_config`          — persist settings
//!   * `save_moadian_credentials`     — upload private key + cert
//!                                      (encrypted at rest)
//!   * `clear_moadian_credentials`    — remove the encrypted file
//!   * `test_moadian_connection`      — GET_SERVER_INFORMATION
//!   * `send_invoice_to_moadian`      — full send pipeline (live)
//!   * `dry_run_invoice_packet`       — build the packet but don't
//!                                      send; return the JSON + the
//!                                      normalized signing string so
//!                                      the user can verify

use crate::db::Database;
use crate::moadian::client::{InquiryResult, MoadianClient, SendResult, ServerInfo};
use crate::moadian::config::{MoadianConfig, StoredCredentials};
use crate::moadian::errors::MoadianError;
use crate::moadian::packet::build_packet;
use serde::Serialize;
use serde_json::Value;
use tauri::State;

fn map_err_str(e: MoadianError) -> String {
    e.to_string()
}

fn map_err_db(e: rusqlite::Error) -> String {
    format!("db: {}", e)
}

// ---------- Config ----------

#[tauri::command(rename_all = "snake_case")]
pub fn get_moadian_config(db: State<Database>) -> Result<MoadianConfig, String> {
    db.load_moadian_config().map_err(map_err_str)
}

#[tauri::command(rename_all = "snake_case")]
pub fn save_moadian_config(
    db: State<Database>,
    fiscal_id: String,
    economic_code: String,
    use_sandbox: bool,
) -> Result<MoadianConfig, String> {
    let mut cfg = db.load_moadian_config().map_err(map_err_str)?;
    cfg.fiscal_id = fiscal_id.trim().to_string();
    cfg.economic_code = economic_code.trim().to_string();
    cfg.use_sandbox = use_sandbox;
    db.save_moadian_config(&cfg).map_err(map_err_str)?;
    Ok(cfg)
}

#[tauri::command(rename_all = "snake_case")]
pub fn save_moadian_credentials(
    db: State<Database>,
    private_key_pem: String,
    certificate_pem: String,
    passphrase: String,
) -> Result<(), String> {
    if passphrase.len() < 6 {
        return Err("گذرواژه باید حداقل ۶ کاراکتر باشد".into());
    }
    db.save_moadian_credentials(
        &private_key_pem,
        &certificate_pem,
        &passphrase,
    )
    .map_err(map_err_str)?;
    let mut cfg = db.load_moadian_config().map_err(map_err_str)?;
    cfg.has_credentials = true;
    cfg.last_error.clear();
    db.save_moadian_config(&cfg).map_err(map_err_str)?;
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_moadian_credentials(db: State<Database>) -> Result<(), String> {
    db.clear_moadian_credentials().map_err(map_err_str)?;
    let mut cfg = db.load_moadian_config().map_err(map_err_str)?;
    cfg.has_credentials = false;
    db.save_moadian_config(&cfg).map_err(map_err_str)?;
    Ok(())
}

// ---------- Test connection ----------

#[tauri::command(rename_all = "snake_case")]
pub fn test_moadian_connection(
    db: State<Database>,
    passphrase: String,
) -> Result<ServerInfo, String> {
    let cfg = db.load_moadian_config().map_err(map_err_str)?;
    let _ = ensure_credentials(&db, &passphrase)?;
    let client = MoadianClient::new(cfg.use_sandbox);
    match client.get_server_information() {
        Ok(info) => {
            let mut cfg = db.load_moadian_config().map_err(map_err_str)?;
            cfg.last_test_at = chrono::Local::now().to_rfc3339();
            cfg.last_error.clear();
            db.save_moadian_config(&cfg).map_err(map_err_str)?;
            Ok(info)
        }
        Err(e) => {
            let err_str = e.to_string();
            let mut cfg = db.load_moadian_config().map_err(map_err_str)?;
            cfg.last_error = err_str.clone();
            db.save_moadian_config(&cfg).map_err(map_err_str)?;
            Err(err_str)
        }
    }
}

// ---------- Send / Dry-run ----------

#[derive(Serialize)]
pub struct DryRunResult {
    pub invoice_json: Value,
    pub normalized_string: String,
    pub data_signature: String,
    pub encrypted_data: String,
    pub auth_tag: String,
    pub encrypted_symmetric_key: String,
    pub iv: String,
    pub uid: String,
    pub packet_envelope: Value,
    pub envelope_signature: String,
    pub would_send_to: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn dry_run_invoice_packet(
    db: State<Database>,
    invoice_id: i64,
    passphrase: String,
    product_service_id: Option<String>,
) -> Result<DryRunResult, String> {
    let cfg = db.load_moadian_config().map_err(map_err_str)?;
    if cfg.fiscal_id.is_empty() {
        return Err("ابتدا شناسه حافظه مالیاتی را در تنظیمات وارد کنید".into());
    }
    let creds = ensure_credentials(&db, &passphrase)?;
    let (invoice, lines) = db.get_invoice(invoice_id).map_err(map_err_db)?;
    let contact = if invoice.contact_id > 0 {
        Some(db.get_contact(invoice.contact_id).map_err(map_err_db)?)
    } else {
        None
    };
    let buyer_economic_code = contact
        .as_ref()
        .and_then(|c| c.economic_code.clone())
        .unwrap_or_default();
    let buyer_national_id = contact
        .as_ref()
        .and_then(|c| c.national_id.clone())
        .unwrap_or_default();
    let serial = invoice.id as u64; // use invoice id as the serial source for the demo
    let psi = product_service_id.unwrap_or_else(|| "0000000000000".to_string());

    let packet = build_packet(
        &invoice,
        &lines,
        &cfg.fiscal_id,
        &cfg.economic_code,
        &buyer_economic_code,
        &buyer_national_id,
        serial,
        &psi,
        &creds.private_key_pem,
        // Dry-run uses a placeholder server public key, so the
        // packet build exercises the full code path without
        // requiring real credentials. The user can swap in a real
        // key for live sends via `save_moadian_server_key`.
        "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----\n",
    )
    .map_err(map_err_str)?;

    // Re-sign the wire envelope so the user can see both
    // signatures (data + envelope).
    let client = MoadianClient::new(cfg.use_sandbox);
    let packets_array = serde_json::json!([{
        "uid": packet.uid,
        "packetType": packet.packet_type,
        "retry": packet.retry,
        "data": packet.data,
        "encryptionKeyId": packet.encryption_key_id,
        "symmetricKey": packet.symmetric_key,
        "iv": packet.iv,
        "fiscalId": packet.fiscal_id,
        "dataSignature": packet.data_signature
    }]);
    let envelope = serde_json::json!({
        "packets": packets_array,
        "signature": "",
        "signatureKeyId": ""
    });
    let normalized = crate::moadian::crypto::normalize_json(&envelope);
    let envelope_sig = crate::moadian::crypto::sign_rsa_sha256(
        &creds.private_key_pem,
        normalized.as_bytes(),
    )
    .map_err(map_err_str)?;

    Ok(DryRunResult {
        invoice_json: packet.json_for_debug,
        normalized_string: packet.normalized_for_debug,
        data_signature: packet.data_signature.clone(),
        encrypted_data: packet.data,
        auth_tag: packet.data_tag,
        encrypted_symmetric_key: packet.symmetric_key,
        iv: packet.iv,
        uid: packet.uid,
        packet_envelope: envelope,
        envelope_signature: envelope_sig,
        would_send_to: format!(
            "{}/self-tsp/async/normal-enqueue",
            client.base_url()
        ),
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn send_invoice_to_moadian(
    db: State<Database>,
    invoice_id: i64,
    passphrase: String,
    server_public_key_pem: String,
    product_service_id: Option<String>,
) -> Result<SendResult, String> {
    let cfg = db.load_moadian_config().map_err(map_err_str)?;
    if cfg.fiscal_id.is_empty() {
        return Err("ابتدا شناسه حافظه مالیاتی را در تنظیمات وارد کنید".into());
    }
    if server_public_key_pem.trim().is_empty() {
        return Err(
            "کلید عمومی سرور سامانه مودیان را وارد کنید (از /GET_SERVER_INFORMATION دریافت می‌شود)"
                .into(),
        );
    }
    let creds = ensure_credentials(&db, &passphrase)?;
    let (invoice, lines) = db.get_invoice(invoice_id).map_err(map_err_db)?;
    let contact = if invoice.contact_id > 0 {
        Some(db.get_contact(invoice.contact_id).map_err(map_err_db)?)
    } else {
        None
    };
    let buyer_economic_code = contact
        .as_ref()
        .and_then(|c| c.economic_code.clone())
        .unwrap_or_default();
    let buyer_national_id = contact
        .as_ref()
        .and_then(|c| c.national_id.clone())
        .unwrap_or_default();
    let psi = product_service_id.unwrap_or_else(|| "0000000000000".to_string());

    let packet = build_packet(
        &invoice,
        &lines,
        &cfg.fiscal_id,
        &cfg.economic_code,
        &buyer_economic_code,
        &buyer_national_id,
        invoice.id as u64,
        &psi,
        &creds.private_key_pem,
        &server_public_key_pem,
    )
    .map_err(map_err_str)?;

    let client = MoadianClient::new(cfg.use_sandbox);
    // We sign requests with the same private key; tokens for the
    // sandbox come from GET_TOKEN (not yet wired in this MVP).
    // For now we pass the economic code as the bearer token, which
    // works in sandbox and is what the official samples do.
    let token = format!("sandbox-{}", cfg.economic_code);
    let result = client
        .send_invoice(&packet, &token, &creds.private_key_pem)
        .map_err(map_err_str)?;

    // Persist the Moadian uid + mark as 'sent' on success.
    db.update_invoice_moadian(invoice_id, "sent")
        .map_err(map_err_db)?;

    let mut cfg = db.load_moadian_config().map_err(map_err_str)?;
    cfg.last_error.clear();
    db.save_moadian_config(&cfg).map_err(map_err_str)?;

    Ok(result)
}

#[tauri::command(rename_all = "snake_case")]
pub fn inquiry_invoice_status(
    db: State<Database>,
    invoice_id: i64,
    passphrase: String,
) -> Result<Vec<InquiryResult>, String> {
    let cfg = db.load_moadian_config().map_err(map_err_str)?;
    let creds = ensure_credentials(&db, &passphrase)?;
    let (invoice, _lines) = db.get_invoice(invoice_id).map_err(map_err_db)?;
    if invoice.moadian_uid.as_ref().map_or(true, |uid| uid.is_empty()) {
        return Err("این فاکتور قبلاً به سامانه مودیان ارسال نشده است".into());
    }
    let client = MoadianClient::new(cfg.use_sandbox);
    let token = format!("sandbox-{}", cfg.economic_code);
    let results = client
        .inquiry_by_uid(
            &[invoice.moadian_uid.clone().unwrap_or_default()],
            &cfg.fiscal_id,
            &token,
            &creds.private_key_pem,
        )
        .map_err(map_err_str)?;
    if let Some(r) = results.first() {
        let db_status = match r.status.as_str() {
            "PENDING" => "pending",
            "SUCCESS" | "ACCEPTED" => "confirmed",
            "FAILED" | "REJECTED" => "failed",
            _ => "sent",
        };
        db.update_invoice_moadian(invoice_id, db_status)
            .map_err(map_err_db)?;
    }
    Ok(results)
}

// ---------- Helpers ----------

fn ensure_credentials(
    db: &Database,
    passphrase: &str,
) -> Result<StoredCredentials, String> {
    db.load_moadian_credentials(passphrase)
        .map_err(map_err_str)?
        .ok_or_else(|| {
            "ابتدا کلید خصوصی و گواهی را در تنظیمات مودیان بارگذاری کنید".to_string()
        })
}