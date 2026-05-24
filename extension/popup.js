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
  chrome.tabs.create({ url: 'https://cozypixels.vercel.app' });
});
