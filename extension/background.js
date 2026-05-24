const DEFAULT_API = 'https://cozypixels.onrender.com/api/wallpapers';
const STATIC_BASE = 'https://cozypixels.onrender.com';

// Initial fetch and rotation setup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Cozy Engine initialized');
  fetchAndSaveWallpapers();
  chrome.alarms.create('rotateWallpaper', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'rotateWallpaper') {
    rotateWallpaper();
  }
});

async function fetchAndSaveWallpapers() {
  try {
    const response = await fetch(DEFAULT_API);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    await chrome.storage.local.set({ allWallpapers: data });
    await rotateWallpaper();
  } catch (err) {
    console.error('Cozy Engine: Failed to fetch wallpapers', err);
    // Fallback to local if production fails during dev
    fetch('http://localhost:3001/api/wallpapers')
      .then(res => res.json())
      .then(data => chrome.storage.local.set({ allWallpapers: data }))
      .catch(() => {});
  }
}

async function rotateWallpaper() {
  try {
    const result = await chrome.storage.local.get(['allWallpapers']);
    if (result.allWallpapers && result.allWallpapers.length > 0) {
      const randomIdx = Math.floor(Math.random() * result.allWallpapers.length);
      const selected = result.allWallpapers[randomIdx];
      
      const wallpaperUrl = selected.path.startsWith('http') 
        ? selected.path 
        : `${STATIC_BASE}${selected.path}`;

      await chrome.storage.local.set({ 
        currentWallpaper: wallpaperUrl,
        currentMeta: selected
      });

      chrome.runtime.sendMessage({ action: "refreshUI" }).catch(() => {});
    }
  } catch (err) {
    console.error('Cozy Engine: Rotation error', err);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "triggerRotation") {
    rotateWallpaper().then(() => sendResponse({ success: true }));
    return true; 
  }
});
