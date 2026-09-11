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

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WallpaperInfo {
    name: String,
    url: String,
}

#[tauri::command]
async fn set_wallpaper(app: tauri::AppHandle, url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(video_window) = app.get_webview_window("video_bg") {
            video_window
                .destroy()
                .map_err(|e| format!("Failed to stop live wallpaper: {}", e))?;
        }
        let app_for_main = app.clone();
        if dispatch_main(&app_for_main, || unsafe { gif_wallpaper::destroy(); }).is_err() {
            return Err("Failed to stop animated wallpaper".to_string());
        }
    }

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

    let response = http_client()
        .get(&url_clone)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Read failed: {}", e))?;
    tokio::fs::write(&path_clone, &bytes)
        .await
        .map_err(|e| format!("Write failed: {}", e))?;

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

        let path_str = path.replace('/', "\\");
        let wide: Vec<u16> = OsStr::new(&path_str).encode_wide().chain(once(0)).collect();

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
        let escaped_path = path.replace("\"", "\\\"");
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
        let escaped_path = path.replace("'", "'\\''");
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
            let filename = url.split('/').last().unwrap_or("cozy-lock.jpg").to_string();
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
                let filename = url.split('/').last().unwrap_or("wallpaper.jpg").to_string();
                let temp_path = temp_dir.join(format!("cozypixels_{}", filename));

                if temp_path.exists() {
                    if let Some(path_str) = temp_path.to_str() {
                        let _ = set_wallpaper_os(path_str);
                        let _ = window.emit("wallpaper-changed", &name);
                    }
                } else {
                    if let Ok(response) = http_client().get(&url).send().await {
                        if let Ok(bytes) = response.bytes().await {
                            let _ = tokio::fs::write(&temp_path, &bytes).await;
                            if let Some(path_str) = temp_path.to_str() {
                                let _ = set_wallpaper_os(path_str);
                                let _ = window.emit("wallpaper-changed", &name);
                            }
                        }
                    }
                }
            } else {
                let _ = set_wallpaper_os(&url);
                let _ = window.emit("wallpaper-changed", &name);
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

#[tauri::command]
async fn scan_local_directory(path: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let mut images = Vec::new();
        let entries = std::fs::read_dir(&path).map_err(|e| format!("Failed to read dir: {}", e))?;
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    if let Some(name) = entry.file_name().to_str() {
                        let name_lower = name.to_lowercase();
                        if name_lower.ends_with(".jpg") || name_lower.ends_with(".jpeg") || name_lower.ends_with(".png") || name_lower.ends_with(".webp") || name_lower.ends_with(".gif") || name_lower.ends_with(".bmp") || name_lower.ends_with(".mp4") || name_lower.ends_with(".webm") || name_lower.ends_with(".mkv") {
                            if let Some(path_str) = entry.path().to_str() {
                                images.push(path_str.to_string());
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
    let allowed = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "mp4", "webm", "mkv"];
    allowed.contains(&ext.as_str())
}

#[tauri::command]
async fn delete_local_wallpaper(path: String) -> Result<(), String> {
    if !is_safe_extension(&path) {
        return Err("Invalid file extension or path".to_string());
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
                let file_path = cache_file_path(&cache_dir, &url);
                if file_path.exists() { return; }
                if let Ok(response) = http_client().get(&url).send().await {
                    if response.status().is_success() {
                        if let Ok(bytes) = response.bytes().await {
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
fn wallpaper_host_hwnd() -> HWND {
    use winapi::um::winuser::{
        EnumWindows, FindWindowA, FindWindowExA, GetClassNameA, GetParent,
        IsWindowVisible, SendMessageTimeoutA, SMTO_NORMAL,
    };

    struct HostScan {
        progman: HWND,
        found: HWND,
    }

    unsafe extern "system" fn find_host_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam as *mut HostScan);
        if IsWindowVisible(hwnd) != 0 {
            let mut class = [0i8; 64];
            GetClassNameA(hwnd, class.as_mut_ptr(), class.len() as i32);
            let name = std::ffi::CStr::from_ptr(class.as_ptr()).to_string_lossy();
            if name == "WorkerW"
                && (ctx.progman.is_null() || GetParent(hwnd) == ctx.progman)
                && FindWindowExA(
                    hwnd,
                    std::ptr::null_mut(),
                    b"SHELLDLL_DefView\0".as_ptr() as *const i8,
                    std::ptr::null_mut(),
                )
                .is_null()
            {
                ctx.found = hwnd;
                return 0;
            }
        }
        1
    }

    unsafe {
        let progman = FindWindowA(b"Progman\0".as_ptr() as *const i8, std::ptr::null_mut());
        if !progman.is_null() {
            let mut result: usize = 0;
            SendMessageTimeoutA(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut result);
        }
        for _ in 0..25 {
            let mut ctx = HostScan { progman, found: std::ptr::null_mut() };
            EnumWindows(Some(find_host_proc), &mut ctx as *mut HostScan as LPARAM);
            if !ctx.found.is_null() {
                return ctx.found;
            }
            std::thread::sleep(std::time::Duration::from_millis(40));
        }
        progman
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
        let path = media_url
            .trim_start_matches("asset://localhost/")
            .trim_start_matches("http://asset.localhost/")
            .trim_start_matches("https://asset.localhost/");
        tokio::fs::read(path)
            .await
            .map_err(|e| format!("Failed to read local file: {}", e))
    }
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
        let video_url = player_url.unwrap_or_else(|| url.clone());

        let lower = video_url.to_lowercase();
        if !lower.ends_with(".gif") {
            return Err("Animated desktop wallpapers currently support GIF files".to_string());
        }

        let bytes = load_wallpaper_bytes(&video_url).await?;
        let decoded = gif_wallpaper::decode_gif(&bytes)
            .map_err(|e| format!("Failed to decode animated wallpaper: {}", e))?;

        let host = wallpaper_host_hwnd();
        if host.is_null() {
            return Err("Could not find the Windows desktop host window".to_string());
        }

        let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
        let app_for_main = app.clone();
        let host_id = host as usize;
        dispatch_main(&app_for_main, move || {
            let result = unsafe {
                gif_wallpaper::show(decoded, host_id as winapi::shared::windef::HWND)
            };
            let _ = tx.send(result);
        })?;
        rx.recv().map_err(|_| "Desktop renderer did not start".to_string())??;
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
        .transparent(false)
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
