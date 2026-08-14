<div align="center">
  <img src="cozypixels-banner.png" width="100%" alt="CozyPixels Banner">

  <h1>CozyPixels</h1>
  <p><strong>A curated collection of minimalist, serene, and high-resolution wallpapers.</strong></p>
  
  <p>
    <a href="https://cozy-pixels.vercel.app/"><strong>Visit the Website -></strong></a>
  </p>
</div>

<hr />

## About The Project
CozyPixels started as a collection of beautiful wallpapers and turned into a dedicated website, a browser extension, and a native desktop app. The goal is to provide a clean, distraction-free environment for your workspace. 

- **Focus Mode**: Open any wallpaper in full-screen to remove distractions.
- **Productivity**: Includes a Pomodoro timer built directly into the site.
- **Ambient Sounds**: Listen to high-quality ambient noise to stay in the zone.

## Desktop App & Browser Extension
We built native desktop and browser apps to integrate these wallpapers directly into your daily workflow.

### Desktop App (Windows, macOS, Linux)
The standalone desktop app gives you a beautiful native experience to manage and set wallpapers on your computer across multiple platforms.
- Add local folders or fetch ultra-high resolution images directly from the web.
- Automatically changes your desktop wallpaper on a customizable timer.
- Runs silently in the system tray.

**[Download the App](https://github.com/yadavnikhil03/CozyPixels/releases/latest)**

### Browser Extension (Cozy Engine)
We also built a Chrome extension that replaces your new tab page with a rotating cozy wallpaper. 
- Automatically changes wallpapers based on a timer you set.
- Caches images offline so they load instantly without any network delay.

### Installation
1. Go to [CozyPixels](https://cozypixels.eu.org/).
2. Click **"Install Extension"** to download the extension package.
3. Open `chrome://extensions` in your browser.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the folder you extracted.

### Local Development
If images do not appear while running locally, make sure the backend is running on port `3001` and the frontend is running on port `5176`. The site and extension both read wallpapers from the shared static image folders.

## Collections
We feature wallpapers based on popular developer themes:
- **Catppuccin**: Warm, latte-inspired pastels.
- **Nord**: Arctic, cool north-bluish tones.
- **One Dark**: The classic, comfortable dark theme.

---

## Contributing 🚀

We welcome contributions of all kinds! Whether you are fixing a bug, adding new wallpapers, improving the desktop app, or making the extension cooler, your help is highly appreciated.

### How to Contribute:
1. **Fork the Repository**: Click the **Fork** button at the top right of this page.
2. **Add Wallpapers**:
   * Place your high-res wallpapers inside the correct subfolder in `frontend/public/` (e.g. `Catppuccin`, `Nord`, or `One Dark`).
   * Run the indexer script to auto-generate the catalog:
     ```bash
     cd backend
     node generate.js
     node generate-sitemap.js
     ```
3. **Desktop & Extension Enhancements**:
   * Navigate to `/desktop` or `/extension` folders.
   * **Important for Desktop**: The desktop app uses a Tauri backend, which requires [Rust](https://rustup.rs/) to be installed. After installing Rust, make sure to restart your terminal.
   * Run the desktop app locally:
     ```bash
     cd desktop
     npm install
     npm run tauri dev
     ```
   * Follow the existing coding style and test your changes locally.
4. **Submit a Pull Request (PR)**: Create a branch, commit your changes, push to your fork, and submit a PR to `main`!

Feel free to check out the open issues or create a new one to start discussing features!

---

## Acknowledgements & Credits

This project was heavily inspired by and built around the incredible original wallpaper collection curated by **[SleepyCatHey](https://github.com/SleepyCatHey)**. 
- Original Repository: **[SleepyCatHey/CozyPixels](https://github.com/SleepyCatHey/CozyPixels)**

Big thanks to the communities that created these aesthetics:
- [Catppuccin Community](https://catppuccin.com)
- [Nord Theme](https://www.nordtheme.com)
- [One Dark Theme](https://github.com/one-dark)

And massive credit to the original wallpaper repositories and sources:
- [Catppuccin wallpaper repo](https://github.com/orangci/walls-catppuccin-mocha) (by orangci)
- [Nord wallpaper repo](https://github.com/linuxdotexe/nordic-wallpapers) (by linuxdotexe)
- [One Dark wallpaper repo](https://github.com/Narmis-E/onedark-wallpapers) (by Narmis-E)
- [r/unixporn](https://www.reddit.com/r/unixporn) and [r/wallpaper](https://www.reddit.com/r/wallpaper)
- And all the talented artists on X and Pinterest.

**Note to Artists:** If you recognize your artwork here and it isn't credited, please reach out to `@yadavnikhil03` or the original curator. We're happy to add your profile or remove the artwork upon request.

---

<div align="center">
  <p>Built by <a href="https://github.com/yadavnikhil03">@yadavnikhil03</a></p>
  <p>(c) 2026 CozyPixels</p>
</div>
