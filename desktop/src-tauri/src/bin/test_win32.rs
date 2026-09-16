// test_win32.rs
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
        println!("[DEBUG] Found SHELLDLL_DefView at {:?}", p);
        let worker = FindWindowExA(
            std::ptr::null_mut(),
            hwnd,
            c"WorkerW".as_ptr(),
            std::ptr::null_mut(),
        );
        if !worker.is_null() {
            println!("[DEBUG] Found WorkerW sibling at {:?}", worker);
            WORKERW = worker;
        } else {
            println!("[DEBUG] WorkerW sibling not found for this SHELLDLL_DefView!");
        }
    }
    1
}

fn main() {
    unsafe {
        println!("[DEBUG] Starting WorkerW discovery test...");
        let progman = FindWindowA(c"Progman".as_ptr(), std::ptr::null_mut());
        let err = winapi::um::errhandlingapi::GetLastError();
        println!("[DEBUG] Progman HWND: {:?}, GetLastError: {}", progman, err);
        if !progman.is_null() {
            let mut result: usize = 0;
            let sm_res = SendMessageTimeoutA(progman, 0x052C, 0, 0, SMTO_NORMAL, 1000, &mut result);
            println!(
                "[DEBUG] SendMessageTimeoutA returned: {}, result: {}",
                sm_res, result
            );
        }

        EnumWindows(Some(enum_windows_proc), 0);
        let w = WORKERW;
        println!("[DEBUG] Final selected WorkerW HWND: {:?}", w);

        if !w.is_null() {
            // Test if it's visible
            let style = GetWindowLongW(w, GWL_STYLE);
            println!("[DEBUG] WorkerW style: {:08X}", style);
            let visible = (style & WS_VISIBLE as i32) != 0;
            println!("[DEBUG] Is WorkerW visible? {}", visible);
        }
    }
}
