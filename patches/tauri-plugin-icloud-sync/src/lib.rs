#![cfg(mobile)]

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_icloud_sync);

// ── Response types from Swift plugin ───────────────────────────────

#[derive(Deserialize)]
struct AvailableResponse {
    available: bool,
}

#[derive(Deserialize)]
struct BlobResponse {
    data: Option<String>,
}

#[derive(Deserialize)]
struct KeyResponse {
    key: Option<String>,
}

// ── Plugin handle ──────────────────────────────────────────────────

pub struct ICloudSync<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ICloudSync<R> {
    pub fn check_available(&self) -> Result<bool, String> {
        let resp: AvailableResponse = self
            .0
            .run_mobile_plugin("checkIcloudAvailable", serde_json::json!({}))
            .map_err(|e| e.to_string())?;
        Ok(resp.available)
    }

    /// Read the encrypted vault blob from iCloud Documents.
    /// Returns `Ok(None)` if no blob has been uploaded yet.
    pub fn read_blob(&self) -> Result<Option<Vec<u8>>, String> {
        let resp: BlobResponse = self
            .0
            .run_mobile_plugin("readCloudBlob", serde_json::json!({}))
            .map_err(|e| e.to_string())?;
        match resp.data {
            Some(b64) => {
                let bytes = STANDARD
                    .decode(&b64)
                    .map_err(|e| format!("Base64 decode error: {e}"))?;
                Ok(Some(bytes))
            }
            None => Ok(None),
        }
    }

    /// Write an encrypted vault blob to iCloud Documents.
    pub fn write_blob(&self, data: &[u8]) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<serde_json::Value>(
                "writeCloudBlob",
                serde_json::json!({ "data": STANDARD.encode(data) }),
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Start watching for remote iCloud changes.
    /// The Swift plugin emits `icloud-change` events when the vault blob updates remotely.
    pub fn start_watching(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<serde_json::Value>("startWatching", serde_json::json!({}))
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn stop_watching(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<serde_json::Value>("stopWatching", serde_json::json!({}))
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Load the cloud sync key from iCloud Keychain (synchronizable).
    /// Returns `Ok(None)` if no key exists yet.
    pub fn load_cloud_key(&self) -> Result<Option<Vec<u8>>, String> {
        let resp: KeyResponse = self
            .0
            .run_mobile_plugin("loadCloudSyncKey", serde_json::json!({}))
            .map_err(|e| e.to_string())?;
        match resp.key {
            Some(b64) => {
                let bytes = STANDARD
                    .decode(&b64)
                    .map_err(|e| format!("Base64 decode error: {e}"))?;
                Ok(Some(bytes))
            }
            None => Ok(None),
        }
    }

    /// Store the cloud sync key in iCloud Keychain (synchronizable across Apple devices).
    pub fn store_cloud_key(&self, key: &[u8]) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<serde_json::Value>(
                "storeCloudSyncKey",
                serde_json::json!({ "key": STANDARD.encode(key) }),
            )
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_cloud_key(&self) -> Result<(), String> {
        self.0
            .run_mobile_plugin::<serde_json::Value>("deleteCloudSyncKey", serde_json::json!({}))
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ── Extension trait for convenient access ──────────────────────────

pub trait ICloudSyncExt<R: Runtime> {
    fn icloud_sync(&self) -> &ICloudSync<R>;
}

impl<R: Runtime, T: Manager<R>> ICloudSyncExt<R> for T {
    fn icloud_sync(&self) -> &ICloudSync<R> {
        self.state::<ICloudSync<R>>().inner()
    }
}

// ── Plugin init ────────────────────────────────────────────────────

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("icloud-sync")
        .setup(|app, api| {
            #[cfg(target_os = "ios")]
            {
                let handle = api.register_ios_plugin(init_plugin_icloud_sync)?;
                app.manage(ICloudSync(handle));
            }
            Ok(())
        })
        .build()
}
