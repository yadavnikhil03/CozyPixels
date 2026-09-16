use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Emitter;
use sha2::{Digest, Sha256};

#[cfg(target_os = "windows")]
mod gif_wallpaper;

const APP_USER_AGENT: &str = "CozyPixels-Desktop/1.0 (https://cozy-pixels.vercel.app)";

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(APP_USER_AGENT)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(45))
            .build()
            .expect("Failed to build HTTP client")
    })
}

static ROTATE_RUNNING: AtomicBool = AtomicBool::new(false);
static ROTATE_INTERVAL: AtomicU64 = AtomicU64::new(900000);
static ROTATE_GENERATION: AtomicU64 = AtomicU64::new(0);
static VIDEO_WALLPAPER_URL: Mutex<Option<String>> = Mutex::new(None);
static SYNC_RUNNING: AtomicBool = AtomicBool::new(true);
static WALLPAPER_MUTEX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WallpaperInfo {
    name: String,
    url: String,
}

#[tauri::command]
async fn set_wallpaper(app: tauri::AppHandle, url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let _guard = WALLPAPER_MUTEX.lock().await;
        if let Some(video_window) = app.get_webview_window("video_bg") {
            if let Err(e) = video_window.destroy() {
                eprintln!("[CozyPixels] Warning: failed to stop live wallpaper window: {}", e);
            }
        }
        let app_for_main = app.clone();
        if let Err(e) = dispatch_main(&app_for_main, || unsafe { gif_wallpaper::destroy(); }) {
            eprintln!("[CozyPixels] Warning: failed to dispatch GIF cleanup: {}", e);
        }
    }

    if !url.starts_with("http://") && !url.starts_with("https://") {
        let _guard = WALLPAPER_MUTEX.lock().await;
        set_wallpaper_os(&url)?;
        return Ok("Local wallpaper set".to_string());
    }

    if let Ok(cache_dir) = get_cache_dir(&app) {
        let cached_path = cache_file_path(&cache_dir, &url);
        if cached_path.exists() {
            if let Some(path_str) = cached_path.to_str() {
                let _guard = WALLPAPER_MUTEX.lock().await;
                set_wallpaper_os(path_str)?;
                return Ok("Wallpaper set from cache".to_string());
            }
        }
    }

    let temp_dir = std::env::temp_dir();
    let filename = url
        .split('/')
        .next_back()
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

    let response = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Read failed: {}", e))?;
    tokio::fs::write(&temp_path, &bytes)
        .await
        .map_err(|e| format!("Write failed: {}", e))?;

    let path_str = temp_path.to_str().ok_or("Invalid temp path")?.to_string();
    {
        let _guard = WALLPAPER_MUTEX.lock().await;
        set_wallpaper_os(&path_str)?;
    }

    Ok(format!("Wallpaper set: {}", filename))
}

fn normalize_local_path(path: &str) -> String {
    let mut normalized = path
        .trim_start_matches("asset://localhost/")
        .trim_start_matches("asset://localhost")
        .trim_start_matches("http://asset.localhost/")
        .trim_start_matches("https://asset.localhost/")
        .to_string();

    #[cfg(target_os = "windows")]
    {
        if normalized.starts_with('/') && normalized.len() >= 3 && normalized.chars().nth(2) == Some(':') {
            normalized = normalized[1..].to_string();
        }
        normalized = normalized.replace("%20", " ");
        normalized = normalized.replace('/', "\\");
    }

    #[cfg(not(target_os = "windows"))]
    {
        normalized = normalized.replace("%20", " ");
    }

    normalized
}

fn set_wallpaper_os(path: &str) -> Result<(), String> {
    let normalized_path = normalize_local_path(path);

    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::iter::once;
        use std::os::windows::ffi::OsStrExt;

        let wide: Vec<u16> = OsStr::new(&normalized_path).encode_wide().chain(once(0)).collect();

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
        let escaped_path = normalized_path.replace("\"", "\\\"");
        let script = format!(
            r#"tell application "System Events" to set picture of every desktop to POSIX file "{}""#,
            escaped_path
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
        let escaped_path = normalized_path.replace("'", "'\\''");
        let gnome = std::process::Command::new("gsettings")
            .args(&[
                "set",
                "org.gnome.desktop.background",
                "picture-uri",
                &format!("'file://{}'", escaped_path),
            ])
            .status();

        let _ = std::process::Command::new("gsettings")
            .args(&[
                "set",
                "org.gnome.desktop.background",
                "picture-uri-dark",
                &format!("'file://{}'", escaped_path),
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
        
        let path_str = if !url.starts_with("http") {
            url.replace('/', "\\")
        } else {
            let temp_dir = std::env::temp_dir();
            let filename = url.split('/').next_back().unwrap_or("cozy-lock.jpg").to_string();
            let temp_path = temp_dir.join(format!("cozypixels_lock_{}", filename));
            let path_clone = temp_path.clone();
            
            let response = http_client().get(&url).send().await.map_err(|e| format!("Download failed: {}", e))?;
            let bytes = response.bytes().await.map_err(|e| format!("Read failed: {}", e))?;
            tokio::fs::write(&path_clone, &bytes).await.map_err(|e| format!("Write failed: {}", e))?;
            
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
        
        Ok("Lock screen updated successfully".to_string())
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

    let interval_ms = interval_ms.max(60_000);
    let generation = ROTATE_GENERATION.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
    ROTATE_RUNNING.store(true, std::sync::atomic::Ordering::SeqCst);

    let wallpapers = Arc::new(wallpapers);
    let index = Arc::new(Mutex::new(start_index.unwrap_or(0) % wallpapers.len()));
    let initial_delay = initial_delay_ms.unwrap_or(interval_ms).min(interval_ms.max(60_000));
    ROTATE_INTERVAL.store(interval_ms, std::sync::atomic::Ordering::SeqCst);

    tauri::async_runtime::spawn(async move {
        let mut first_run = true;
        loop {
            if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) || ROTATE_GENERATION.load(std::sync::atomic::Ordering::SeqCst) != generation {
                break;
            }

            let start_time = std::time::SystemTime::now();
            let current_target = if first_run {
                initial_delay
            } else {
                ROTATE_INTERVAL.load(std::sync::atomic::Ordering::SeqCst)
            };
            let target_duration = std::time::Duration::from_millis(current_target);

            while let Ok(elapsed) = start_time.elapsed() {
                if elapsed >= target_duration {
                    break;
                }
                if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) || ROTATE_GENERATION.load(std::sync::atomic::Ordering::SeqCst) != generation {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            
            first_run = false;

            if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) || ROTATE_GENERATION.load(std::sync::atomic::Ordering::SeqCst) != generation {
                break;
            }

            let current = {
                let mut idx = index.lock().unwrap();
                let wallpaper = wallpapers[*idx % wallpapers.len()].clone();
                *idx = (*idx + 1) % wallpapers.len();
                wallpaper
            };

            let url = current.url.clone();
            let name = current.name.clone();

            if url.starts_with("http://") || url.starts_with("https://") {
                let temp_dir = std::env::temp_dir();
                let filename = url.split('/').next_back().unwrap_or("wallpaper.jpg").to_string();
                let temp_path = temp_dir.join(format!("cozypixels_{}", filename));

                if temp_path.exists() {
                    if let Some(path_str) = temp_path.to_str() {
                        if ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) && ROTATE_GENERATION.load(std::sync::atomic::Ordering::SeqCst) == generation {
                            let _guard = WALLPAPER_MUTEX.lock().await;
                            let _ = set_wallpaper_os(path_str);
                            let _ = window.emit("wallpaper-changed", &name);
                        }
                    }
                } else {
                    if let Ok(response) = http_client().get(&url).send().await {
                        if let Ok(bytes) = response.bytes().await {
                            let _ = tokio::fs::write(&temp_path, &bytes).await;
                            if let Some(path_str) = temp_path.to_str() {
                                if ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) && ROTATE_GENERATION.load(std::sync::atomic::Ordering::SeqCst) == generation {
                                    let _guard = WALLPAPER_MUTEX.lock().await;
                                    let _ = set_wallpaper_os(path_str);
                                    let _ = window.emit("wallpaper-changed", &name);
                                }
                            }
                        }
                    }
                }
            } else {
                if ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) && ROTATE_GENERATION.load(std::sync::atomic::Ordering::SeqCst) == generation {
                    let _guard = WALLPAPER_MUTEX.lock().await;
                    let _ = set_wallpaper_os(&url);
                    let _ = window.emit("wallpaper-changed", &name);
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
fn update_rotate_interval(new_interval_ms: u64) {
    ROTATE_INTERVAL.store(new_interval_ms.max(60_000), std::sync::atomic::Ordering::SeqCst);
}

fn is_supported_media(name_lower: &str) -> bool {
    name_lower.ends_with(".jpg") || name_lower.ends_with(".jpeg") || name_lower.ends_with(".png") || name_lower.ends_with(".webp") || name_lower.ends_with(".gif") || name_lower.ends_with(".bmp") || name_lower.ends_with(".mp4") || name_lower.ends_with(".webm")
}

#[tauri::command]
async fn scan_local_directory(path: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mut images = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&path) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Some(name) = entry.file_name().to_str() {
                            if is_supported_media(&name.to_lowercase()) {
                                if let Some(path_str) = entry.path().to_str() {
                                    images.push(path_str.to_string());
                                }
                            }
                        }
                    } else if file_type.is_dir() {
                        // One-level recursive scan
                        if let Ok(sub_entries) = std::fs::read_dir(entry.path()) {
                            for sub_entry in sub_entries.flatten() {
                                if let Ok(sub_type) = sub_entry.file_type() {
                                    if sub_type.is_file() {
                                        if let Some(name) = sub_entry.file_name().to_str() {
                                            if is_supported_media(&name.to_lowercase()) {
                                                if let Some(path_str) = sub_entry.path().to_str() {
                                                    images.push(path_str.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(images)
    })
    .await
    .map_err(|e| format!("Failed to scan directory: {}", e))?
}

use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

fn is_safe_extension(path: &str) -> bool {
    let p = std::path::Path::new(path);
    if p.components().any(|c| c == std::path::Component::ParentDir) {
        return false;
    }
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let allowed = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "mp4", "webm"];
    allowed.contains(&ext.as_str())
}

#[tauri::command]
async fn delete_local_wallpaper(path: String, allowed_folders: Vec<String>) -> Result<(), String> {
    if !is_safe_extension(&path) {
        return Err("Invalid file extension or path".to_string());
    }

    let path_obj = std::path::Path::new(&path);
    let is_allowed = allowed_folders.iter().any(|folder| {
        let folder_path = std::path::Path::new(folder);
        path_obj.starts_with(folder_path)
    });

    if !is_allowed {
        return Err("Cannot delete: file is not within an allowed local directory".to_string());
    }

    tokio::fs::remove_file(&path).await.map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn download_and_save_wallpaper(url: String, path: String) -> Result<(), String> {
    let bytes = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?
        .to_vec();
    if let Some(parent) = std::path::Path::new(&path).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    tokio::fs::write(&path, bytes).await.map_err(|e| format!("Failed to write file: {}", e))
}

fn get_cache_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to locate app cache: {}", e))?
        .join("wallpapers");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app cache: {}", e))?;
    Ok(dir)
}

fn cache_file_path(cache_dir: &std::path::Path, url: &str) -> std::path::PathBuf {
    let digest = Sha256::digest(url.as_bytes());
    let hash = format!("{:x}", digest);
    let extension = url
        .split('?')
        .next()
        .and_then(|path| path.rsplit('/').next())
        .and_then(|name| name.rsplit_once('.'))
        .map(|(_, extension)| extension.to_lowercase())
        .filter(|extension| extension.len() <= 5)
        .unwrap_or_else(|| "jpg".to_string());
    cache_dir.join(format!("{}.{}", hash, extension))
}

#[tauri::command]
async fn get_cached_image(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let cache_dir = get_cache_dir(&app)?;
    let file_path = cache_file_path(&cache_dir, &url);
    
    if file_path.exists() {
        return Ok(format!("asset://localhost/{}", file_path.to_string_lossy().replace('\\', "/")));
    }
    
    Ok(url)
}

#[tauri::command]
async fn sync_all_wallpapers(app: tauri::AppHandle, urls: Vec<String>) -> Result<(), String> {
    let cache_dir = get_cache_dir(&app)?;
    tauri::async_runtime::spawn(async move {
        let semaphore = Arc::new(tokio::sync::Semaphore::new(8));
        let mut tasks = tokio::task::JoinSet::new();

        for url in urls {
            let semaphore = semaphore.clone();
            let cache_dir = cache_dir.clone();
            tasks.spawn(async move {
                let Ok(_permit) = semaphore.acquire_owned().await else { return };
                if !SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) { return; }
                let file_path = cache_file_path(&cache_dir, &url);
                if file_path.exists() { return; }
                if let Ok(response) = http_client().get(&url).send().await {
                    if response.status().is_success() {
                        if !SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) { return; }
                        if let Ok(bytes) = response.bytes().await {
                            if !SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) { return; }
                            let temp_path = file_path.with_extension("download");
                            if tokio::fs::write(&temp_path, bytes).await.is_ok() {
                                let _ = tokio::fs::rename(temp_path, file_path).await;
                            }
                        }
                    }
                }
            });
        }

        while tasks.join_next().await.is_some() {}
    });
    
    Ok(())
}

#[tauri::command]
async fn delete_cached_wallpaper(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let cache_dir = get_cache_dir(&app)?;
    let file_path = cache_file_path(&cache_dir, &url);
    
    if file_path.exists() {
        std::fs::remove_file(&file_path).map_err(|e| format!("Failed to delete: {}", e))?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
use winapi::shared::windef::HWND;
#[cfg(target_os = "windows")]
use winapi::shared::minwindef::{BOOL, LPARAM};

#[cfg(target_os = "windows")]
static mut WORKERW: HWND = std::ptr::null_mut();

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_proc(hwnd: HWND, _: LPARAM) -> BOOL {
    use winapi::um::winuser::{FindWindowExA, GetClientRect, GetWindowRect, GetClassNameA, IsWindowVisible};
    use winapi::shared::windef::RECT;

    let mut class_name = [0u8; 256];
    GetClassNameA(hwnd, class_name.as_mut_ptr() as *mut i8, class_name.len() as i32);
    let class_str = std::ffi::CStr::from_ptr(class_name.as_ptr() as *const i8).to_string_lossy();

    if class_str == "WorkerW" || class_str == "Progman" {
        let mut wrect: RECT = std::mem::zeroed();
        GetWindowRect(hwnd, &mut wrect);
        let mut crect: RECT = std::mem::zeroed();
        GetClientRect(hwnd, &mut crect);
        let vis = IsWindowVisible(hwnd) != 0;
        let has_shelldll = !FindWindowExA(hwnd, std::ptr::null_mut(), c"SHELLDLL_DefView".as_ptr(), std::ptr::null_mut()).is_null();
        
        eprintln!("[CozyPixels DEBUG] TopLevel: {:?}, Class: {}, Vis: {}, HasSHELLDLL: {}, WRect: {}x{}, CRect: {}x{}", 
            hwnd, class_str, vis, has_shelldll, wrect.right - wrect.left, wrect.bottom - wrect.top, crect.right - crect.left, crect.bottom - crect.top);
    }

    let p = FindWindowExA(hwnd, std::ptr::null_mut(), c"SHELLDLL_DefView".as_ptr(), std::ptr::null_mut());
    if !p.is_null() {
        eprintln!("[CozyPixels DEBUG] Found SHELLDLL_DefView at {:?}", p);
        let worker = FindWindowExA(std::ptr::null_mut(), hwnd, c"WorkerW".as_ptr(), std::ptr::null_mut());
        if !worker.is_null() {
            let mut wrect: RECT = std::mem::zeroed();
            GetWindowRect(worker, &mut wrect);
            let mut crect: RECT = std::mem::zeroed();
            GetClientRect(worker, &mut crect);
            let cw = crect.right - crect.left;
            let ch = crect.bottom - crect.top;

            eprintln!("[CozyPixels DEBUG] Candidate WorkerW HWND: {:?}", worker);
            eprintln!("[CozyPixels DEBUG] Candidate WindowRect: {},{} -> {},{}", wrect.left, wrect.top, wrect.right, wrect.bottom);
            eprintln!("[CozyPixels DEBUG] Candidate ClientRect: {},{} -> {},{}", crect.left, crect.top, crect.right, crect.bottom);

            if cw > 0 && ch > 0 {
                eprintln!("[CozyPixels DEBUG] Candidate accepted");
                WORKERW = worker;
                // DO NOT return 0 yet, let's enumerate the rest to see the full hierarchy in logs!
            } else {
                eprintln!("[CozyPixels DEBUG] Candidate rejected (invalid client area)");
            }
        } else {
            eprintln!("[CozyPixels DEBUG] WorkerW sibling not found for this SHELLDLL_DefView!");
        }
    }
    1
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_child_workerw_proc(child: HWND, lparam: LPARAM) -> BOOL {
    use winapi::um::winuser::{GetClassNameA, GetClientRect, IsWindowVisible, GetParent};
    use winapi::shared::windef::RECT;
    let mut class_name = [0u8; 256];
    GetClassNameA(child, class_name.as_mut_ptr() as *mut i8, class_name.len() as i32);
    let class_str = std::ffi::CStr::from_ptr(class_name.as_ptr() as *const i8).to_string_lossy();
    if class_str == "WorkerW" {
        let vis = IsWindowVisible(child) != 0;
        let mut crect: RECT = std::mem::zeroed();
        GetClientRect(child, &mut crect);
        let cw = crect.right - crect.left;
        let ch = crect.bottom - crect.top;
        if vis && cw > 0 && ch > 0 {
            let out_ptr = lparam as *mut HWND;
            *out_ptr = child;
            
            eprintln!("[CozyPixels DEBUG] Valid child WorkerW found: {:?} (Parent: {:?}, Client: {}x{})", child, GetParent(child), cw, ch);
            return 0; // stop enumeration
        }
    }
    1
}

fn wallpaper_host_hwnd() -> winapi::shared::windef::HWND {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::winuser::{EnumWindows, FindWindowA, FindWindowExA, SendMessageTimeoutA, SMTO_NORMAL, EnumChildWindows};
        unsafe {
            let progman = FindWindowA(c"Progman".as_ptr(), std::ptr::null_mut());
            let mut result = 0;
            let sm_res = SendMessageTimeoutA(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut result);
            eprintln!("[CozyPixels DEBUG] Sent 0x052C to Progman, sm_res: {}, result: {}, err: {}", sm_res, result, winapi::um::errhandlingapi::GetLastError());

            // FIRST: Prefer a valid child WorkerW of Progman
            let mut child_workerw: HWND = std::ptr::null_mut();
            EnumChildWindows(progman, Some(enum_child_workerw_proc), &mut child_workerw as *mut HWND as LPARAM);

            if !child_workerw.is_null() {
                eprintln!("[CozyPixels DEBUG] Selected CHILD WorkerW HWND: {:?}", child_workerw);
                return child_workerw;
            }

            // FALLBACK: Top-level EnumWindows
            WORKERW = std::ptr::null_mut();
            let mut retries = 0;
            while WORKERW.is_null() && retries < 10 {
                EnumWindows(Some(enum_windows_proc), 0);
                if !WORKERW.is_null() {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
                retries += 1;
            }
            
            if WORKERW.is_null() {
                eprintln!("[CozyPixels DEBUG] WorkerW discovery failed after retries.");
                if !progman.is_null() {
                    let shell = FindWindowExA(progman, std::ptr::null_mut(), c"SHELLDLL_DefView".as_ptr(), std::ptr::null_mut());
                    if !shell.is_null() {
                        eprintln!("[CozyPixels DEBUG] Runtime evidence: Progman hosts SHELLDLL_DefView directly. Falling back to Progman.");
                        WORKERW = progman;
                    }
                }
            }
            
            let w = WORKERW;
            eprintln!("[CozyPixels DEBUG] Final selected WorkerW HWND: {:?}", w);
            w
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::ptr::null_mut()
    }
}

#[cfg(target_os = "windows")]
async fn load_wallpaper_bytes(media_url: &str) -> Result<Vec<u8>, String> {
    if media_url.starts_with("http://") || media_url.starts_with("https://") {
        let resp = http_client()
            .get(media_url)
            .send()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| format!("Read failed: {}", e))
    } else {
        let path = normalize_local_path(media_url);
        tokio::fs::read(&path)
            .await
            .map_err(|e| format!("Failed to read local file: {}", e))
    }
}

#[cfg(target_os = "windows")]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum WallpaperKind {
    None,
    Gif,
    Video,
}

#[cfg(target_os = "windows")]
pub struct ActiveWallpaper {
    pub kind: WallpaperKind,
    pub hwnd: winapi::shared::windef::HWND,
}

#[cfg(target_os = "windows")]
unsafe impl Send for ActiveWallpaper {}
#[cfg(target_os = "windows")]
unsafe impl Sync for ActiveWallpaper {}

#[cfg(target_os = "windows")]
static ACTIVE_WALLPAPER: OnceLock<Mutex<ActiveWallpaper>> = OnceLock::new();

#[cfg(target_os = "windows")]
pub fn active_wallpaper() -> &'static Mutex<ActiveWallpaper> {
    ACTIVE_WALLPAPER.get_or_init(|| Mutex::new(ActiveWallpaper { kind: WallpaperKind::None, hwnd: std::ptr::null_mut() }))
}

#[cfg(target_os = "windows")]
async fn cleanup_active_wallpaper(app: &tauri::AppHandle) -> Result<(), String> {
    eprintln!("[CozyPixels DEBUG] [CLEANUP] Starting cleanup_active_wallpaper");
    let mut old_hwnd: usize = 0;
    let mut old_kind = WallpaperKind::None;
    
    if let Ok(guard) = active_wallpaper().lock() {
        old_hwnd = guard.hwnd as usize;
        old_kind = guard.kind;
    }
    
    if old_kind == WallpaperKind::None || old_hwnd == 0 {
        eprintln!("[CozyPixels DEBUG] [CLEANUP] No active wallpaper to clean up.");
        return Ok(());
    }
    
    eprintln!("[CozyPixels DEBUG] [CLEANUP] Found active wallpaper. kind={:?}, hwnd={:?}", old_kind, old_hwnd);
    
    match old_kind {
        WallpaperKind::Gif => {
            let app_for_main = app.clone();
            let _ = dispatch_main(&app_for_main, || unsafe { gif_wallpaper::destroy(); });
        }
        WallpaperKind::Video => {
            use tauri::Manager;
            if let Some(video_window) = app.get_webview_window("video_bg") {
                eprintln!("[CozyPixels DEBUG] [CLEANUP] Closing video window...");
                let _ = video_window.close();
            }
        }
        _ => {}
    }
    
    let mut closed = false;
    for _ in 0..50 {
        let is_w = unsafe { winapi::um::winuser::IsWindow(old_hwnd as _) };
        if is_w == 0 {
            closed = true;
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    
    eprintln!("[CozyPixels DEBUG] [CLEANUP] IsWindow after cleanup = {}", !closed);
    if !closed {
        eprintln!("[CozyPixels DEBUG] [CLEANUP] ERROR: Window {:?} did not close within 500ms.", old_hwnd);
        return Err(format!("Cleanup failed: Window {:?} did not close within 500ms.", old_hwnd));
    }
    
    if let Ok(mut guard) = active_wallpaper().lock() {
        guard.kind = WallpaperKind::None;
        guard.hwnd = std::ptr::null_mut();
    }

    eprintln!("[CozyPixels DEBUG] [CLEANUP] Cleanup complete.");
    Ok(())
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_workerw_child_proc(h: winapi::shared::windef::HWND, _lparam: winapi::shared::minwindef::LPARAM) -> winapi::shared::minwindef::BOOL {
    let mut class_name = [0u8; 256];
    winapi::um::winuser::GetClassNameA(h, class_name.as_mut_ptr() as *mut i8, class_name.len() as i32);
    let class_str = std::ffi::CStr::from_ptr(class_name.as_ptr() as *const i8).to_string_lossy();
    let is_visible = winapi::um::winuser::IsWindowVisible(h) != 0;
    eprintln!("[CozyPixels DEBUG] [VERIFY] WorkerW child: {:?}, class: {}, visible: {}", h, class_str, is_visible);
    1
}

#[cfg(target_os = "windows")]
fn dispatch_main<F>(app: &tauri::AppHandle, f: F) -> Result<(), String>
where
    F: FnOnce() + Send + 'static,
{
    app.run_on_main_thread(f).map_err(|e| e.to_string())
}
#[tauri::command]
async fn set_video_wallpaper(
    app: tauri::AppHandle,
    url: String,
    player_url: Option<String>,
) -> Result<(), String> {
    let resolved_url = player_url.clone().unwrap_or_else(|| url.clone());
    if let Ok(mut guard) = VIDEO_WALLPAPER_URL.lock() {
        *guard = Some(resolved_url);
    }

    #[cfg(target_os = "windows")]
    {
        let window_label = "video_bg";
        let video_url = player_url.unwrap_or_else(|| url.clone());

        let lower = video_url.to_lowercase();
        let is_gif = lower.ends_with(".gif");

        if is_gif {
            let bytes = load_wallpaper_bytes(&url).await?;
            let decoded = gif_wallpaper::decode_gif(&bytes)
                .map_err(|e| format!("Failed to decode animated wallpaper: {}", e))?;

            let _guard = WALLPAPER_MUTEX.lock().await;
            
            cleanup_active_wallpaper(&app).await?;
            
            let host = wallpaper_host_hwnd();
            if host.is_null() {
                return Err("Could not find the Windows desktop host window".to_string());
            }
            let host_id = host as usize;
            
            #[cfg(target_os = "windows")]
            unsafe {
                use winapi::um::winuser::{GetClassNameA, GetClientRect};
                use winapi::shared::windef::RECT;
                
                let mut class_name = [0u8; 256];
                GetClassNameA(host, class_name.as_mut_ptr() as *mut i8, class_name.len() as i32);
                let class_str = std::ffi::CStr::from_ptr(class_name.as_ptr() as *const i8).to_string_lossy();
                eprintln!("[CozyPixels DEBUG] GIF Host HWND: {:?}, Class: {}", host, class_str);
                
                let mut crect: RECT = std::mem::zeroed();
                GetClientRect(host, &mut crect);
                eprintln!("[CozyPixels DEBUG] GIF Host ClientRect: {}x{}", crect.right - crect.left, crect.bottom - crect.top);
            }
            
            unsafe {
                eprintln!("[CozyPixels DEBUG] [VERIFY] Enumerating WorkerW ({:?}) children before GIF creation:", host);
                winapi::um::winuser::EnumChildWindows(host, Some(enum_workerw_child_proc), 0);
            }

            let (tx, rx) = std::sync::mpsc::channel::<Result<usize, String>>();
            let app_for_main = app.clone();
            dispatch_main(&app_for_main, move || {
                eprintln!("[CozyPixels DEBUG] Dispatching GIF show");
                let result = unsafe {
                    gif_wallpaper::show(decoded, host_id as winapi::shared::windef::HWND)
                };
                eprintln!("[CozyPixels DEBUG] GIF show result HWND: {:?}", result);
                let _ = tx.send(result.map(|h| h as usize));
            })?;
            let new_hwnd_val = rx.recv().map_err(|_| "Desktop renderer did not start".to_string())??;
            let new_hwnd = new_hwnd_val as winapi::shared::windef::HWND;
            if let Ok(mut guard) = active_wallpaper().lock() {
                guard.kind = WallpaperKind::Gif;
                guard.hwnd = new_hwnd;
            }
            eprintln!("[CozyPixels DEBUG] GIF successfully attached");
        } else {
            eprintln!("[CozyPixels DEBUG] Entering Video path");
            let _guard = WALLPAPER_MUTEX.lock().await;
            
            cleanup_active_wallpaper(&app).await?;
            
            let host = wallpaper_host_hwnd();
            if host.is_null() {
                eprintln!("[CozyPixels DEBUG] ERROR: host is null");
                return Err("Could not find the Windows desktop host window".to_string());
            }
            eprintln!("[CozyPixels DEBUG] Host HWND for Video: {:?}", host);
            
            unsafe {
                eprintln!("[CozyPixels DEBUG] [VERIFY] Enumerating WorkerW ({:?}) children before Video creation:", host);
                winapi::um::winuser::EnumChildWindows(host, Some(enum_workerw_child_proc), 0);
            }

            eprintln!("[CozyPixels DEBUG] Creating new webview window");
            let encoded_url: String = url::form_urlencoded::byte_serialize(video_url.as_bytes()).collect();
            let window = tauri::WebviewWindowBuilder::new(
                &app,
                window_label,
                tauri::WebviewUrl::App(format!("/?videoUrl={}", encoded_url).parse().unwrap())
            )
            .title("CozyPixels Video Wallpaper")
                .decorations(false)
                .transparent(false)
                .skip_taskbar(true)
                .build()
                .map_err(|e| e.to_string())?;

            let hwnd = window.hwnd().map_err(|e| e.to_string())?;
            let hwnd_ptr: winapi::shared::windef::HWND = unsafe { std::mem::transmute(hwnd) };
            if let Ok(mut guard) = active_wallpaper().lock() {
                guard.kind = WallpaperKind::Video;
                guard.hwnd = hwnd_ptr;
            }
            eprintln!("[CozyPixels DEBUG] WebView HWND: {:?}", hwnd_ptr);
            
            use winapi::um::winuser::{EnumChildWindows, SetParent, GetParent, GetWindowLongW, SetWindowLongW, SetWindowPos, GetWindowRect, GetClientRect, GWL_STYLE, WS_CHILD, WS_VISIBLE, SWP_NOACTIVATE, SWP_SHOWWINDOW, GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN};
            use winapi::shared::windef::RECT;
            use winapi::um::errhandlingapi::GetLastError;
            
            let cx_virt = unsafe { GetSystemMetrics(SM_CXVIRTUALSCREEN) };
            let cy_virt = unsafe { GetSystemMetrics(SM_CYVIRTUALSCREEN) };
            let x_virt = unsafe { GetSystemMetrics(SM_XVIRTUALSCREEN) };
            let y_virt = unsafe { GetSystemMetrics(SM_YVIRTUALSCREEN) };
            eprintln!("[CozyPixels DEBUG] Virtual metrics: {}x{} at ({},{})", cx_virt, cy_virt, x_virt, y_virt);

            unsafe {
                let mut host_wrect: RECT = std::mem::zeroed();
                GetWindowRect(host, &mut host_wrect);
                eprintln!("[CozyPixels DEBUG] Selected host HWND: {:?}", host);
                eprintln!("[CozyPixels DEBUG] WorkerW WindowRect: left={}, top={}, right={}, bottom={}", host_wrect.left, host_wrect.top, host_wrect.right, host_wrect.bottom);
                
                let mut host_rect: RECT = std::mem::zeroed();
                GetClientRect(host, &mut host_rect);
                eprintln!("[CozyPixels DEBUG] WorkerW ClientRect: left={}, top={}, right={}, bottom={}", host_rect.left, host_rect.top, host_rect.right, host_rect.bottom);

                let width = host_rect.right - host_rect.left;
                let height = host_rect.bottom - host_rect.top;
                eprintln!("[CozyPixels DEBUG] Host client dimensions (Target): {}x{}", width, height);

                if width <= 0 || height <= 0 {
                    return Err("Could not determine the desktop host size".to_string());
                }

                let parent_before = GetParent(hwnd_ptr);
                eprintln!("[CozyPixels DEBUG] Parent before reuse/setup: {:?}", parent_before);

                let old_style = GetWindowLongW(hwnd_ptr, GWL_STYLE);
                let old_exstyle = winapi::um::winuser::GetWindowLongW(hwnd_ptr, winapi::um::winuser::GWL_EXSTYLE);
                
                let mut class_name = [0u8; 256];
                winapi::um::winuser::GetClassNameA(hwnd_ptr, class_name.as_mut_ptr() as *mut i8, class_name.len() as i32);
                let class_str = std::ffi::CStr::from_ptr(class_name.as_ptr() as *const i8).to_string_lossy();
                
                let cx_frame = GetSystemMetrics(winapi::um::winuser::SM_CXFRAME);
                let cy_frame = GetSystemMetrics(winapi::um::winuser::SM_CYFRAME);
                let pad = GetSystemMetrics(winapi::um::winuser::SM_CXPADDEDBORDER);
                
                eprintln!("[CozyPixels DEBUG] ISSUE A DIAGNOSTICS:");
                eprintln!("[CozyPixels DEBUG] WebView Class: {}", class_str);
                eprintln!("[CozyPixels DEBUG] Initial GWL_STYLE: {:08X}, GWL_EXSTYLE: {:08X}", old_style, old_exstyle);
                eprintln!("[CozyPixels DEBUG] SM_CXFRAME: {}, SM_CYFRAME: {}", cx_frame, cy_frame);
                eprintln!("[CozyPixels DEBUG] SM_CXPADDEDBORDER (All sides): {}", pad);
                
                use winapi::um::winuser::{WS_CLIPSIBLINGS, WS_CLIPCHILDREN, SWP_FRAMECHANGED};
                
                let modified_style = (WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN) as i32;
                let style_res = SetWindowLongW(hwnd_ptr, GWL_STYLE, modified_style);
                if style_res == 0 {
                    eprintln!("[CozyPixels DEBUG] SetWindowLongW GetLastError: {}", GetLastError());
                }
                
                let modified_exstyle = 0i32;
                SetWindowLongW(hwnd_ptr, winapi::um::winuser::GWL_EXSTYLE, modified_exstyle);
                
                eprintln!("[CozyPixels DEBUG] Style modified from {:08X} to {:08X}, ExStyle to {:08X}", old_style, modified_style, modified_exstyle);

                let old_parent = SetParent(hwnd_ptr, host);
                if old_parent.is_null() {
                    eprintln!("[CozyPixels DEBUG] SetParent GetLastError: {}", GetLastError());
                } else {
                    eprintln!("[CozyPixels DEBUG] SetParent succeeded, old parent: {:?}", old_parent);
                }
                
                let new_parent = GetParent(hwnd_ptr);
                eprintln!("[CozyPixels DEBUG] Parent after reuse/setup (GetParent): {:?} (Expected: {:?})", new_parent, host);
                
                let swp = SetWindowPos(
                    hwnd_ptr,
                    std::ptr::null_mut(),
                    0, 0, width, height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
                );
                if swp == 0 {
                    eprintln!("[CozyPixels DEBUG] SetWindowPos GetLastError: {}", GetLastError());
                } else {
                    eprintln!("[CozyPixels DEBUG] SetWindowPos succeeded.");
                }
                
                let mut inner_hwnd: winapi::shared::windef::HWND = std::ptr::null_mut();
                unsafe extern "system" fn enum_child_proc(h: winapi::shared::windef::HWND, lparam: winapi::shared::minwindef::LPARAM) -> winapi::shared::minwindef::BOOL {
                    let mut class_name = [0u8; 256];
                    winapi::um::winuser::GetClassNameA(h, class_name.as_mut_ptr() as *mut i8, class_name.len() as i32);
                    let class_str = std::ffi::CStr::from_ptr(class_name.as_ptr() as *const i8).to_string_lossy();
                    
                    let mut rc: RECT = std::mem::zeroed();
                    GetWindowRect(h, &mut rc);
                    let w = rc.right - rc.left;
                    let h_rect = rc.bottom - rc.top;
                    
                    eprintln!("[CozyPixels DEBUG] WebView inner child: {:?}, class: {}, rect: {}x{}", h, class_str, w, h_rect);
                    if class_str.contains("Chrome_WidgetWin") {
                        let inner_ptr = lparam as *mut winapi::shared::windef::HWND;
                        if (*inner_ptr).is_null() {
                            *inner_ptr = h;
                        }
                    }
                    1
                }
                EnumChildWindows(hwnd_ptr, Some(enum_child_proc), &mut inner_hwnd as *mut _ as winapi::shared::minwindef::LPARAM);
                
                if !inner_hwnd.is_null() {
                    eprintln!("[CozyPixels DEBUG] Found inner WebView child to resize: {:?}", inner_hwnd);
                    let swp_inner = SetWindowPos(
                        inner_hwnd,
                        std::ptr::null_mut(),
                        0, 0, width, height,
                        SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED,
                    );
                    if swp_inner == 0 {
                        eprintln!("[CozyPixels DEBUG] SetWindowPos inner GetLastError: {}", GetLastError());
                    } else {
                        eprintln!("[CozyPixels DEBUG] SetWindowPos inner succeeded.");
                    }
                }
                
                let mut r_win: RECT = std::mem::zeroed();
                if GetWindowRect(hwnd_ptr, &mut r_win) != 0 {
                    eprintln!("[CozyPixels DEBUG] Renderer Final WindowRect: left={}, top={}, right={}, bottom={}", r_win.left, r_win.top, r_win.right, r_win.bottom);
                } else {
                    eprintln!("[CozyPixels DEBUG] GetWindowRect GetLastError: {}", GetLastError());
                }
                
                let mut r_client: RECT = std::mem::zeroed();
                if GetClientRect(hwnd_ptr, &mut r_client) != 0 {
                    eprintln!("[CozyPixels DEBUG] Renderer Final ClientRect: left={}, top={}, right={}, bottom={}", r_client.left, r_client.top, r_client.right, r_client.bottom);
                    eprintln!("[CozyPixels DEBUG] Renderer Final Client dimensions: {}x{}", r_client.right - r_client.left, r_client.bottom - r_client.top);
                } else {
                    eprintln!("[CozyPixels DEBUG] GetClientRect GetLastError: {}", GetLastError());
                }
            }

            eprintln!("[CozyPixels DEBUG] Emitting change-video event");
            let _ = window.emit("change-video", &video_url);
            eprintln!("[CozyPixels DEBUG] change-video event emitted successfully");
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        let window_label = "video_bg";
        let video_url = player_url.unwrap_or_else(|| url.clone());
        
        if let Some(old) = app.get_webview_window(window_label) {
            let _ = old.close();
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
        
        let encoded_url: String = url::form_urlencoded::byte_serialize(video_url.as_bytes()).collect();
        let window = tauri::WebviewWindowBuilder::new(
            &app,
            window_label,
            tauri::WebviewUrl::App(format!("/?videoUrl={}", encoded_url).parse().unwrap())
        )
        .title("CozyPixels Video Wallpaper")
        .decorations(false)
        .always_on_bottom(true)
        .fullscreen(true)
        .build()
        .map_err(|e| e.to_string())?;
        
        use cocoa::base::id;
        use objc::{msg_send, sel, sel_impl};
        
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
        
        unsafe {
            let desktop_level: i32 = -2147483648; 
            let _: () = msg_send![ns_window, setLevel: desktop_level];
            
            let behavior: u64 = 1 << 4; 
            let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
        }
    }

    #[cfg(target_os = "linux")]
    {
        let window_label = "video_bg";
        let video_url = player_url.unwrap_or_else(|| url.clone());
        
        if let Some(old) = app.get_webview_window(window_label) {
            let _ = old.close();
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
        
        let encoded_url: String = url::form_urlencoded::byte_serialize(video_url.as_bytes()).collect();
        let _window = tauri::WebviewWindowBuilder::new(
            &app,
            window_label,
            tauri::WebviewUrl::App(format!("/?videoUrl={}", encoded_url).parse().unwrap())
        )
        .title("CozyPixels Video Wallpaper")
        .decorations(false)
        .transparent(false)
        .always_on_bottom(true)
        .fullscreen(true)
        .build()
        .map_err(|e| e.to_string())?;
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Video wallpapers are currently only supported on Windows, macOS, and Linux.".to_string());
    }
    
    Ok(())
}

#[tauri::command]
async fn copy_local_wallpaper(source: String, dest: String) -> Result<(), String> {
    tokio::fs::copy(&source, &dest).await.map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_video_wallpaper_url() -> Result<Option<String>, String> {
    VIDEO_WALLPAPER_URL.lock().map(|g| g.clone()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show CozyPixels", true, None::<&str>)?;
            let next_i = MenuItem::with_id(app, "next", "Next Wallpaper", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle_rotate", "Toggle Auto-Rotate", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &next_i, &toggle_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        SYNC_RUNNING.store(false, std::sync::atomic::Ordering::SeqCst);
                        app.exit(0);
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
                .tooltip("CozyPixels")
                .build(app)?;

            if std::env::args().any(|arg| arg == "--autostart") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_wallpaper,
            set_lock_screen,
            start_auto_rotate,
            stop_auto_rotate,
            update_rotate_interval,
            scan_local_directory,
            delete_local_wallpaper,
            download_and_save_wallpaper,
            copy_local_wallpaper,
            get_cached_image,
            delete_cached_wallpaper,
            set_video_wallpaper,
            sync_all_wallpapers,
            get_video_wallpaper_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
