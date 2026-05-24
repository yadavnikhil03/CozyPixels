async function updateUI() {
  const result = await chrome.storage.local.get(['currentWallpaper', 'currentMeta']);
  if (result.currentWallpaper) {
    console.log('Loading wallpaper:', result.currentWallpaper);
    const bg = document.getElementById('sanctuary-bg');

    // Create an image object to check if it actually loads
    const img = new Image();
    img.onload = () => {
      bg.style.backgroundImage = `url("${result.currentWallpaper}")`;
      bg.style.opacity = 1;
    };
    img.onerror = () => {
      console.error('Failed to load wallpaper:', result.currentWallpaper);
      bg.style.backgroundColor = '#1e1c0a'; // Dark fallback
      bg.style.opacity = 1;
    };
    img.src = result.currentWallpaper;
  }

  
  if (result.currentMeta) {
    document.getElementById('wallpaper-name').innerText = result.currentMeta.name.replace(/\.[^/.]+$/, '');
  }

  updateClock();
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  document.getElementById('clock').innerText = time;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "refreshUI") {
    updateUI();
  }
});

setInterval(updateClock, 1000);
updateUI();
