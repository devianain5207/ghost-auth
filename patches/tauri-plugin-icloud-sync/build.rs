const COMMANDS: &[&str] = &[
    "check_icloud_available",
    "read_cloud_blob",
    "write_cloud_blob",
    "start_watching",
    "stop_watching",
    "load_cloud_sync_key",
    "store_cloud_sync_key",
    "delete_cloud_sync_key",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .ios_path("ios")
        .try_build()
        .unwrap();
}
