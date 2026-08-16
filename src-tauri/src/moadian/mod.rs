//! Moadian tax-API integration for HesabYar.
//!
//! Implements the v2 spec published by the Iranian National Tax
//! Administration (سامانه مودیان). See:
//!   https://tp.tax.gov.ir/req/api/self-tsp/
//!
//! High-level flow:
//!   1. Authenticate once per session: GET_TOKEN (signed request)
//!   2. Build invoice packet: normalize JSON → sign → encrypt → wrap
//!   3. POST to /async/normal-enqueue (or fast-enqueue)
//!   4. Poll INQUIRY_BY_UID for final status
//!
//! All cryptographic primitives used here are stable across the spec:
//!   * Request signature: RSA-SHA256 with the taxpayer's private key
//!   * Data signature:    RSA-SHA256 over the normalized invoice JSON
//!   * Data encryption:   AES-256-GCM, IV = 12 random bytes
//!   * Key encryption:    RSA-OAEP-SHA256 with the server's public key
//!
//! The actual invoice schema, header/body fields, error codes, etc.
//! are all documented at https://tp.tax.gov.ir (راهنمای فنی).

pub mod client;
pub mod config;
pub mod crypto;
pub mod errors;
pub mod packet;