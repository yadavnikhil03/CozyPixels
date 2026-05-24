async function updateUI() {
  const result = await chrome.storage.local.get(['currentWallpaper', 'currentMeta']);
  
  if (result.currentWallpaper) {
    document.getElementById('sanctuary-bg').style.backgroundImage = `url(${result.currentWallpaper})`;
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

setInterval(updateClock, 1000);
updateUI();
