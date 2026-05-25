document.getElementById('rotate-btn').addEventListener('click', () => {
  const btn = document.getElementById('rotate-btn');
  btn.disabled = true;
  btn.innerText = 'Updating...';
  
  // Request rotation from background worker
  chrome.runtime.sendMessage({ action: "triggerRotation" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Popup Error:", chrome.runtime.lastError);
      btn.innerText = 'Error - Try Again';
    } else {
      btn.innerText = 'Vibe Updated';
    }
    
    // Re-enable after short delay
    setTimeout(() => {
      btn.disabled = false;
      btn.innerText = 'New Random Vibe';
    }, 1500);
  });
});

document.getElementById('site-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://cozy-pixels.vercel.app/' });
});

// Load current rotation interval
chrome.storage.local.get(['rotationInterval'], (result) => {
  if (result.rotationInterval) {
    document.getElementById('interval-select').value = result.rotationInterval;
  }
});

// Update rotation interval
document.getElementById('interval-select').addEventListener('change', (e) => {
  const newInterval = e.target.value;
  chrome.runtime.sendMessage({ action: "updateTimer", interval: newInterval }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Popup Error:", chrome.runtime.lastError);
    } else if (response && response.success) {
      const selectEl = document.getElementById('interval-select');
      const originalColor = selectEl.style.color;
      selectEl.style.color = '#4CAF50'; // Green success feedback
      setTimeout(() => {
        selectEl.style.color = originalColor;
      }, 1000);
    }
  });
});
