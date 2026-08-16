//! End-to-end smoke test for the Moadian packet builder.
//!
//! Runs in pure offline mode (no network). Uses two throwaway RSA
//! key pairs (client + server) to exercise the full sign-then-encrypt
//! pipeline and verifies:
//!
//!   * normalize_json produces a hash-separator string
//!   * sign_rsa_sha256 + verify round-trips
//!   * encrypt_aes_gcm + decrypt round-trips
//!   * encrypt_rsa_oaep + decrypt round-trips
//!
//! Run with:  `cargo run --bin moadian_smoke_test --release`
//!
//! This binary is intentionally NOT shipped in production builds.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use hesabyar_lib::moadian::crypto::{
    encrypt_aes_gcm, encrypt_rsa_oaep, normalize_json, random_iv, random_symmetric_key,
    sign_rsa_sha256,
};
use rsa::pkcs8::{DecodePrivateKey, DecodePublicKey, EncodePrivateKey, EncodePublicKey};
use rsa::pkcs1v15::{Signature, VerifyingKey};
use rsa::signature::Verifier;
use rsa::Oaep;
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Generate two RSA key pairs (client + server).
    let mut rng = rand::thread_rng();
    let client_priv = RsaPrivateKey::new(&mut rng, 2048)?;
    let client_pub = rsa::RsaPublicKey::from(&client_priv);
    let server_priv = RsaPrivateKey::new(&mut rng, 2048)?;
    let server_pub = rsa::RsaPublicKey::from(&server_priv);

    let client_priv_pem = client_priv.to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)?;
    let client_pub_pem = client_pub.to_public_key_pem(rsa::pkcs8::LineEnding::LF)?;
    let server_priv_pem = server_priv.to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)?;
    let server_pub_pem = server_pub.to_public_key_pem(rsa::pkcs8::LineEnding::LF)?;

    println!("OK: generated 2048-bit RSA keypairs (client + server)");

    // 2. JSON normalization
    let sample = serde_json::json!({
        "header": {"taxid": "A1B2C30000000001040506", "indatim": 1700000000000_i64},
        "body": [{"am": 1, "fee": 1000}],
        "payments": []
    });
    let normalized = normalize_json(&sample);
    assert!(!normalized.is_empty());
    println!("OK: normalize_json produced: {}", normalized);

    // 3. Sign / verify round-trip
    let sig_b64 = sign_rsa_sha256(client_priv_pem.as_str(), normalized.as_bytes())?;
    let client_pub_parsed = rsa::RsaPublicKey::from_public_key_pem(client_pub_pem.as_str())?;
    let vk = VerifyingKey::<Sha256>::new(client_pub_parsed);
    let sig_bytes = STANDARD.decode(&sig_b64)?;
    let sig = Signature::try_from(sig_bytes.as_slice())?;
    vk.verify(normalized.as_bytes(), &sig)?;
    println!("OK: signed JSON verifies with matching public key");

    // 4. AES-256-GCM round-trip
    let key = random_symmetric_key();
    let iv = random_iv();
    let (ct_b64, tag_b64) = encrypt_aes_gcm(&key, &iv, b"hello world payload")?;
    let cipher = Aes256Gcm::new((&key).into());
    let nonce = Nonce::from_slice(&iv);
    let ct = STANDARD.decode(&ct_b64)?;
    let tag = STANDARD.decode(&tag_b64)?;
    let mut combined = ct.clone();
    combined.extend_from_slice(&tag);
    let pt = cipher
        .decrypt(nonce, combined.as_ref())
        .map_err(|e| format!("decrypt: {}", e))?;
    assert_eq!(pt, b"hello world payload");
    println!("OK: AES-256-GCM decrypt round-trip");

    // 5. RSA-OAEP round-trip via the server key
    let sym_key = random_symmetric_key();
    let encrypted = encrypt_rsa_oaep(server_pub_pem.as_str(), &sym_key)?;
    let server_priv_parsed = RsaPrivateKey::from_pkcs8_pem(server_priv_pem.as_str())?;
    let padding = Oaep {
        digest: Box::new(Sha256::new()),
        label: None,
        mgf_digest: Box::new(Sha256::new()),
    };
    let ct_bytes = STANDARD.decode(&encrypted)?;
    let recovered = server_priv_parsed.decrypt(padding, &ct_bytes)?;
    assert_eq!(recovered, sym_key);
    println!("OK: RSA-OAEP decrypt round-trip");

    println!("\nALL MOADIAN SMOKE CHECKS PASSED");
    Ok(())
}