// test_geometry.rs
use winapi::shared::minwindef::*;
use winapi::shared::windef::*;
use winapi::um::winuser::*;

static mut WORKERW: HWND = std::ptr::null_mut();

unsafe extern "system" fn enum_windows_proc(hwnd: HWND, _: LPARAM) -> BOOL {
    let p = FindWindowExA(
        hwnd,
        std::ptr::null_mut(),
        c"SHELLDLL_DefView".as_ptr(),
        std::ptr::null_mut(),
    );
    if !p.is_null() {
        let worker = FindWindowExA(
            std::ptr::null_mut(),
            hwnd,
            c"WorkerW".as_ptr(),
            std::ptr::null_mut(),
        );
        if !worker.is_null() {
            WORKERW = worker;
        }
    }
    1
}

fn main() {
    unsafe {
        let progman = FindWindowA(c"Progman".as_ptr(), std::ptr::null_mut());
        if !progman.is_null() {
            let mut result: usize = 0;
            SendMessageTimeoutA(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut result);
        }

        EnumWindows(Some(enum_windows_proc), 0);
        let w = WORKERW;

        let cx = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let cy = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);

        println!("[DEBUG] Virtual Screen: {}x{} at ({},{})", cx, cy, x, y);

        if !w.is_null() {
            let mut r_win: RECT = std::mem::zeroed();
            GetWindowRect(w, &mut r_win);
            println!(
                "[DEBUG] WorkerW WindowRect: left={}, top={}, right={}, bottom={}",
                r_win.left, r_win.top, r_win.right, r_win.bottom
            );
            println!(
                "[DEBUG] WorkerW WindowRect dimensions: {}x{}",
                r_win.right - r_win.left,
                r_win.bottom - r_win.top
            );

            let mut r_client: RECT = std::mem::zeroed();
            GetClientRect(w, &mut r_client);
            println!(
                "[DEBUG] WorkerW ClientRect: left={}, top={}, right={}, bottom={}",
                r_client.left, r_client.top, r_client.right, r_client.bottom
            );
            println!(
                "[DEBUG] WorkerW ClientRect dimensions: {}x{}",
                r_client.right - r_client.left,
                r_client.bottom - r_client.top
            );
        } else {
            println!("[DEBUG] WorkerW not found.");
        }
    }
}
