//! iCloud sync logic: encrypts/decrypts the vault for cloud transport
//! and coordinates push/pull with the Swift iCloud plugin.
//!
//! Most functions are only called from iOS-gated code paths.
#![allow(dead_code)]

use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use zeroize::Zeroizing;

use crate::keystore;
use crate::storage::{Account, Tombstone, now_secs};
use crate::sync::{self, SyncHistory};

// ── Preference ─────────────────────────────────────────────────────

const PREF_FILE: &str = "icloud_sync_enabled";
const LAST_SYNCED_FILE: &str = "icloud_last_synced";

pub fn is_enabled(data_dir: &Path) -> bool {
    fs::read_to_string(data_dir.join(PREF_FILE))
        .map(|v| v.trim() == "true")
        .unwrap_or(false)
}

pub fn set_enabled(data_dir: &Path, enabled: bool) -> Result<(), String> {
    let path = data_dir.join(PREF_FILE);
    if enabled {
        fs::write(&path, "true").map_err(|e| {
            tracing::error!(error = %e, "Failed to write iCloud sync preference");
            "Failed to save iCloud sync setting".to_string()
        })
    } else {
        // Remove the file; missing = disabled.
        let _ = fs::remove_file(&path);
        Ok(())
    }
}

/// Record the current time as the last successful iCloud sync.
pub fn touch_last_synced(data_dir: &Path) {
    let ts = now_secs().to_string();
    let _ = fs::write(data_dir.join(LAST_SYNCED_FILE), &ts);
}

/// Read the last-synced unix timestamp (seconds), or 0 if never synced.
pub fn last_synced_at(data_dir: &Path) -> u64 {
    fs::read_to_string(data_dir.join(LAST_SYNCED_FILE))
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(0)
}

// ── Cloud vault encryption ─────────────────────────────────────────

const CLOUD_PAYLOAD_VERSION: u8 = 1;

/// Payload stored in iCloud — same shape as the local StoragePayload
/// so the merge logic can work identically.
#[derive(Serialize, Deserialize)]
struct CloudPayload {
    version: u8,
    device_id: String,
    accounts: Vec<Account>,
    #[serde(default)]
    tombstones: Vec<Tombstone>,
    /// Unix timestamp when this blob was written.
    #[serde(default)]
    pushed_at: u64,
}

/// Encrypt the vault for cloud storage using the cloud sync key.
/// Format: 12-byte nonce + AES-256-GCM ciphertext.
pub fn encrypt_for_cloud(
    accounts: &[Account],
    tombstones: &[Tombstone],
    device_id: &str,
    cloud_key: &[u8; 32],
) -> Result<Vec<u8>, String> {
    let payload = CloudPayload {
        version: CLOUD_PAYLOAD_VERSION,
        device_id: device_id.to_string(),
        accounts: accounts.to_vec(),
        tombstones: tombstones.to_vec(),
        pushed_at: now_secs(),
    };

    let plaintext = serde_json::to_vec(&payload).map_err(|e| {
        tracing::error!(error = %e, "Failed to serialize cloud payload");
        "Failed to prepare cloud sync data".to_string()
    })?;

    let cipher = Aes256Gcm::new_from_slice(cloud_key).map_err(|e| {
        tracing::error!(error = %e, "Cloud cipher init failed");
        "Failed to encrypt cloud data".to_string()
    })?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext.as_ref()).map_err(|e| {
        tracing::error!(error = %e, "Cloud encryption failed");
        "Failed to encrypt cloud data".to_string()
    })?;

    let mut blob = Vec::with_capacity(12 + ciphertext.len());
    blob.extend_from_slice(&nonce_bytes);
    blob.extend(ciphertext);
    Ok(blob)
}

/// Decrypt a cloud vault blob, returning the remote device_id, accounts, and tombstones.
pub fn decrypt_from_cloud(
    blob: &[u8],
    cloud_key: &[u8; 32],
) -> Result<(String, Vec<Account>, Vec<Tombstone>), String> {
    // 12-byte nonce + 16-byte GCM authentication tag minimum.
    if blob.len() < 28 {
        return Err("Cloud blob too short".to_string());
    }

    let (nonce_bytes, ciphertext) = blob.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(cloud_key).map_err(|e| {
        tracing::error!(error = %e, "Cloud cipher init failed");
        "Failed to decrypt cloud data".to_string()
    })?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|e| {
        tracing::error!(error = %e, "Cloud decryption failed — key mismatch or corrupted data");
        "Failed to decrypt cloud data. The cloud sync key may not match.".to_string()
    })?;

    let payload: CloudPayload = serde_json::from_slice(&plaintext).map_err(|e| {
        tracing::error!(error = %e, "Failed to deserialize cloud payload");
        "Failed to read cloud sync data".to_string()
    })?;

    if payload.version > CLOUD_PAYLOAD_VERSION {
        return Err(format!(
            "Cloud vault uses a newer format (v{}). Please update Ghost Auth on this device.",
            payload.version
        ));
    }

    Ok((payload.device_id, payload.accounts, payload.tombstones))
}

// ── Cloud sync key management ──────────────────────────────────────

/// Load the cloud sync key from the local keystore.
pub fn load_cloud_key() -> Option<Zeroizing<[u8; 32]>> {
    keystore::load_cloud_sync_key().map(Zeroizing::new)
}

/// Generate a new cloud sync key and store it locally.
pub fn generate_and_store_cloud_key() -> Result<Zeroizing<[u8; 32]>, String> {
    let mut key = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(&mut *key);
    if !keystore::store_cloud_sync_key(&key) {
        return Err("Failed to store cloud sync key in keystore".to_string());
    }
    Ok(key)
}

/// Store a cloud sync key retrieved from iCloud Keychain into the local keystore.
pub fn store_cloud_key_locally(key_bytes: &[u8]) -> Result<Zeroizing<[u8; 32]>, String> {
    if key_bytes.len() != 32 {
        return Err("Invalid cloud sync key length".to_string());
    }
    let mut key = Zeroizing::new([0u8; 32]);
    key.copy_from_slice(key_bytes);
    if !keystore::store_cloud_sync_key(&key) {
        return Err("Failed to store cloud sync key in local keystore".to_string());
    }
    Ok(key)
}

// ── Merge helper ───────────────────────────────────────────────────

/// Result of an iCloud merge operation.
pub struct CloudMergeResult {
    pub added: usize,
    pub updated: usize,
    pub deleted: usize,
}

/// Merge a remote cloud payload into local storage.
/// Uses last-writer-wins for conflicts (no interactive prompt).
pub fn merge_cloud_payload(
    storage: &mut crate::storage::Storage,
    remote_device_id: &str,
    remote_accounts: Vec<Account>,
    remote_tombstones: &[Tombstone],
) -> Result<CloudMergeResult, String> {
    let mut history = SyncHistory::load(storage.data_dir(), storage.encryption_key());
    let last_sync = history.last_sync_with(remote_device_id);

    let result = sync::merge(
        storage.list(),
        storage.tombstones(),
        remote_accounts,
        remote_tombstones,
        last_sync,
    );

    let mut added = 0;
    let mut updated = 0;
    let mut deleted = 0;

    // Auto-add new accounts from remote
    for account in result.to_add {
        storage.add_synced(account)?;
        added += 1;
    }

    // Auto-update accounts where remote is newer
    for account in result.auto_updated {
        storage.replace_account(account)?;
        updated += 1;
    }

    // For conflicts: last-writer-wins (pick the one with later last_modified)
    for conflict in result.conflicts {
        if conflict.remote.last_modified >= conflict.local.last_modified {
            storage.replace_account(conflict.remote)?;
            updated += 1;
        }
        // else: keep local, no action needed
    }

    // Apply remote deletions
    for account in result.remote_deletions {
        storage.delete(&account.id)?;
        deleted += 1;
    }

    // Record sync timestamp
    history.record_sync(remote_device_id, now_secs());
    history.save(storage.data_dir(), storage.encryption_key())?;

    Ok(CloudMergeResult {
        added,
        updated,
        deleted,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key() -> [u8; 32] {
        [0xCC; 32]
    }

    fn make_account(id: &str, issuer: &str, modified: u64) -> Account {
        Account {
            id: id.to_string(),
            issuer: issuer.to_string(),
            label: "test@example.com".to_string(),
            secret: "JBSWY3DPEHPK3PXP".to_string(),
            algorithm: "SHA1".to_string(),
            digits: 6,
            period: 30,
            icon: None,
            last_modified: modified,
        }
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = test_key();
        let accounts = vec![
            make_account("a1", "GitHub", 1000),
            make_account("a2", "Google", 2000),
        ];
        let tombstones = vec![Tombstone {
            id: "a3".to_string(),
            deleted_at: 500,
        }];

        let blob = encrypt_for_cloud(&accounts, &tombstones, "device-1", &key).unwrap();
        let (device_id, dec_accounts, dec_tombstones) = decrypt_from_cloud(&blob, &key).unwrap();

        assert_eq!(device_id, "device-1");
        assert_eq!(dec_accounts.len(), 2);
        assert_eq!(dec_accounts[0].issuer, "GitHub");
        assert_eq!(dec_accounts[1].issuer, "Google");
        assert_eq!(dec_tombstones.len(), 1);
        assert_eq!(dec_tombstones[0].id, "a3");
    }

    #[test]
    fn test_decrypt_wrong_key_fails() {
        let blob = encrypt_for_cloud(&[], &[], "d1", &[0xAA; 32]).unwrap();
        let result = decrypt_from_cloud(&blob, &[0xBB; 32]);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_short_blob_fails() {
        let result = decrypt_from_cloud(&[0u8; 5], &test_key());
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_below_gcm_minimum_fails() {
        // 20 bytes: enough for a nonce (12) but not nonce + GCM tag (28).
        let result = decrypt_from_cloud(&[0u8; 20], &test_key());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too short"));
    }
}
