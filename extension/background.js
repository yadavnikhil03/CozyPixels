const DEFAULT_API = 'https://cozy-pixels.vercel.app/wallpapers.json';
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
  }
}

async function rotateWallpaper() {
  try {
    const result = await chrome.storage.local.get(['allWallpapers']);
    if (!result.allWallpapers || result.allWallpapers.length === 0) {
      console.log('No wallpapers in storage, fetching now...');
      await fetchAndSaveWallpapers();
      return;
    }
    
    if (result.allWallpapers && result.allWallpapers.length > 0) {
      const randomIdx = Math.floor(Math.random() * result.allWallpapers.length);
      const selected = result.allWallpapers[randomIdx];
      
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
      }
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
