const DEFAULT_API = 'https://cozy-pixels.vercel.app/api/wallpapers';
const STATIC_BASE = 'https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@main/frontend/public';

const DEFAULT_INTERVAL = 60;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Cozy Engine initialized');
  
  const result = await chrome.storage.local.get(['rotationInterval']);
  const interval = result.rotationInterval || DEFAULT_INTERVAL;
  if (!result.rotationInterval) {
    await chrome.storage.local.set({ rotationInterval: interval });
  }

  fetchAndSaveWallpapers();
  chrome.alarms.create('rotateWallpaper', { periodInMinutes: interval });
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
    fetch('http://localhost:3001/api/wallpapers')
      .then(res => res.json())
      .then(data => chrome.storage.local.set({ allWallpapers: data }))
      .catch(() => {});
  }
}

async function rotateWallpaper() {
  try {
    // Skip entirely while a live wallpaper (video/gif/web) is active — the
    // static image would just be fetched, base64-encoded, and cached into
    // storage for nothing, since #live-wallpaper-layer is drawn on top of
    // it and it's never actually seen. This is exactly the "the rotation
    // timer is a static-wallpaper-only thing" boundary: the alarm keeps
    // ticking on schedule so it picks back up immediately once live mode
    // is turned off, but does zero network/storage work while it wouldn't
    // be visible anyway.
    const liveState = await chrome.storage.local.get(['toggleLiveWallpaper']);
    if (liveState.toggleLiveWallpaper) {
      console.log('Cozy Engine: skipping static rotation — live wallpaper is active');
      return;
    }

    const result = await chrome.storage.local.get(['allWallpapers', 'favoriteWallpapers', 'toggleCycleFavorites']);
    
    let wallpapersList = result.allWallpapers || [];
    
    // Filter list to favorites if settings dictate and there are favorites
    if (result.toggleCycleFavorites && result.favoriteWallpapers && result.favoriteWallpapers.length > 0) {
      wallpapersList = result.favoriteWallpapers;
    }

    if (wallpapersList.length === 0) {
      console.log('No wallpapers in storage, fetching now...');
      await fetchAndSaveWallpapers();
      return;
    }
    
    const randomIdx = Math.floor(Math.random() * wallpapersList.length);
    const selected = wallpapersList[randomIdx];
    
    const wallpaperUrl = selected.path.startsWith('http') 
      ? selected.path 
      : `${STATIC_BASE}${selected.path}`;

    try {
      const imgResponse = await fetch(wallpaperUrl);
      const blob = await imgResponse.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const dataUrl = `data:${blob.type};base64,${base64}`;

      await chrome.storage.local.set({ 
        currentWallpaper: wallpaperUrl,
        cachedImage: dataUrl,
        currentMeta: selected
      });

      chrome.runtime.sendMessage({ action: "refreshUI" }).catch(() => {});
    } catch (imgErr) {
      console.error('Failed to download image for caching:', imgErr);
      await chrome.storage.local.set({ 
        currentWallpaper: wallpaperUrl,
        cachedImage: null,
        currentMeta: selected
      });
      // Try to notify newtab UI to refresh background even if image caching failed
      chrome.runtime.sendMessage({ action: "refreshUI" }).catch(() => {});
    }
  } catch (err) {
    console.error('Cozy Engine: Rotation error', err);
  }
}

// Security: Restrict allowed messaging origins for runtime events
const SECURE_ORIGINS = [
  'https://cozy-pixels.vercel.app',
  'https://cozy-pixels.eu.org',
  'https://cdn.jsdelivr.net'
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security validation: Verify message origin if sender is web page
  if (sender.tab && sender.tab.url) {
    try {
      const tabUrl = new URL(sender.tab.url);
      const origin = tabUrl.origin;
      const isLocalhost = tabUrl.hostname === 'localhost' || tabUrl.hostname === '127.0.0.1';

      if (!SECURE_ORIGINS.includes(origin) && !isLocalhost) {
        console.warn('Blocked runtime message from untrusted origin:', origin);
        return false;
      }
    } catch (e) {
      console.error('Failed to parse sender URL:', e);
      return false;
    }
  }

  if (request.action === "triggerRotation") {
    rotateWallpaper().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === "updateTimer") {
    const newInterval = parseInt(request.interval, 10);
    if (newInterval && newInterval > 0) {
      chrome.storage.local.set({ rotationInterval: newInterval }).then(() => {
        chrome.alarms.clear('rotateWallpaper', () => {
          chrome.alarms.create('rotateWallpaper', { periodInMinutes: newInterval });
          sendResponse({ success: true });
        });
      });
      return true;
    }
  }
});
