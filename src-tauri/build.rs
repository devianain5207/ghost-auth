fn main() {
    // Forward DSN variables from ../.env into the Rust compile environment
    // so that option_env!("GHOST_AUTH_DSN") / option_env!("GHOST_AUTH_DSN_DEV") resolve.
    let env_path = std::path::Path::new("../.env");
    println!("cargo:rerun-if-changed=../.env");

    match std::fs::read_to_string(env_path) {
        Ok(contents) => {
            for line in contents.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim();
                    if key == "GHOST_AUTH_DSN" || key == "GHOST_AUTH_DSN_DEV" {
                        println!("cargo:warning=Loaded {key} from .env");
                        println!("cargo:rustc-env={key}={value}");
                    }
                }
            }
        }
        Err(e) => {
            println!(
                "cargo:warning=Could not read .env at {}: {e}",
                env_path.display()
            );
        }
    }

    tauri_build::build()
}
