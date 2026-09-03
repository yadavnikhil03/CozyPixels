use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Emitter;
use sha2::{Digest, Sha256};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WallpaperInfo {
    name: String,
    url: String,
}

#[tauri::command]
async fn set_wallpaper(app: tauri::AppHandle, url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    if let Some(video_window) = app.get_webview_window("video_bg") {
        video_window
            .destroy()
            .map_err(|e| format!("Failed to stop live wallpaper: {}", e))?;
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
        
        let path_str = if !url.starts_with("http") {
            // It's a local path, convert to backslashes for Windows API
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

    ROTATE_RUNNING.store(false, std::sync::atomic::Ordering::SeqCst);
    tokio::time::sleep(Duration::from_millis(100)).await;
    ROTATE_RUNNING.store(true, std::sync::atomic::Ordering::SeqCst);

    let wallpapers = Arc::new(wallpapers);
    let index = Arc::new(Mutex::new(start_index.unwrap_or(0)));
    let initial_delay = initial_delay_ms.unwrap_or(interval_ms);
    ROTATE_INTERVAL.store(interval_ms, std::sync::atomic::Ordering::SeqCst);

    tauri::async_runtime::spawn(async move {
        let mut first_run = true;
        loop {
            if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
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
                if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            
            first_run = false;

            if !ROTATE_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }

            let current = {
                let mut idx = index.lock().unwrap();
                *idx = (*idx + 1) % wallpapers.len();
                wallpapers[*idx].clone()
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
}

use tauri::Manager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn delete_local_wallpaper(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn download_and_save_wallpaper(url: String, path: String) -> Result<(), String> {
    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?
        .to_vec();
    std::fs::write(&path, bytes).map_err(|e| format!("Failed to write file: {}", e))
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
use winapi::shared::minwindef::{BOOL, LPARAM};
#[cfg(target_os = "windows")]
use winapi::shared::windef::HWND;
#[cfg(target_os = "windows")]
use std::ptr::null_mut;

#[cfg(target_os = "windows")]
static mut WORKERW: HWND = null_mut();

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_proc(hwnd: HWND, _: LPARAM) -> BOOL {
    use winapi::um::winuser::FindWindowExA;
    let p = FindWindowExA(hwnd, null_mut(), b"SHELLDLL_DefView\0".as_ptr() as *const i8, null_mut());
    if p != null_mut() {
        let worker = FindWindowExA(null_mut(), hwnd, b"WorkerW\0".as_ptr() as *const i8, null_mut());
        if worker != null_mut() {
            WORKERW = worker;
        }
    }
    1
}

#[cfg(target_os = "windows")]
pub fn get_workerw() -> HWND {
    use winapi::um::winuser::{EnumWindows, FindWindowA, SendMessageTimeoutA, SMTO_NORMAL};
    unsafe {
        WORKERW = null_mut();
        let progman = FindWindowA(b"Progman\0".as_ptr() as *const i8, null_mut());
        if progman != null_mut() {
            let mut result: usize = 0;
            SendMessageTimeoutA(
                progman,
                0x052C,
                0,
                0,
                SMTO_NORMAL,
                1000,
                &mut result,
            );
            EnumWindows(Some(enum_windows_proc), 0);
        }

        if WORKERW != null_mut() { WORKERW } else { progman }
    }
}

#[tauri::command]
async fn set_video_wallpaper(
    app: tauri::AppHandle,
    url: String,
    player_url: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::shared::windef::RECT;
        use winapi::um::winuser::{
            GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
            GetClientRect, SetParent, SetWindowLongW, SetWindowPos,
            GWL_STYLE, SWP_NOACTIVATE, SWP_NOZORDER, SWP_SHOWWINDOW,
            WS_CHILD, WS_CLIPCHILDREN, WS_CLIPSIBLINGS, WS_VISIBLE,
        };
        let window_label = "video_bg";
        let video_url = player_url.unwrap_or_else(|| url.clone());
        let window = if let Some(w) = app.get_webview_window(window_label) {
            w
        } else {
            let encoded_url: String = url::form_urlencoded::byte_serialize(video_url.as_bytes()).collect();
            tauri::WebviewWindowBuilder::new(
                &app,
                window_label,
                tauri::WebviewUrl::App(format!("/?videoUrl={}", encoded_url).parse().unwrap())
            )
            .title("CozyPixels Video Wallpaper")
            .decorations(false)
            .transparent(true)
            .skip_taskbar(true)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?
        };

        let _ = window.emit("change-video", &video_url);

        let worker_w = get_workerw();
        if worker_w == null_mut() {
            return Err("Could not find the Windows desktop host window".to_string());
        }

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let hwnd_ptr: HWND = unsafe { std::mem::transmute(hwnd) };
        
        let mut min_x = 0;
        let mut min_y = 0;
        let mut max_x = 0;
        let mut max_y = 0;
        
        if let Ok(monitors) = window.available_monitors() {
            for (i, monitor) in monitors.iter().enumerate() {
                let pos = monitor.position();
                let size = monitor.size();
                let right = pos.x as i32 + size.width as i32;
                let bottom = pos.y as i32 + size.height as i32;
                
                if i == 0 {
                    min_x = pos.x as i32;
                    min_y = pos.y as i32;
                    max_x = right;
                    max_y = bottom;
                } else {
                    min_x = min_x.min(pos.x as i32);
                    min_y = min_y.min(pos.y as i32);
                    max_x = max_x.max(right);
                    max_y = max_y.max(bottom);
                }
            }
        }
        
        let mut width = if max_x > min_x { max_x - min_x } else { 1920 };
        let mut height = if max_y > min_y { max_y - min_y } else { 1080 };
        let x = min_x;
        let y = min_y;
        
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: width as u32, height: height as u32 }));
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));

        unsafe {
            SetParent(hwnd_ptr, worker_w);
            SetWindowLongW(
                hwnd_ptr,
                GWL_STYLE,
                (WS_CHILD | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | WS_VISIBLE) as i32,
            );
            use winapi::um::winuser::{SWP_NOMOVE, SWP_NOSIZE};
            SetWindowPos(
                hwnd_ptr,
                null_mut(),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOZORDER | SWP_SHOWWINDOW,
            );
        }
    }
    
    // For non-Windows platforms, we can just throw an error
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Video wallpapers are currently only supported on Windows.".to_string());
    }
    
    Ok(())
}

#[tauri::command]
async fn copy_local_wallpaper(source: String, dest: String) -> Result<(), String> {
    std::fs::copy(&source, &dest).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // When a second instance is launched, focus the existing window
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
        .plugin(tauri_plugin_fs::init())
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

            // Hide window on boot if started via autostart
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
            get_rotate_status,
            update_rotate_interval,
            scan_local_directory,
            read_file_bytes,
            delete_local_wallpaper,
            download_and_save_wallpaper,
            copy_local_wallpaper,
            get_cached_image,
            delete_cached_wallpaper,
            set_video_wallpaper,
            sync_all_wallpapers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
