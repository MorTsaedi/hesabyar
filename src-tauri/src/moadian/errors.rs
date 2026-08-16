//! Error types for the Moadian module.
//!
//! All variants serialize to a stable string (via `Display`) so the
//! frontend can render them as-is without parsing structured data.

use std::fmt;

#[derive(Debug)]
pub enum MoadianError {
    /// HTTP / network failure (DNS, TLS, connection refused, etc.)
    Network(String),
    /// The server returned a non-2xx HTTP status code
    Http(u16, String),
    /// JSON serialization / deserialization failed
    Json(String),
    /// Cryptographic operation failed (bad key, malformed signature, …)
    Crypto(String),
    /// Configuration is missing or invalid (no fiscal ID, no key, etc.)
    Config(String),
    /// Could not read / write a file (key path, config file)
    Io(String),
    /// Generic internal error with a free-form message
    Other(String),
}

impl fmt::Display for MoadianError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MoadianError::Network(m) => write!(f, "خطای شبکه: {}", m),
            MoadianError::Http(code, body) => {
                write!(f, "خطای HTTP {}: {}", code, body)
            }
            MoadianError::Json(m) => write!(f, "خطای JSON: {}", m),
            MoadianError::Crypto(m) => write!(f, "خطای رمزنگاری: {}", m),
            MoadianError::Config(m) => write!(f, "خطای تنظیمات: {}", m),
            MoadianError::Io(m) => write!(f, "خطای فایل: {}", m),
            MoadianError::Other(m) => write!(f, "{}", m),
        }
    }
}

impl std::error::Error for MoadianError {}

impl From<reqwest::Error> for MoadianError {
    fn from(e: reqwest::Error) -> Self {
        MoadianError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for MoadianError {
    fn from(e: serde_json::Error) -> Self {
        MoadianError::Json(e.to_string())
    }
}

impl From<std::io::Error> for MoadianError {
    fn from(e: std::io::Error) -> Self {
        MoadianError::Io(e.to_string())
    }
}

impl From<rusqlite::Error> for MoadianError {
    fn from(e: rusqlite::Error) -> Self {
        MoadianError::Other(format!("db: {}", e))
    }
}