use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

fn image_cache() -> &'static Mutex<HashMap<String, Vec<u8>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

static ROTATE_RUNNING: AtomicBool = AtomicBool::new(false);
static ROTATE_INTERVAL: AtomicU64 = AtomicU64::new(900000);

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WallpaperInfo {
    name: String,
    url: String,
}

#[tauri::command]
async fn set_wallpaper(url: String) -> Result<String, String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        set_wallpaper_os(&url)?;
        return Ok(format!("Local wallpaper set"));
    }

    let temp_dir = std::env::temp_dir();
    let filename = url
        .split('/')
        .last()
        .unwrap_or("cozy-wallpaper.jpg")
        .to_string();
    let temp_path = temp_dir.join(format!("cozypixels_{}", filename));

    if let Ok(entries) = std::fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with("cozypixels_")
                    && name != format!("cozypixels_{}", filename).as_str()
                {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    let url_clone = url.clone();
    let path_clone = temp_path.clone();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let response =
            reqwest::blocking::get(&url_clone).map_err(|e| format!("Download failed: {}", e))?;
        let bytes = response
            .bytes()
            .map_err(|e| format!("Read failed: {}", e))?;
        std::fs::write(&path_clone, &bytes).map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;

    let path_str = temp_path.to_str().ok_or("Invalid temp path")?.to_string();

    set_wallpaper_os(&path_str)?;

    Ok(format!("Wallpaper set: {}", filename))
}

fn set_wallpaper_os(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::iter::once;
        use std::os::windows::ffi::OsStrExt;

        let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(once(0)).collect();

        let result = unsafe {
            winapi::um::winuser::SystemParametersInfoW(
                winapi::um::winuser::SPI_SETDESKWALLPAPER,
                0,
                wide.as_ptr() as *mut _,
                winapi::um::winuser::SPIF_UPDATEINIFILE | winapi::um::winuser::SPIF_SENDCHANGE,
            )
        };

        if result == 0 {
            return Err("SystemParametersInfoW failed".to_string());
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"tell application "System Events" to set picture of every desktop to POSIX file "{}""#,
            path
        );
        let status = std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status()
            .map_err(|e| format!("osascript failed: {}", e))?;

        if !status.success() {
            return Err("Failed to set wallpaper on macOS".to_string());
        }
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let gnome = std::process::Command::new("gsettings")
            .args(&[
                "set",
                "org.gnome.desktop.background",
                "picture-uri",
                &format!("file://{}", path),
            ])
            .status();

        if gnome.map_or(true, |s| !s.success()) {
            std::process::Command::new("feh")
                .args(&["--bg-scale", path])
                .status()
                .map_err(|e| format!("feh failed: {}", e))?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported OS".to_string())
}

#[tauri::command]
async fn set_lock_screen(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Storage::StorageFile;
        use windows::System::UserProfile::LockScreen;
        use windows::core::HSTRING;
        
        let path_str = if !url.starts_with("http://") && !url.starts_with("https://") {
            url.clone()
        } else {
            let temp_dir = std::env::temp_dir();
            let filename = url.split('/').last().unwrap_or("cozy-lock.jpg").to_string();
            let temp_path = temp_dir.join(format!("cozypixels_lock_{}", filename));
            let path_clone = temp_path.clone();
            
            tokio::task::spawn_blocking(move || -> Result<(), String> {
                let response = reqwest::blocking::get(&url).map_err(|e| format!("Download failed: {}", e))?;
                let bytes = response.bytes().map_err(|e| format!("Read failed: {}", e))?;
                std::fs::write(&path_clone, &bytes).map_err(|e| format!("Write failed: {}", e))?;
                Ok(())
            }).await.map_err(|e| format!("Task error: {}", e))??;
            
            temp_path.to_str().ok_or("Invalid temp path")?.to_string()
        };
        
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            let hstring_path = HSTRING::from(&path_str);
            let file = StorageFile::GetFileFromPathAsync(&hstring_path)
                .map_err(|e| format!("GetFileFromPathAsync failed: {}", e))?
                .get()
                .map_err(|e| format!("GetFileFromPathAsync get failed: {}", e))?;
                
            LockScreen::SetImageFileAsync(&file)
                .map_err(|e| format!("SetImageFileAsync failed: {}", e))?
                .get()
                .map_err(|e| format!("SetImageFileAsync get failed: {}", e))?;
                
            Ok(())
        }).await.map_err(|e| format!("Task error: {}", e))??;
        
        return Ok("Lock screen updated successfully".to_string());
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Lock screen setting is only supported on Windows".to_string());
    }
}

#[tauri::command]
async fn start_auto_rotate(
    window: tauri::Window,
    interval_ms: u64,
    wallpapers: Vec<WallpaperInfo>,
    start_index: Option<usize>,
    initial_delay_ms: Option<u64>,
) -> Result<(), String> {
    if wallpapers.is_empty() {
        return Err("No wallpapers provided".to_string());
    }

    ROTATE_RUNNING.store(false, std::sync::atomic::Ordering::SeqCst);
    tokio::time::sleep(Duration::from_millis(100)).await;
    ROTATE_RUNNING.store(true, std::sync::atomic::Ordering::SeqCst);

    let wallpapers = Arc::new(wallpapers);
    let index = Arc::new(Mutex::new(start_index.unwrap_or(0)));
    let initial_delay = initial_delay_ms.unwrap_or(interval_ms);
    ROTATE_INTERVAL.store(interval_ms, std::sync::atomic::Ordering::SeqCst);

    thread::spawn(move || {
        let mut first_run = true;
        loop {
            if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }

            let mut elapsed_ms: u64 = 0;
            loop {
                if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                    break;
                }
                
                let current_target = if first_run {
                    initial_delay
                } else {
                    ROTATE_INTERVAL.load(std::sync::atomic::Ordering::SeqCst)
                };

                if elapsed_ms >= current_target {
                    break;
                }

                thread::sleep(Duration::from_millis(500));
                elapsed_ms += 500;
            }
            
            first_run = false;

            if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }

            let mut idx = index.lock().unwrap();
            *idx = (*idx + 1) % wallpapers.len();
            let current = wallpapers[*idx].clone();
            drop(idx);

            let url = current.url.clone();
            let name = current.name.clone();

            let temp_dir = std::env::temp_dir();
            let filename = url.split('/').last().unwrap_or("wallpaper.jpg").to_string();
            let temp_path = temp_dir.join(format!("cozypixels_{}", filename));

            if let Ok(entries) = std::fs::read_dir(&temp_dir) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if name.starts_with("cozypixels_")
                            && name != format!("cozypixels_{}", filename).as_str()
                        {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            }

            if let Ok(response) = reqwest::blocking::get(&url) {
                if let Ok(bytes) = response.bytes() {
                    let _ = std::fs::write(&temp_path, &bytes);
                    if let Some(path_str) = temp_path.to_str() {
                        let _ = set_wallpaper_os(path_str);
                        let _ = window.emit("wallpaper-changed", &name);
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_auto_rotate() -> Result<(), String> {
    ROTATE_RUNNING.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn get_rotate_status() -> bool {
    ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst)
}

#[tauri::command]
fn update_rotate_interval(new_interval_ms: u64) {
    ROTATE_INTERVAL.store(new_interval_ms, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
fn scan_local_directory(path: String) -> Result<Vec<String>, String> {
    let mut images = Vec::new();
    let entries = std::fs::read_dir(&path).map_err(|e| format!("Failed to read dir: {}", e))?;
    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if file_type.is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    let name_lower = name.to_lowercase();
                    if name_lower.ends_with(".jpg") || name_lower.ends_with(".jpeg") || name_lower.ends_with(".png") || name_lower.ends_with(".webp") || name_lower.ends_with(".gif") || name_lower.ends_with(".bmp") {
                        if let Some(path_str) = entry.path().to_str() {
                            images.push(path_str.to_string());
                        }
                    }
                }
            }
        }
    }
    Ok(images)
}

use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

#[tauri::command]
async fn fetch_image_bytes(url: String) -> Result<Vec<u8>, String> {
    {
        let cache = image_cache().lock().unwrap();
        if let Some(bytes) = cache.get(&url) {
            return Ok(bytes.clone());
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let referer = if let Ok(parsed) = url::Url::parse(&url) {
        format!("{}://{}/", parsed.scheme(), parsed.host_str().unwrap_or(""))
    } else {
        String::new()
    };

    let mut req = client.get(&url)
        .header("Accept", "image/avif,image/webp,image/apng,image/png,image/jpeg,*/*;q=0.8");

    if !referer.is_empty() {
        req = req.header("Referer", &referer);
    }

    let resp = req.send().await.map_err(|e| format!("Download failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP Error: {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("Read failed: {}", e))?.to_vec();

    {
        let mut cache = image_cache().lock().unwrap();
        if cache.len() > 100 {
            cache.clear();
        }
        cache.insert(url, bytes.clone());
    }

    Ok(bytes)
}

#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("cozy", |_app, request| {
            let path = request.uri().path().strip_prefix('/').unwrap_or(request.uri().path());
            let decoded = percent_encoding::percent_decode_str(path).decode_utf8_lossy().to_string();
            let local_path = if cfg!(windows) && decoded.starts_with('/') {
                decoded[1..].to_string()
            } else {
                decoded
            };

            // Security: normalize path to prevent directory traversal
            let normalized = std::path::Path::new(&local_path)
                .components()
                .collect::<std::path::PathBuf>();
            let normalized_str = normalized.to_string_lossy().to_string();

            if local_path != normalized_str {
                return tauri::http::Response::builder()
                    .status(400)
                    .body(Vec::new())
                    .unwrap();
            }

            let lower_path = local_path.to_lowercase();
            let is_valid_image = lower_path.ends_with(".png")
                || lower_path.ends_with(".jpg")
                || lower_path.ends_with(".jpeg")
                || lower_path.ends_with(".gif")
                || lower_path.ends_with(".webp")
                || lower_path.ends_with(".bmp");

            if !is_valid_image {
                return tauri::http::Response::builder()
                    .status(403)
                    .body(Vec::new())
                    .unwrap();
            }

            if let Ok(metadata) = std::fs::metadata(&local_path) {
                if metadata.len() > 50 * 1024 * 1024 {
                    return tauri::http::Response::builder()
                        .status(413)
                        .body(Vec::new())
                        .unwrap();
                }
            }

            if let Ok(data) = std::fs::read(&local_path) {
                let mime = if lower_path.ends_with(".png") {
                    "image/png"
                } else if lower_path.ends_with(".gif") {
                    "image/gif"
                } else if lower_path.ends_with(".webp") {
                    "image/webp"
                } else {
                    "image/jpeg"
                };

                tauri::http::Response::builder()
                    .header("Content-Type", mime)
                    .body(data)
                    .unwrap()
            } else {
                tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap()
            }
        })
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show CozyPixels", true, None::<&str>)?;
            let next_i = MenuItem::with_id(app, "next", "Next Wallpaper", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle_rotate", "Toggle Auto-Rotate", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &next_i, &toggle_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "next" => {
                        let _ = app.emit("tray-next-wallpaper", "");
                    }
                    "toggle_rotate" => {
                        let _ = app.emit("tray-toggle-rotate", "");
                    }
                    _ => {}
                })
                .icon(app.default_window_icon().cloned().expect("No default window icon configured - check tauri.conf.json"))
                .build(app)?;

            // Hide window on boot if started via autostart
            if std::env::args().any(|arg| arg == "--autostart") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_wallpaper,
            set_lock_screen,
            start_auto_rotate,
            stop_auto_rotate,
            get_rotate_status,
            update_rotate_interval,
            scan_local_directory,
            fetch_image_bytes,
            read_file_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
