const API_URL = 'http://localhost:3001/api/wallpapers';
const STATIC_URL = 'http://localhost:3001';

// Initial fetch and rotation setup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Cozy Engine installed');
  fetchAndSaveWallpapers();
});

// Alarm for scheduled rotation (e.g., every hour)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'rotateWallpaper') {
    rotateWallpaper();
  }
});

async function fetchAndSaveWallpapers() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    await chrome.storage.local.set({ allWallpapers: data });
    rotateWallpaper();
  } catch (err) {
    console.error('Failed to fetch wallpapers', err);
  }
}

async function rotateWallpaper() {
  const result = await chrome.storage.local.get(['allWallpapers']);
  if (result.allWallpapers && result.allWallpapers.length > 0) {
    const randomIdx = Math.floor(Math.random() * result.allWallpapers.length);
    const selected = result.allWallpapers[randomIdx];
    await chrome.storage.local.set({ 
      currentWallpaper: `${STATIC_URL}${selected.path}`,
      currentMeta: selected
    });
  }
}
