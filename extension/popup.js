document.getElementById('rotate-btn').addEventListener('click', async () => {
  const result = await chrome.storage.local.get(['allWallpapers']);
  if (result.allWallpapers && result.allWallpapers.length > 0) {
    const randomIdx = Math.floor(Math.random() * result.allWallpapers.length);
    const selected = result.allWallpapers[randomIdx];
    await chrome.storage.local.set({ 
      currentWallpaper: `http://localhost:3001${selected.path}`,
      currentMeta: selected
    });
    // Notify any open newtab pages to update
    window.close();
  }
});

document.getElementById('site-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' });
});
