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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let html = response.text().await.map_err(|e| e.to_string())?;
    
    let base_url = url::Url::parse(&url).map_err(|e| e.to_string())?;
    let mut images = Vec::new();
    
    let srcset_re = regex::Regex::new(r#"(?i)srcset\s*=\s*["']([^"']+)["']"#).unwrap();
    for cap in srcset_re.captures_iter(&html) {
        if let Some(srcset) = cap.get(1) {
            let mut best_url = "";
            let mut best_w: u32 = 0;
            for entry in srcset.as_str().split(',') {
                let parts: Vec<&str> = entry.trim().split_whitespace().collect();
                if parts.len() >= 2 {
                    let w_str = parts[1].trim_end_matches('w').trim_end_matches('x');
                    if let Ok(w) = w_str.parse::<u32>() {
                        if w > best_w {
                            best_w = w;
                            best_url = parts[0];
                        }
                    }
                } else if parts.len() == 1 && !parts[0].is_empty() {
                    if best_w == 0 {
                        best_url = parts[0];
                    }
                }
            }
            if !best_url.is_empty() {
                if let Ok(parsed) = base_url.join(best_url) {
                    images.push(parsed.to_string());
                }
            }
        }
    }
    let ext_re = regex::Regex::new(r#"(?i)(?:https?://|/|\.\./)[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>\\]*)?"#).unwrap();
    for cap in ext_re.captures_iter(&html) {
        if let Some(src) = cap.get(0) {
            let s = src.as_str();

            if !s.to_lowercase().ends_with(".gif") && !s.to_lowercase().ends_with(".svg") {
                if let Ok(parsed) = base_url.join(s) {
                    images.push(parsed.to_string());
                }
            }
        }
    }
    let attr_re = regex::Regex::new(r#"(?i)(?:src|data-src|data-original|data-lazy-src|data-highres|data-full|data-large|content|href)\s*=\s*["']([^"']+)["']"#).unwrap();
    for cap in attr_re.captures_iter(&html) {
        if let Some(src) = cap.get(1) {
            let s = src.as_str();
            let lower = s.to_lowercase();
            if lower.ends_with(".jpg") || lower.ends_with(".jpeg") || lower.ends_with(".png") || lower.ends_with(".webp") || lower.contains("images.") || lower.contains("format=jpg") || lower.contains("format=webp") || lower.contains("media.") || lower.contains("image/") {
                if let Ok(parsed) = base_url.join(s) {
                    images.push(parsed.to_string());
                }
            }
        }
    }

    images.sort();
    images.dedup();
    images.retain(|url| {
        let lower = url.to_lowercase();
        !lower.contains("favicon") && 
        !lower.contains("avatar") && 
        !lower.contains("icon") &&
        !lower.contains("logo") &&
        !lower.contains("spinner") &&
        !lower.contains("sprite") &&
        !lower.contains("emoji") &&
        !lower.contains("badge") &&
        !lower.contains("button") &&
        !lower.contains("banner") && 
        !lower.contains("thumbnail") &&
        !lower.contains("thumb") &&
        !lower.contains("/s/") &&
        !lower.contains("_small") &&
        !lower.contains("_tiny") &&
        !lower.contains("1x1") &&
        !lower.contains("pixel") &&
        !lower.contains("tracking") &&
        !lower.contains("spacer") &&
        !lower.contains("placeholder") &&
        !lower.ends_with(".svg") &&
        !lower.ends_with(".gif")
    });
    for img in images.iter_mut() {
        if img.contains("images.unsplash.com") {
            *img = regex::Regex::new(r"(?i)[?&]w=\d+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]h=\d+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]q=\d+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]fm=\w+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]auto=\w+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]fit=\w+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]crop=\w+").unwrap().replace_all(img, "").to_string();
            *img = img.trim_end_matches('?').trim_end_matches('&').to_string();
            if img.contains("?") {
                img.push_str("&w=3840&q=100&fm=jpg");
            } else {
                img.push_str("?w=3840&q=100&fm=jpg");
            }
            continue;
        }
        if img.contains("preview.redd.it") {
            *img = img.replace("preview.redd.it", "i.redd.it");
            if let Some(pos) = img.find('?') {
                *img = img[..pos].to_string();
            }
            continue;
        }
        if img.contains("i.pinimg.com") {
            *img = regex::Regex::new(r"(?i)i\.pinimg\.com/\d+x/").unwrap().replace_all(img, "i.pinimg.com/originals/").to_string();
            *img = regex::Regex::new(r"(?i)i\.pinimg\.com/\d+x\d+/").unwrap().replace_all(img, "i.pinimg.com/originals/").to_string();
            continue;
        }
        if img.contains("images.pexels.com") {
            *img = regex::Regex::new(r"(?i)[?&]auto=compress[^&]*").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]cs=\w+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]w=\d+").unwrap().replace_all(img, "").to_string();
            *img = regex::Regex::new(r"(?i)[?&]h=\d+").unwrap().replace_all(img, "").to_string();
            *img = img.trim_end_matches('?').trim_end_matches('&').to_string();
            continue;
        }
        if img.contains("staticflickr.com") || img.contains("live.staticflickr.com") {
            *img = regex::Regex::new(r"(?i)_[smtqnzc]\.").unwrap().replace_all(img, "_b.").to_string();
            continue;
        }
        if img.contains("i.imgur.com") {
            *img = regex::Regex::new(r"(?i)([a-zA-Z0-9]+)[sbtmlh]\.(jpg|jpeg|png|webp)").unwrap().replace_all(img, "$1.$2").to_string();
            continue;
        }
        if img.contains("pixabay.com") {
            *img = regex::Regex::new(r"(?i)_\d+\.").unwrap().replace_all(img, "_1280.").to_string();
            continue;
        }
        if img.contains("tumblr.com") {
            *img = regex::Regex::new(r"(?i)_(\d+)\.(jpg|png|webp)").unwrap().replace_all(img, "_1280.$2").to_string();
            continue;
        }
        if img.contains("th.wallhaven.cc/small") {
            let wh_re = regex::Regex::new(r"(?i)th\.wallhaven\.cc/small/([a-z0-9]+)/([a-z0-9]+)\.(jpg|png)").unwrap();
            *img = wh_re.replace_all(img, "w.wallhaven.cc/full/$1/wallhaven-$2.$3").to_string();
            continue;
        }
        *img = regex::Regex::new(r"(?i)[-_]\d+x\d+\.(jpg|jpeg|png|webp)").unwrap().replace_all(img, ".$1").to_string();
        *img = regex::Regex::new(r"(?i)[?&](?:w|width|h|height|size|resize)=\d+").unwrap().replace_all(img, "").to_string();
        *img = regex::Regex::new(r"[?&]$").unwrap().replace_all(img, "").to_string();
    }

    images.sort();
    images.dedup();
    
    let filter_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .unwrap_or_default();

    let mut tasks = Vec::new();
    for img in images.into_iter() {
        let c = filter_client.clone();
        tasks.push(tokio::spawn(async move {
            if img.contains("images.unsplash.com") || img.contains("i.pinimg.com/originals") || 
               img.contains("w.wallhaven.cc/full") || img.contains("i.redd.it") ||
               img.contains("_1280.") || img.contains("_b.") || img.contains("/originals/") {
                return Some(img);
            }
            
            if let Ok(resp) = c.head(&img).send().await {
                if resp.status().is_success() {
                    if let Some(len) = resp.content_length() {
                        if len > 0 && len < 100_000 {
                            return None;
                        }
                    }
                    return Some(img);
                } else if resp.status().as_u16() == 403 || resp.status().as_u16() == 405 {
                    return Some(img);
                }
                return None;
            }
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
