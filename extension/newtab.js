async function updateUI() {
  const result = await chrome.storage.local.get(['cachedImage', 'currentWallpaper', 'currentMeta']);
  
  const targetImage = result.cachedImage || result.currentWallpaper;

  if (targetImage) {
    const bg = document.getElementById('sanctuary-bg');

    // Create an image object to check if it actually loads
    const img = new Image();
    img.onload = () => {
      bg.style.backgroundImage = `url("${targetImage}")`;
      bg.style.opacity = 1;
    };
    img.onerror = () => {
      console.error('Failed to load wallpaper');
      bg.style.backgroundColor = '#1e1c0a'; // Dark fallback
      bg.style.opacity = 1;
    };
    img.src = targetImage;
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
