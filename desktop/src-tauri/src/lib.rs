use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

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

        if gnome.is_err() || !gnome.unwrap().success() {
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

#[tauri::command]
async fn fetch_web_images(url: String) -> Result<Vec<String>, String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let html = response.text().await.map_err(|e| e.to_string())?;
    
    let base_url = url::Url::parse(&url).map_err(|e| e.to_string())?;
    let mut images = Vec::new();
    
    // 1. Grab from standard img attributes, data-src, meta content, or hrefs
    let attr_re = regex::Regex::new(r#"(?i)(?:src|data-src|data-original|data-lazy-src|data-highres|content|href)\s*=\s*["']([^"']+)["']"#).unwrap();
    for cap in attr_re.captures_iter(&html) {
        if let Some(src) = cap.get(1) {
            let s = src.as_str();
            let lower = s.to_lowercase();
            // Check if it looks like an image
            if lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") || lower.ends_with(".webp") || lower.contains("images.") || lower.contains("format=jpg") || lower.contains("format=webp") || lower.contains("media.") || lower.contains("image/") {
                if let Ok(parsed) = base_url.join(s) {
                    images.push(parsed.to_string());
                }
            }
        }
    }
    
    // 2. Aggressive fallback: find any string in the HTML that looks like an absolute/root-relative image URL
    let ext_re = regex::Regex::new(r#"(?i)(?:https?://|/)[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp)"#).unwrap();
    for cap in ext_re.captures_iter(&html) {
        if let Some(src) = cap.get(0) {
            if let Ok(parsed) = base_url.join(src.as_str()) {
                images.push(parsed.to_string());
            }
        }
    }

    // Filter out obvious low-res assets like favicons or icons
    images.retain(|url| {
        let lower = url.to_lowercase();
        !lower.contains("favicon") && 
        !lower.contains("avatar") && 
        !lower.contains("icon") &&
        !lower.contains("logo") &&
        !lower.contains("spinner") &&
        !lower.ends_with(".svg")
    });

    // Automatically upscale known CDN thumbnails to high-resolution wallpapers
    for img in images.iter_mut() {
        if img.contains("images.unsplash.com") {
            // Unsplash: force high resolution and maximum quality
            *img = regex::Regex::new(r"(?i)&w=\d+").unwrap().replace_all(img, "&w=3840").to_string();
            *img = regex::Regex::new(r"(?i)\?w=\d+").unwrap().replace_all(img, "?w=3840").to_string();
            *img = regex::Regex::new(r"(?i)&q=\d+").unwrap().replace_all(img, "&q=100").to_string();
            if !img.contains("w=") {
                if img.contains("?") {
                    img.push_str("&w=3840&q=100");
                } else {
                    img.push_str("?w=3840&q=100");
                }
            }
        }
        if img.contains("preview.redd.it") {
            // Reddit: swap preview domain for full resolution domain
            *img = img.replace("preview.redd.it", "i.redd.it");
        }
        if img.contains("i.pinimg.com") {
            // Pinterest: upgrade thumbnail sizes (236x, 474x, 736x) to original resolution
            *img = regex::Regex::new(r"(?i)i\.pinimg\.com/\d+x/").unwrap().replace_all(img, "i.pinimg.com/originals/").to_string();
        }
        if img.contains("tumblr.com") {
            // Tumblr: upgrade _250, _400, _500, _540 to _1280
            *img = regex::Regex::new(r"(?i)_(\d+)\.(jpg|png|webp)").unwrap().replace_all(img, "_1280.$2").to_string();
        }
        if img.contains("th.wallhaven.cc/small") {
            // Wallhaven: transform thumbnail URL to full wallpaper URL
            let wh_re = regex::Regex::new(r"(?i)th\.wallhaven\.cc/small/([a-z0-9]+)/([a-z0-9]+)\.(jpg|png)").unwrap();
            *img = wh_re.replace_all(img, "w.wallhaven.cc/full/$1/wallhaven-$2.$3").to_string();
        }
    }

    images.sort();
    images.dedup();
    
    // Concurrently filter images by performing a HEAD request to check file size.
    // This rejects small icons/banners and ensures we only get high-quality wallpapers.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .unwrap_or_default();

    let mut tasks = Vec::new();
    for img in images.into_iter() {
        let client_clone = client.clone();
        tasks.push(tokio::spawn(async move {
            // Some upscaled CDN URLs might reject HEAD requests or not include Content-Length, 
            // so we automatically trust ones we manually upscaled.
            if img.contains("images.unsplash.com") || img.contains("i.pinimg.com/originals") || 
               img.contains("w.wallhaven.cc/full") || img.contains("i.redd.it") {
                return Some(img);
            }
            
            if let Ok(resp) = client_clone.head(&img).send().await {
                if resp.status().is_success() {
                    if let Some(len) = resp.content_length() {
                        // 15KB minimum size. Drops 1-10KB tiny UI icons and tracking pixels,
                        // but allows highly compressed WebP wallpapers and medium thumbnails.
                        if len < 15_000 {
                            return None;
                        }
                    }
                }
            }
            // If HEAD fails (e.g. 403 or 405) or there's no Content-Length, we keep it to be safe.
            Some(img)
        }));
    }
    
    let mut final_images = Vec::new();
    for task in tasks {
        if let Ok(Some(img)) = task.await {
            final_images.push(img);
        }
    }
    
    Ok(final_images)
}

use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

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
            
            println!("COZY PROTOCOL REQUEST: path={} local_path={}", path, local_path);
            
            if let Ok(data) = std::fs::read(&local_path) {
                let lower_path = local_path.to_lowercase();
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
                    .header("Access-Control-Allow-Origin", "*")
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
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

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
                    _ => {}
                })
                .icon(app.default_window_icon().unwrap().clone())
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
            fetch_web_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
