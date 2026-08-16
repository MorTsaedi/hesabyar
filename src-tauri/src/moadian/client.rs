//! HTTP client for the Moadian tax-API.
//!
//! Implements the four endpoints we use:
//!   * `GET_TOKEN`                (sync)
//!   * `SEND_INVOICE`             (async, normal priority)
//!   * `INQUIRY_BY_UID`           (sync)
//!   * `GET_SERVER_INFORMATION`   (sync, public — no auth)
//!
//! In production, base URL is `https://tp.tax.gov.ir/req/api`.
//! In sandbox,  base URL is `https://sandboxrc.tax.gov.ir/req/api`.
//! We default to **sandbox** because real credentials are out of
//! scope for development.
//!
//! Per spec, every authenticated request must include two headers:
//!   * `Authorization: Bearer <token>`
//!   * `requestTraceId: <uuid>`  (idempotency key)
//!
//! Every request body must be wrapped in a `packets` envelope and
//! signed with the taxpayer's RSA private key (RSA-SHA256 over the
//! normalized JSON of the envelope).

use crate::moadian::crypto::{normalize_json, sign_rsa_sha256};
use crate::moadian::errors::MoadianError;
use crate::moadian::packet::InvoicePacket;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};

const PROD_BASE: &str = "https://tp.tax.gov.ir/req/api";
const SANDBOX_BASE: &str = "https://sandboxrc.tax.gov.ir/req/api";

#[derive(Debug, Clone)]
pub struct MoadianClient {
    base_url: String,
    http: reqwest::blocking::Client,
}

#[derive(Debug, Serialize)]
pub struct SendResult {
    pub uid: String,
    pub reference_number: String,
    pub timestamp_ms: i64,
    pub raw_response: Value,
}

#[derive(Debug, Serialize)]
pub struct InquiryResult {
    pub uid: String,
    pub status: String,
    pub reference_number: String,
    pub error_code: Option<String>,
    pub error_detail: Option<String>,
    pub raw_response: Value,
}

#[derive(Debug, Serialize)]
pub struct ServerInfo {
    pub server_time: String,
    pub public_keys: Vec<ServerPublicKey>,
    pub raw_response: Value,
}

#[derive(Debug, Serialize)]
pub struct ServerPublicKey {
    pub id: String,
    pub key_pem: String,
}

impl MoadianClient {
    pub fn new(use_sandbox: bool) -> Self {
        Self {
            base_url: if use_sandbox {
                SANDBOX_BASE.to_string()
            } else {
                PROD_BASE.to_string()
            },
            http: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("reqwest client"),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Sends an invoice packet. The endpoint is
    /// `<base>/self-tsp/async/normal-enqueue`.
    pub fn send_invoice(
        &self,
        packet: &InvoicePacket,
        token: &str,
        private_key_pem: &str,
    ) -> Result<SendResult, MoadianError> {
        let url = format!("{}/self-tsp/async/normal-enqueue", self.base_url);
        // Build the wire envelope. `packets` is an array (per spec)
        // and `signature` is over the normalized JSON of that array.
        let packets_array = json!([{
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
        let envelope = json!({
            "packets": packets_array,
            "signature": "",
            "signatureKeyId": ""
        });
        let normalized = normalize_json(&envelope);
        let signature = sign_rsa_sha256(private_key_pem, normalized.as_bytes())?;
        let envelope = json!({
            "packets": packets_array,
            "signature": signature,
            "signatureKeyId": ""
        });

        let trace_id = uuid::Uuid::new_v4().to_string();
        let now_ms = chrono::Local::now().timestamp_millis();

        let resp = self
            .http
            .post(&url)
            .bearer_auth(token)
            .header("requestTraceId", &trace_id)
            .json(&envelope)
            .send()?;

        let status = resp.status();
        let body_text = resp.text()?;
        let body: Value = if body_text.is_empty() {
            Value::Null
        } else {
            serde_json::from_str(&body_text).unwrap_or(Value::String(body_text.clone()))
        };
        if !status.is_success() {
            return Err(MoadianError::Http(status.as_u16(), body_text));
        }

        // Response shape: {"timestamp":..., "result":[{"uid":"...", "referenceNumber":"...", "errorCode":..., "errorDetail":...}]}
        let result_obj = body
            .get("result")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .cloned()
            .ok_or_else(|| MoadianError::Other("missing 'result' in response".into()))?;
        let uid = result_obj
            .get("uid")
            .and_then(|v| v.as_str())
            .ok_or_else(|| MoadianError::Other("missing 'uid' in response".into()))?
            .to_string();
        let reference_number = result_obj
            .get("referenceNumber")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let server_ts = body
            .get("timestamp")
            .and_then(|v| v.as_i64())
            .unwrap_or(now_ms);

        Ok(SendResult {
            uid,
            reference_number,
            timestamp_ms: server_ts,
            raw_response: body,
        })
    }

    /// Polls the status of one or more UIDs. Endpoint:
    /// `<base>/self-tsp/sync/INQUIRY_BY_UID`
    pub fn inquiry_by_uid(
        &self,
        uids: &[String],
        fiscal_id: &str,
        token: &str,
        private_key_pem: &str,
    ) -> Result<Vec<InquiryResult>, MoadianError> {
        let url = format!("{}/self-tsp/sync/INQUIRY_BY_UID", self.base_url);
        let uids_array = json!(uids);
        let packets = json!([{
            "uid": "",
            "packetType": "INQUIRY.V01",
            "retry": false,
            "fiscalId": fiscal_id,
            "data": STANDARD.encode(uids_array.to_string()),
        }]);
        let envelope = json!({
            "packets": packets,
            "signature": "",
            "signatureKeyId": ""
        });
        let normalized = normalize_json(&envelope);
        let signature = sign_rsa_sha256(private_key_pem, normalized.as_bytes())?;
        let envelope = json!({
            "packets": packets,
            "signature": signature,
            "signatureKeyId": ""
        });

        let trace_id = uuid::Uuid::new_v4().to_string();
        let resp = self
            .http
            .post(&url)
            .bearer_auth(token)
            .header("requestTraceId", &trace_id)
            .json(&envelope)
            .send()?;

        let status = resp.status();
        let body_text = resp.text()?;
        if !status.is_success() {
            return Err(MoadianError::Http(status.as_u16(), body_text));
        }
        let body: Value = serde_json::from_str(&body_text)?;
        let mut results = Vec::new();
        if let Some(arr) = body.get("result").and_then(|v| v.as_array()) {
            for item in arr {
                let uid = item
                    .get("uid")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let status_str = item
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("UNKNOWN")
                    .to_string();
                let reference_number = item
                    .get("referenceNumber")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let error_code = item
                    .get("errorCode")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let error_detail = item
                    .get("errorDetail")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                results.push(InquiryResult {
                    uid,
                    status: status_str,
                    reference_number,
                    error_code,
                    error_detail,
                    raw_response: item.clone(),
                });
            }
        }
        Ok(results)
    }

    /// Public endpoint (no auth). Returns server time + active
    /// public keys. Endpoint:
    /// `<base>/self-tsp/sync/GET_SERVER_INFORMATION`
    pub fn get_server_information(&self) -> Result<ServerInfo, MoadianError> {
        let url = format!(
            "{}/self-tsp/sync/GET_SERVER_INFORMATION",
            self.base_url
        );
        let resp = self.http.get(&url).send()?;
        let status = resp.status();
        let body_text = resp.text()?;
        if !status.is_success() {
            return Err(MoadianError::Http(status.as_u16(), body_text));
        }
        let body: Value = serde_json::from_str(&body_text)?;

        let server_time = body
            .get("serverTime")
            .or_else(|| body.get("timestamp"))
            .map(|v| v.to_string())
            .unwrap_or_default();

        let mut keys = Vec::new();
        if let Some(arr) = body.get("publicKeys").and_then(|v| v.as_array()) {
            for k in arr {
                let id = k
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let key_pem = k
                    .get("key")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                keys.push(ServerPublicKey { id, key_pem });
            }
        }

        Ok(ServerInfo {
            server_time,
            public_keys: keys,
            raw_response: body,
        })
    }
}