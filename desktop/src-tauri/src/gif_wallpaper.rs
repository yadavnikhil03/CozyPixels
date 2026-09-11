#![cfg(target_os = "windows")]

use std::num::NonZeroU64;
use std::sync::Mutex;
use std::sync::OnceLock;
use winapi::shared::minwindef::{HINSTANCE, LPARAM, LRESULT, UINT, WPARAM};
use winapi::shared::windef::{HDC, HGDIOBJ, HWND, RECT};
use winapi::um::errhandlingapi::GetLastError;
use winapi::um::libloaderapi::GetModuleHandleW;
use winapi::um::wingdi::{
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CreateCompatibleDC, CreateDIBSection, DeleteDC,
    DeleteObject, DIB_RGB_COLORS, HALFTONE, SelectObject, SetStretchBltMode, StretchBlt,
};
use winapi::um::winuser::*;

use winapi::ctypes::c_void;

#[derive(Clone)]
pub struct DecodedGif {
    pub frames: Vec<Vec<u8>>,
    pub delays: Vec<u32>,
    pub width: u32,
    pub height: u32,
}

struct State {
    hwnd: usize,
    frames: Vec<Vec<u8>>,
    delays: Vec<u32>,
    cur: usize,
    native_w: i32,
    native_h: i32,
    dib: usize,
    dib_bits: usize,
    dib_hdc: usize,
}

static STATE: OnceLock<Mutex<Option<Box<State>>>> = OnceLock::new();

fn state() -> &'static Mutex<Option<Box<State>>> {
    STATE.get_or_init(|| Mutex::new(None))
}

const GIF_CLASS: [u16; 10] = [
    b'C' as u16,
    b'o' as u16,
    b'z' as u16,
    b'y' as u16,
    b'G' as u16,
    b'i' as u16,
    b'f' as u16,
    b'B' as u16,
    b'g' as u16,
    0,
];

unsafe fn update_dib(st: &mut State) {
    if st.dib_bits == 0 {
        return;
    }
    let frame = &st.frames[st.cur];
    let dst = st.dib_bits as *mut u8;
    let pixels = (st.native_w as usize) * (st.native_h as usize);
    for i in 0..pixels {
        let r = frame[i * 4] as u32;
        let g = frame[i * 4 + 1] as u32;
        let b = frame[i * 4 + 2] as u32;
        let o = i * 4;
        *dst.add(o) = b as u8;
        *dst.add(o + 1) = g as u8;
        *dst.add(o + 2) = r as u8;
        *dst.add(o + 3) = 255;
    }
}

unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: UINT, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match msg {
        WM_PAINT => {
            let mut ps: PAINTSTRUCT = std::mem::zeroed();
            let hdc = BeginPaint(hwnd, &mut ps);
            if let Ok(mut guard) = state().lock() {
                if let Some(st) = guard.as_mut() {
                    let mut rc: RECT = std::mem::zeroed();
                    GetClientRect(hwnd, &mut rc);
                    let w = rc.right;
                    let h = rc.bottom;
                    if w > 0 && h > 0 && st.dib_hdc != 0 {
                        SetStretchBltMode(hdc, HALFTONE as i32);
                        StretchBlt(
                            hdc,
                            0,
                            0,
                            w,
                            h,
                            st.dib_hdc as HDC,
                            0,
                            0,
                            st.native_w,
                            st.native_h,
                            winapi::um::wingdi::SRCCOPY,
                        );
                    }
                }
            }
            EndPaint(hwnd, &ps);
            0
        }
        WM_TIMER => {
            if (wparam as u32) == 1 {
                if let Ok(mut guard) = state().lock() {
                    if let Some(st) = guard.as_mut() {
                        if st.frames.len() > 1 {
                            st.cur = (st.cur + 1) % st.frames.len();
                            update_dib(st);
                            let delay = st.delays[st.cur].clamp(10, 1000);
                            SetTimer(hwnd, 1usize, delay, None);
                            InvalidateRect(hwnd, std::ptr::null_mut(), 0);
                        }
                    }
                }
            }
            0
        }
        WM_ERASEBKGND => 1,
        WM_DESTROY => 0,
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

unsafe fn build_dib(st: &mut State) -> Result<(), String> {
    let mut bi: BITMAPINFO = std::mem::zeroed();
    bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bi.bmiHeader.biWidth = st.native_w;
    bi.bmiHeader.biHeight = -st.native_h;
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = BI_RGB;

    let mut bits: *mut c_void = std::ptr::null_mut();
    let dib = CreateDIBSection(
        std::ptr::null_mut(),
        &bi,
        DIB_RGB_COLORS,
        &mut bits,
        std::ptr::null_mut(),
        0,
    );
    if dib.is_null() || bits.is_null() {
        return Err(format!(
            "CreateDIBSection failed (error {})",
            GetLastError()
        ));
    }
    let dib_hdc = CreateCompatibleDC(std::ptr::null_mut());
    if dib_hdc.is_null() {
        DeleteObject(dib as HGDIOBJ);
        return Err(format!(
            "CreateCompatibleDC failed (error {})",
            GetLastError()
        ));
    }
    SelectObject(dib_hdc, dib as HGDIOBJ);
    st.dib = dib as usize;
    st.dib_bits = bits as usize;
    st.dib_hdc = dib_hdc as usize;
    update_dib(st);
    Ok(())
}

pub unsafe fn show(decoded: DecodedGif, host: HWND) -> Result<(), String> {
    if decoded.frames.is_empty() {
        return Err("The GIF has no frames".to_string());
    }
    destroy();

    let hinstance = GetModuleHandleW(std::ptr::null()) as HINSTANCE;
    let mut wc: WNDCLASSEXW = std::mem::zeroed();
    wc.cbSize = std::mem::size_of::<WNDCLASSEXW>() as UINT;
    wc.lpfnWndProc = Some(wnd_proc);
    wc.hInstance = hinstance;
    wc.lpszClassName = GIF_CLASS.as_ptr();
    RegisterClassExW(&wc);

    let mut rc: RECT = std::mem::zeroed();
    GetClientRect(host, &mut rc);
    let w = rc.right;
    let h = rc.bottom;
    if w <= 0 || h <= 0 {
        return Err("Desktop host has an invalid size".to_string());
    }

    let hwnd = CreateWindowExW(
        0,
        GIF_CLASS.as_ptr(),
        std::ptr::null(),
        WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
        0,
        0,
        w,
        h,
        host,
        std::ptr::null_mut(),
        hinstance,
        std::ptr::null_mut(),
    );
    if hwnd.is_null() {
        return Err(format!("CreateWindowExW failed (error {})", GetLastError()));
    }

    let mut st = Box::new(State {
        hwnd: hwnd as usize,
        frames: decoded.frames,
        delays: decoded.delays,
        cur: 0,
        native_w: decoded.width as i32,
        native_h: decoded.height as i32,
        dib: 0,
        dib_bits: 0,
        dib_hdc: 0,
    });
    build_dib(&mut st)?;

let delay = st.delays[0].clamp(10, 1000);
    let multi = st.frames.len() > 1;
    *state()
        .lock()
        .map_err(|_| "state lock poisoned".to_string())? = Some(st);
    if multi {
        SetTimer(hwnd, 1usize, delay, None);
    }
    ShowWindow(hwnd, SW_SHOW);
    InvalidateRect(hwnd, std::ptr::null_mut(), 0);
    UpdateWindow(hwnd);
    Ok(())
}

pub unsafe fn destroy() {
    if let Ok(mut guard) = state().lock() {
        if let Some(mut st) = guard.take() {
            if st.hwnd != 0 {
                KillTimer(st.hwnd as HWND, 1usize);
                DestroyWindow(st.hwnd as HWND);
            }
            if st.dib_hdc != 0 {
                DeleteDC(st.dib_hdc as HDC);
            }
            if st.dib != 0 {
                DeleteObject(st.dib as HGDIOBJ);
            }
            st.dib_bits = 0;
        }
    }
}

pub fn decode_gif(bytes: &[u8]) -> Result<DecodedGif, String> {
    let mut options = gif::DecodeOptions::new();
    options.set_color_output(gif::ColorOutput::RGBA);
    options.set_memory_limit(gif::MemoryLimit::Bytes(NonZeroU64::new(decoded_limit().max(1) as u64).unwrap()));
    let mut decoder = options
        .read_info(bytes)
        .map_err(|e| format!("Invalid GIF: {}", e))?;

    let width = decoder.width() as usize;
    let height = decoder.height() as usize;
    if width == 0 || height == 0 {
        return Err("Invalid GIF dimensions".to_string());
    }

    let mut canvas = vec![0u8; width * height * 4];
    for px in canvas.chunks_exact_mut(4) {
        px[3] = 255;
    }

    let mut frames: Vec<Vec<u8>> = Vec::new();
    let mut delays: Vec<u32> = Vec::new();

    while let Some(frame) = decoder
        .read_next_frame()
        .map_err(|e| format!("Invalid GIF frame: {}", e))?
    {
        let delay = frame.delay.saturating_mul(10).max(10) as u32;
        let snapshot = match frame.dispose {
            gif::DisposalMethod::Previous => Some(canvas.clone()),
            _ => None,
        };

        let fw = frame.width as usize;
        let fh = frame.height as usize;
        let left = frame.left as usize;
        let top = frame.top as usize;
        for y in 0..fh {
            for x in 0..fw {
                let sx = left + x;
                let sy = top + y;
                if sx >= width || sy >= height {
                    continue;
                }
                let fi = (y * fw + x) * 4;
                let a = frame.buffer[fi + 3] as u32;
                if a == 0 {
                    continue;
                }
                let oi = (sy * width + sx) * 4;
                let or = canvas[oi] as u32;
                let og = canvas[oi + 1] as u32;
                let ob = canvas[oi + 2] as u32;
                let sr = frame.buffer[fi] as u32;
                let sg = frame.buffer[fi + 1] as u32;
                let sb = frame.buffer[fi + 2] as u32;
                canvas[oi] = (((255 - a) * or + a * sr + 127) / 255) as u8;
                canvas[oi + 1] = (((255 - a) * og + a * sg + 127) / 255) as u8;
                canvas[oi + 2] = (((255 - a) * ob + a * sb + 127) / 255) as u8;
            }
        }

        frames.push(canvas.clone());
        delays.push(delay);

        match frame.dispose {
            gif::DisposalMethod::Background => {
                for y in top..(top + fh).min(height) {
                    for x in left..(left + fw).min(width) {
                        let oi = (y * width + x) * 4;
                        canvas[oi] = 0;
                        canvas[oi + 1] = 0;
                        canvas[oi + 2] = 0;
                        canvas[oi + 3] = 255;
                    }
                }
            }
            gif::DisposalMethod::Previous => {
                if let Some(prev) = snapshot {
                    canvas = prev;
                }
            }
            _ => {}
        }
    }

    if frames.is_empty() {
        return Err("The GIF has no frames".to_string());
    }
    Ok(DecodedGif {
        frames,
        delays,
        width: width as u32,
        height: height as u32,
    })
}

fn decoded_limit() -> usize {
    std::env::var("COZY_GIF_LIMIT")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(128 * 1024 * 1024)
}