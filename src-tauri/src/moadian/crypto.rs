//! Cryptographic primitives for Moadian.
//!
//! * `normalize_json` — implements the dotted-key, hash-separator
//!   algorithm from §5.3 of the official spec.
//! * `sign_rsa_sha256` — RSA-SHA256 signature (PKCS#1 v1.5) over a
//!   payload, returning a base64-encoded string.
//! * `encrypt_aes_gcm` / `decrypt_aes_gcm` — AES-256-GCM with the
//!   standard 12-byte IV.
//! * `encrypt_rsa_oaep` — RSA-OAEP-SHA256 of an arbitrary byte slice.
//!
//! All functions take primitives as arguments (no module-level
//! state) so they're trivially testable in isolation.

use crate::moadian::errors::MoadianError;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rand::RngCore;
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::DecodePrivateKey;
use rsa::pkcs8::DecodePublicKey;
use rsa::signature::{SignatureEncoding, Signer};
use rsa::RsaPrivateKey;
use rsa::RsaPublicKey;
use sha2::{Digest, Sha256};

/// Flatten a JSON value into the Moadian "normalized" string.
///
/// Per spec §5.3:
///   * Keys at all depths become dotted paths, sorted alphabetically.
///   * Empty string and `null` are encoded as `###`.
///   * Literal `#` characters in values are escaped as `##`.
///   * The resulting value list is joined with `#`.
///
/// Example:
///   input  = {"header":{"taxid":"A","indatim":1000},"body":[]}
///   output = "1000#A"
pub fn normalize_json(value: &serde_json::Value) -> String {
    let mut pairs: Vec<(String, String)> = Vec::new();
    flatten(value, "", &mut pairs);
    // Sort by key path (ASCII).
    pairs.sort_by(|a, b| a.0.cmp(&b.0));
    pairs.into_iter().map(|(_, v)| v).collect::<Vec<_>>().join("#")
}

fn flatten(
    value: &serde_json::Value,
    prefix: &str,
    out: &mut Vec<(String, String)>,
) {
    match value {
        serde_json::Value::Null => {
            push_pair(out, prefix, "###");
        }
        serde_json::Value::Bool(b) => {
            push_pair(out, prefix, if *b { "true" } else { "false" });
        }
        serde_json::Value::Number(n) => {
            push_pair(out, prefix, &n.to_string());
        }
        serde_json::Value::String(s) => {
            if s.is_empty() {
                push_pair(out, prefix, "###");
            } else {
                let escaped = s.replace('#', "##");
                push_pair(out, prefix, &escaped);
            }
        }
        serde_json::Value::Array(arr) => {
            // Arrays: preserve order, no key suffix.
            for item in arr {
                flatten(item, prefix, out);
            }
        }
        serde_json::Value::Object(obj) => {
            // Objects: each key becomes part of the dotted path.
            for (k, v) in obj {
                let next = if prefix.is_empty() {
                    k.clone()
                } else {
                    format!("{}.{}", prefix, k)
                };
                flatten(v, &next, out);
            }
        }
    }
}

fn push_pair(out: &mut Vec<(String, String)>, key: &str, value: &str) {
    out.push((key.to_string(), value.to_string()));
}

/// Sign `payload` with the given PEM-encoded PKCS#8 RSA private key,
/// returning the signature as a base64-encoded string.
pub fn sign_rsa_sha256(
    private_key_pem: &str,
    payload: &[u8],
) -> Result<String, MoadianError> {
    let key = RsaPrivateKey::from_pkcs8_pem(private_key_pem)
        .map_err(|e| MoadianError::Crypto(format!("invalid PKCS#8 PEM: {}", e)))?;
    let signing_key = SigningKey::<Sha256>::new(key);
    let signature = signing_key.sign(payload);
    Ok(STANDARD.encode(signature.to_bytes()))
}

/// Encrypt `data` with `key` (32 bytes) and `iv` (12 bytes) using
/// AES-256-GCM. Returns (ciphertext, auth_tag), both base64-encoded.
pub fn encrypt_aes_gcm(
    key: &[u8; 32],
    iv: &[u8; 12],
    data: &[u8],
) -> Result<(String, String), MoadianError> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(iv);
    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| MoadianError::Crypto(format!("AES-GCM: {}", e)))?;
    // The auth tag is appended to the ciphertext by the aes-gcm crate.
    // Moadian expects them separately, so we split: the last 16 bytes
    // are the tag.
    if ciphertext.len() < 16 {
        return Err(MoadianError::Crypto(
            "AES-GCM output too short to contain auth tag".into(),
        ));
    }
    let split = ciphertext.len() - 16;
    let (ct, tag) = ciphertext.split_at(split);
    Ok((STANDARD.encode(ct), STANDARD.encode(tag)))
}

/// Encrypt `symmetric_key` with `public_key_pem` (SPKI) using
/// RSA-OAEP-SHA256. Returns base64-encoded ciphertext.
pub fn encrypt_rsa_oaep(
    public_key_pem: &str,
    symmetric_key: &[u8],
) -> Result<String, MoadianError> {
    let key = RsaPublicKey::from_public_key_pem(public_key_pem)
        .map_err(|e| MoadianError::Crypto(format!("invalid SPKI PEM: {}", e)))?;
    let padding = rsa::Oaep {
        digest: Box::new(Sha256::new()),
        label: None,
        mgf_digest: Box::new(Sha256::new()),
    };
    let ct = key
        .encrypt(&mut rand::thread_rng(), padding, symmetric_key)
        .map_err(|e| MoadianError::Crypto(format!("RSA-OAEP: {}", e)))?;
    Ok(STANDARD.encode(ct))
}

/// Generate 32 random bytes for an AES-256 key.
pub fn random_symmetric_key() -> [u8; 32] {
    let mut k = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut k);
    k
}

/// Generate 12 random bytes for an AES-GCM IV.
pub fn random_iv() -> [u8; 12] {
    let mut iv = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut iv);
    iv
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_normalize_simple_object() {
        let input = json!({"b": "2", "a": "1"});
        assert_eq!(normalize_json(&input), "1#2");
    }

    #[test]
    fn test_normalize_nested() {
        let input = json!({"k3": {"k1": "v4", "k5": "v5"}, "k2": "v1", "k4": "v2"});
        // The flat keys (sorted) and values: k2=v1, k3.k1=v4, k3.k5=v5, k4=v2
        assert_eq!(normalize_json(&input), "v1#v4#v5#v2");
    }

    #[test]
    fn test_normalize_handles_null_and_hash() {
        let input = json!({"a": null, "b": "", "c": "x#y"});
        // null -> ###, "" -> ###, "x#y" -> "x##y"
        // Joined with '#': ### # ### # x##y = ########x##y
        assert_eq!(normalize_json(&input), "########x##y");
    }

    #[test]
    fn test_random_key_lengths() {
        assert_eq!(random_symmetric_key().len(), 32);
        assert_eq!(random_iv().len(), 12);
    }
}