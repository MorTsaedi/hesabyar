//! Configuration storage for Moadian credentials.
//!
//! The user's private key and certificate are stored encrypted at
//! rest inside `<data_dir>/moadian/credentials.enc`. Encryption is
//! PBKDF2-derived AES-256-GCM with a user-supplied passphrase.

use crate::db::Database;
use crate::moadian::errors::MoadianError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoadianConfig {
    /// Tax-payer fiscal memory ID (شناسه یکتای حافظه مالیاتی).
    pub fiscal_id: String,
    /// Tax-payer economic code (used in `tins` header field).
    pub economic_code: String,
    /// Use the sandbox environment instead of production.
    pub use_sandbox: bool,
    /// Whether credentials have been stored (no plaintext secrets
    /// are kept here — only metadata).
    pub has_credentials: bool,
    /// ISO timestamp of the last successful test connection.
    pub last_test_at: String,
    /// Last error message from a test/send attempt, for UI display.
    pub last_error: String,
}

impl Default for MoadianConfig {
    fn default() -> Self {
        Self {
            fiscal_id: String::new(),
            economic_code: String::new(),
            use_sandbox: true,
            has_credentials: false,
            last_test_at: String::new(),
            last_error: String::new(),
        }
    }
}

/// In-memory, transient representation of the decrypted credentials.
/// Never persisted — these only exist while a Send command runs.
#[derive(Debug, Clone)]
pub struct StoredCredentials {
    pub private_key_pem: String,
    pub certificate_pem: String,
}

impl Database {
    /// Directory where Moadian config + encrypted credentials live.
    pub fn moadian_dir(&self) -> PathBuf {
        let mut dir = self
            .directory()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        dir.push("moadian");
        dir
    }

    /// Loads the public Moadian config (no secrets).
    pub fn load_moadian_config(&self) -> Result<MoadianConfig, MoadianError> {
        let path = self.moadian_dir().join("config.json");
        if !path.exists() {
            return Ok(MoadianConfig::default());
        }
        let raw = std::fs::read_to_string(&path)?;
        let cfg: MoadianConfig = serde_json::from_str(&raw)
            .map_err(|e| MoadianError::Json(e.to_string()))?;
        Ok(cfg)
    }

    /// Saves the public config. Does NOT touch the encrypted
    /// credentials file.
    pub fn save_moadian_config(&self, cfg: &MoadianConfig) -> Result<(), MoadianError> {
        std::fs::create_dir_all(self.moadian_dir())?;
        let path = self.moadian_dir().join("config.json");
        let json = serde_json::to_string_pretty(cfg)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Saves credentials encrypted with the given passphrase.
    /// Overwrites any existing credentials file.
    pub fn save_moadian_credentials(
        &self,
        private_key_pem: &str,
        certificate_pem: &str,
        passphrase: &str,
    ) -> Result<(), MoadianError> {
        std::fs::create_dir_all(self.moadian_dir())?;
        let plaintext = format!(
            "{}---CERT---\n{}",
            private_key_pem.trim(),
            certificate_pem.trim()
        );
        let blob = encrypt_with_passphrase(plaintext.as_bytes(), passphrase)?;
        let path = self.moadian_dir().join("credentials.enc");
        std::fs::write(path, blob)?;
        Ok(())
    }

    /// Loads and decrypts credentials. Returns None if no
    /// credentials file exists.
    pub fn load_moadian_credentials(
        &self,
        passphrase: &str,
    ) -> Result<Option<StoredCredentials>, MoadianError> {
        let path = self.moadian_dir().join("credentials.enc");
        if !path.exists() {
            return Ok(None);
        }
        let blob = std::fs::read(&path)?;
        let plaintext = decrypt_with_passphrase(&blob, passphrase)?;
        let text = String::from_utf8(plaintext)
            .map_err(|_| MoadianError::Crypto("credentials are not valid UTF-8".into()))?;
        let mut parts = text.splitn(2, "---CERT---\n");
        let private_key_pem = parts
            .next()
            .ok_or_else(|| MoadianError::Crypto("missing private key section".into()))?
            .trim()
            .to_string();
        let certificate_pem = parts
            .next()
            .ok_or_else(|| MoadianError::Crypto("missing certificate section".into()))?
            .trim()
            .to_string();
        Ok(Some(StoredCredentials {
            private_key_pem,
            certificate_pem,
        }))
    }

    /// Deletes the credentials file (idempotent).
    pub fn clear_moadian_credentials(&self) -> Result<(), MoadianError> {
        let path = self.moadian_dir().join("credentials.enc");
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Ok(())
    }
}

// -------- Internal: passphrase-derived encryption --------

const PBKDF2_ITERATIONS: u32 = 100_000;
const CRED_SALT: &[u8] = b"hesabyar.moadian.credentials.v1";

fn encrypt_with_passphrase(
    plaintext: &[u8],
    passphrase: &str,
) -> Result<Vec<u8>, MoadianError> {
    use aes_gcm::aead::Aead;
    use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
    use pbkdf2::pbkdf2_hmac_array;
    use sha2::Sha256;

    let salt = CRED_SALT;
    let key: [u8; 32] = pbkdf2_hmac_array::<Sha256, 32>(
        passphrase.as_bytes(),
        salt,
        PBKDF2_ITERATIONS,
    );
    let cipher = Aes256Gcm::new((&key).into());
    let mut nonce_bytes = [0u8; 12];
    rand::Rng::fill(&mut rand::thread_rng(), &mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| MoadianError::Crypto(format!("encryption: {}", e)))?;

    // Layout: salt(16) || nonce(12) || ciphertext+tag
    let mut out = Vec::with_capacity(salt.len() + nonce_bytes.len() + ct.len());
    out.extend_from_slice(salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(out)
}

fn decrypt_with_passphrase(
    blob: &[u8],
    passphrase: &str,
) -> Result<Vec<u8>, MoadianError> {
    use aes_gcm::aead::Aead;
    use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
    use pbkdf2::pbkdf2_hmac_array;
    use sha2::Sha256;

    if blob.len() < 16 + 12 + 16 {
        return Err(MoadianError::Crypto("blob too short".into()));
    }
    let salt = &blob[..16];
    let nonce_bytes = &blob[16..28];
    let ct = &blob[28..];
    let key: [u8; 32] = pbkdf2_hmac_array::<Sha256, 32>(
        passphrase.as_bytes(),
        salt,
        PBKDF2_ITERATIONS,
    );
    let cipher = Aes256Gcm::new((&key).into());
    let nonce = Nonce::from_slice(nonce_bytes);
    let pt = cipher
        .decrypt(nonce, ct)
        .map_err(|_| MoadianError::Crypto("رمز عبور نادرست یا فایل آسیب‌دیده".into()))?;
    Ok(pt)
}