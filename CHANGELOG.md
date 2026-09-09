# Changelog

## [1.5.0] - 2026-09-04

### Improved

- **Complete Architectural Redesign:** Upgraded application architecture by replacing custom unstable protocols with robust native Tauri `asset://` protocol endpoints.
- **Glassmorphism UI Overhaul:** Rebuilt the entire user interface to feature a premium, dynamic glassmorphic design system with modern typography and sleek micro-animations.
- **Testing Infrastructure:** Integrated headless Vitest and JSDOM testing environments for isolated frontend validation.
- **Seamless Desktop Integration:** Rewrote the Windows background rendering engine to tap into native Tauri monitor bounds to completely eradicate scaling mismatch gaps.

### Fixed

- **Animated Wallpaper Engine:** Fixed an issue where GIF wallpapers froze on the desktop. Animated GIFs are now piped directly into the live background engine.
- **Video Wallpapers Working Flawlessly:** Resolved all edge-clipping and gap issues with video wallpapers by correctly processing multi-monitor physical bounds across all DPI scaling levels.
- **Category Auto-Rotate State:** Fixed a backend synchronization bug that caused auto-rotation to fail when switching wallpaper categories.

## [1.4.0] - 2026-08-26

### Improved

- Added persistent local wallpaper caching for faster launches and offline reuse.
- Added background CDN catalog refresh with local catalog startup fallback.
- Added bounded parallel downloads so initial cache population does not overwhelm the network.
- Improved image loading fallback when cached files are missing or invalid.
- Improved wallpaper card repaint performance for smoother scrolling.
- Added network timeouts so offline requests fail quickly and do not stall the app.

### Fixed

- Fixed live wallpaper layers remaining visible when switching to an image wallpaper.
- Fixed live wallpaper edge bleeding around the desktop bounds.
- Fixed WebView2 lifecycle crashes during wallpaper transitions.
- Fixed cache deletion targeting the wrong file after hashed cache names were introduced.
- Removed unused frontend imports and obsolete in-memory image-cache code.

### Release Notes

This release includes the Windows desktop installer and updater artifacts. Download the appropriate installer from the assets below.

## [1.3.0] - 2026-08-26

### Fixed

- Fixed static wallpapers not appearing after a live wallpaper was active.
- Fixed normal wallpaper cards and previews failing when a cached image URL was invalid.
- Added CDN fallback when a local cached image cannot be loaded.
- Fixed live wallpaper desktop-host detection with a Windows shell fallback.
- Fixed local video URLs and video playback permissions in the desktop webview.
- Prevented browser mode from throwing raw Tauri API errors.
- Prevented Set Both from changing the lock screen when wallpaper application fails.

### Improved

- Added safer handling for missing wallpaper data and failed wallpaper actions.
- Added live wallpaper window permissions and improved desktop window sizing.
