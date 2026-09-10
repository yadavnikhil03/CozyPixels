// Cozy Sanctuary - Core Script Logic

// --- State Variables ---
let audioCtx = null;
let masterGain = null;
let activeSounds = {}; // keys: 'rain', 'fire', 'waves', 'brown'
let currentVolume = 0.5;
let currentMeta = null;

// --- 1. Audio Synthesis (Web Audio API) ---
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = currentVolume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function getWhiteNoiseBuffer() {
  const size = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function getPinkNoiseBuffer() {
  const size = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink * 0.11; // normal scaling
  }
  return buffer;
}

function getBrownNoiseBuffer() {
  const size = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let accum = 0.0;
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    accum = (accum + (0.02 * white)) / 1.02;
    data[i] = accum * 3.5;
  }
  return buffer;
}

function startSound(type) {
  initAudio();
  if (activeSounds[type]) return;

  if (type === 'rain') {
    // Background heavy rain rumble (pink noise lowpass)
    const source1 = audioCtx.createBufferSource();
    source1.buffer = getPinkNoiseBuffer();
    source1.loop = true;
    
    const filter1 = audioCtx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.value = 450;

    const gain1 = audioCtx.createGain();
    gain1.gain.value = 0.22;

    source1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(masterGain);
    source1.start();

    // High frequency splatter drops on foliage/surfaces (white noise bandpass)
    const source2 = audioCtx.createBufferSource();
    source2.buffer = getWhiteNoiseBuffer();
    source2.loop = true;
    
    const filter2 = audioCtx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.value = 4500;
    filter2.Q.value = 1.0;

    const gain2 = audioCtx.createGain();
    gain2.gain.value = 0.035;

    source2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(masterGain);
    source2.start();

    // Random pitter-patter droplet peaks scheduled
    const intervalId = setInterval(() => {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      if (Math.random() > 0.35) {
        const t = audioCtx.currentTime;
        const dur = 0.04 + Math.random() * 0.06;
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000 + Math.random() * 2500, t);
        osc.frequency.exponentialRampToValueAtTime(1000 + Math.random() * 500, t + dur);
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.005 + Math.random() * 0.007, t);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        
        osc.connect(gainNode);
        gainNode.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }, 150);

    activeSounds.rain = { 
      source1, 
      gain1, 
      filter1,
      source2,
      gain2,
      filter2,
      interval: intervalId,
      stop: () => {
        try { source1.stop(); } catch(e){}
        try { source1.disconnect(); } catch(e){}
        try { filter1.disconnect(); } catch(e){}
        try { gain1.disconnect(); } catch(e){}
        try { source2.stop(); } catch(e){}
        try { source2.disconnect(); } catch(e){}
        try { filter2.disconnect(); } catch(e){}
        try { gain2.disconnect(); } catch(e){}
        clearInterval(intervalId);
      }
    };
  } 
  else if (type === 'fire') {
    // 1. Deep rumble base flame
    const rumbleSource = audioCtx.createBufferSource();
    rumbleSource.buffer = getPinkNoiseBuffer();
    rumbleSource.loop = true;

    const rumbleFilter = audioCtx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 150;

    const rumbleGain = audioCtx.createGain();
    rumbleGain.gain.value = 0.35;

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(masterGain);
    rumbleSource.start();

    // 2. Scheduled crackling pops & thumps
    const intervalId = setInterval(() => {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      if (Math.random() > 0.45) {
        const t = audioCtx.currentTime;
        const dur = 0.01 + Math.random() * 0.02;
        
        // Crisp high snap click
        const crackleBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
        const data = crackleBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i / data.length), 4);
        }
        const popSource = audioCtx.createBufferSource();
        popSource.buffer = crackleBuffer;
        
        const popFilter = audioCtx.createBiquadFilter();
        popFilter.type = 'bandpass';
        popFilter.frequency.value = 2500 + Math.random() * 2500;
        popFilter.Q.value = 2.0;
        
        const popGain = audioCtx.createGain();
        popGain.gain.setValueAtTime(0.04 + Math.random() * 0.05, t);
        popGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        
        popSource.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(masterGain);
        popSource.start(t);
        
        // Deep log pop thump (sub-bass pop resonance)
        if (Math.random() > 0.6) {
          const oscThump = audioCtx.createOscillator();
          oscThump.type = 'triangle';
          oscThump.frequency.setValueAtTime(80 + Math.random() * 60, t);
          oscThump.frequency.exponentialRampToValueAtTime(30, t + 0.08);
          
          const thumpGain = audioCtx.createGain();
          thumpGain.gain.setValueAtTime(0.12, t);
          thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          
          oscThump.connect(thumpGain);
          thumpGain.connect(masterGain);
          oscThump.start(t);
          oscThump.stop(t + 0.1);
        }
      }
    }, 150);

    activeSounds.fire = {
      source: rumbleSource,
      gain: rumbleGain,
      filter: rumbleFilter,
      interval: intervalId,
      stop: () => {
        try { rumbleSource.stop(); } catch(e){}
        try { rumbleSource.disconnect(); } catch(e){}
        try { rumbleFilter.disconnect(); } catch(e){}
        try { rumbleGain.disconnect(); } catch(e){}
        clearInterval(intervalId);
      }
    };
  } 
  else if (type === 'waves') {
    // Immersive 3D stereo panning waves
    const sourceL = audioCtx.createBufferSource();
    sourceL.buffer = getPinkNoiseBuffer();
    sourceL.loop = true;
    
    const filterL = audioCtx.createBiquadFilter();
    filterL.type = 'lowpass';
    filterL.frequency.value = 350;
    
    const gainL = audioCtx.createGain();
    gainL.gain.setValueAtTime(0.02, audioCtx.currentTime);
    
    const pannerL = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    if (pannerL) pannerL.pan.value = -0.7;

    sourceL.connect(filterL);
    filterL.connect(gainL);
    if (pannerL) {
      gainL.connect(pannerL);
      pannerL.connect(masterGain);
    } else {
      gainL.connect(masterGain);
    }
    sourceL.start();

    const sourceR = audioCtx.createBufferSource();
    sourceR.buffer = getPinkNoiseBuffer();
    sourceR.loop = true;
    
    const filterR = audioCtx.createBiquadFilter();
    filterR.type = 'lowpass';
    filterR.frequency.value = 380;
    
    const gainR = audioCtx.createGain();
    gainR.gain.setValueAtTime(0.02, audioCtx.currentTime);
    
    const pannerR = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    if (pannerR) pannerR.pan.value = 0.7;

    sourceR.connect(filterR);
    filterR.connect(gainR);
    if (pannerR) {
      gainR.connect(pannerR);
      pannerR.connect(masterGain);
    } else {
      gainR.connect(masterGain);
    }
    sourceR.start();

    // Wave swell automation intervals (panned slightly out of phase for rolling effect)
    const waveTimerL = setInterval(() => {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;
      gainL.gain.linearRampToValueAtTime(0.14, t + 4.2);
      gainL.gain.linearRampToValueAtTime(0.02, t + 8.5);
    }, 8500);

    const waveTimerR = setInterval(() => {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;
      gainR.gain.linearRampToValueAtTime(0.14, t + 4.6);
      gainR.gain.linearRampToValueAtTime(0.02, t + 9.2);
    }, 9200);

    // Initial automations
    const t = audioCtx.currentTime;
    gainL.gain.linearRampToValueAtTime(0.14, t + 4.2);
    gainL.gain.linearRampToValueAtTime(0.02, t + 8.5);
    gainR.gain.linearRampToValueAtTime(0.14, t + 4.6);
    gainR.gain.linearRampToValueAtTime(0.02, t + 9.2);

    activeSounds.waves = {
      sourceL,
      gainL,
      filterL,
      pannerL,
      sourceR,
      gainR,
      filterR,
      pannerR,
      intervalL: waveTimerL,
      intervalR: waveTimerR,
      stop: () => {
        try { sourceL.stop(); } catch(e){}
        try { sourceL.disconnect(); } catch(e){}
        try { filterL.disconnect(); } catch(e){}
        try { gainL.disconnect(); } catch(e){}
        try { pannerL.disconnect(); } catch(e){}
        try { sourceR.stop(); } catch(e){}
        try { sourceR.disconnect(); } catch(e){}
        try { filterR.disconnect(); } catch(e){}
        try { gainR.disconnect(); } catch(e){}
        try { pannerR.disconnect(); } catch(e){}
        clearInterval(waveTimerL);
        clearInterval(waveTimerR);
      }
    };
  } 
  else if (type === 'brown') {
    const source = audioCtx.createBufferSource();
    source.buffer = getBrownNoiseBuffer();
    source.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.35;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();

    activeSounds.brown = { 
      source, 
      gain, 
      filter,
      stop: () => {
        try { source.stop(); } catch(e){}
        try { source.disconnect(); } catch(e){}
        try { filter.disconnect(); } catch(e){}
        try { gain.disconnect(); } catch(e){}
      }
    };
  }
}

function stopSound(type) {
  if (activeSounds[type]) {
    if (activeSounds[type].stop) {
      activeSounds[type].stop();
    }
    delete activeSounds[type];
  }
}

// Applies a soft blur to the wallpaper. A subtle scale-up rides along with
// it, since a blurred background-size:cover element would otherwise show
// faint blurred edges at the viewport border.
function applyBackgroundBlur(px) {
  const bg = document.getElementById('sanctuary-bg');
  if (!bg) return;
  const amount = Math.max(0, Math.min(20, px));
  bg.style.filter = amount > 0 ? `blur(${amount}px)` : 'none';
  bg.style.transform = amount > 0 ? `scale(${1 + amount / 100})` : 'scale(1)';
}

// --- 2. Wallpaper & Vibe Rendering ---
async function updateUI() {
  const result = await chrome.storage.local.get([
    'cachedImage', 
    'currentWallpaper', 
    'currentMeta', 
    'favoriteWallpapers',
    'dimmerVal',
    'bgBlurVal',
    'userName',
    'toggleClock',
    'toggle12h',
    'toggleGreeting',
    'toggleFocus',
    'toggleSearch',
    'toggleCycleFavorites'
  ]);
  
  const targetImage = result.cachedImage || result.currentWallpaper;

  if (targetImage) {
    const bg = document.getElementById('sanctuary-bg');
    const img = new Image();
    img.onload = () => {
      bg.style.backgroundImage = `url("${targetImage}")`;
      bg.style.opacity = 1;
    };
    img.onerror = () => {
      console.error('Failed to load wallpaper');
      bg.style.backgroundColor = '#12100e';
      bg.style.opacity = 1;
    };
    img.src = targetImage;
  }

  // Load wallpaper metadata
  if (result.currentMeta) {
    currentMeta = result.currentMeta;
    document.getElementById('wallpaper-name').innerText = currentMeta.name.replace(/\.[^/.]+$/, '');
    
    // Check favorite status
    const favorites = result.favoriteWallpapers || [];
    const isFavorited = favorites.some(fav => fav.name === currentMeta.name);
    updateFavoriteBtnUI(isFavorited);
  }

  // Apply visual configurations
  const dimmerOpacity = result.dimmerVal !== undefined ? result.dimmerVal : 20;
  document.getElementById('bg-dimmer-overlay').style.opacity = dimmerOpacity / 100;
  document.getElementById('dimmer-slider').value = dimmerOpacity;
  document.getElementById('dimmer-value').innerText = `${dimmerOpacity}%`;

  const bgBlur = result.bgBlurVal !== undefined ? result.bgBlurVal : 0;
  applyBackgroundBlur(bgBlur);
  document.getElementById('blur-slider').value = bgBlur;
  document.getElementById('blur-value').innerText = `${bgBlur}px`;

  // Apply toggle show/hide states
  toggleElementVisibility('clock-widget', result.toggleClock !== false);
  toggleElementVisibility('greeting-widget', result.toggleGreeting !== false);
  toggleElementVisibility('focus-widget', result.toggleFocus !== false);
  toggleElementVisibility('search-widget', result.toggleSearch !== false);
  
  // Set checklist states in panel
  document.getElementById('toggle-clock').checked = result.toggleClock !== false;
  document.getElementById('toggle-12h').checked = result.toggle12h !== false;
  document.getElementById('toggle-greeting').checked = result.toggleGreeting !== false;
  document.getElementById('toggle-focus').checked = result.toggleFocus !== false;
  document.getElementById('toggle-search').checked = result.toggleSearch !== false;
  document.getElementById('toggle-cycle-favorites').checked = result.toggleCycleFavorites === true;

  // Show or hide the 12-Hour format setting based on Clock visibility
  toggleElementVisibility('clock-format-row', result.toggleClock !== false);

  // Load Personalized greeting / username
  const name = result.userName || '';
  document.getElementById('settings-username').value = name;

  updateClock();
  updateGreeting(name);
}

function toggleElementVisibility(elementId, isVisible) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.display = isVisible ? '' : 'none';
  }
}

// --- 3. Clock & Greeting ---
const COZY_QUOTES = [
  // Anime
  { text: "If you don't like your destiny, don't accept it. Instead have the courage to change it.", author: "Naruto Uzumaki" },
  { text: "It's not that if you become Hokage, everyone will accept you. It's only when everyone accepts you that you can become Hokage.", author: "Itachi Uchiha" },
  { text: "Whatever you lose, you'll find it again. But what you throw away you'll never get back.", author: "Kenshin Himura" },
  { text: "Thinking you're no good and worthless is the worst thing you can do.", author: "Nobita (Doraemon)" },
  { text: "The moment you think of giving up, think of the reason why you held on so long.", author: "Natsu Dragneel" },
  { text: "No matter how challenging or sad things are, people should appreciate what it means to be alive.", author: "Yato (Noragami)" },
  { text: "If you want to make people dream, you've got to start by believing in that dream yourself!", author: "Seiji Amasawa (Whisper of the Heart)" },
  { text: "It's a quiet evening... a perfect time to reflect on the beauty of doing nothing.", author: "Kyoto Animation" },
  
  // Great Minds
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", author: "Rumi" },
  { text: "Peace comes from within. Do not seek it without.", author: "Siddhartha Gautama" },
  { text: "Be master of mind rather than mastered by mind.", author: "Zen Saying" },
  
  // Literature / Books
  { text: "All we have to decide is what to do with the time that is given us.", author: "J.R.R. Tolkien" },
  { text: "It is only with the heart that one can see rightly; what is essential is invisible to the eye.", author: "Antoine de Saint-Exupéry" },
  { text: "Even the darkest night will end and the sun will rise.", author: "Victor Hugo" },
  { text: "If you only read the books that everyone else is reading, you can only think what everyone else is thinking.", author: "Haruki Murakami" },
  { text: "Whatever it is you're seeking won't come in the form you're expecting.", author: "Haruki Murakami" }
];

async function fetchQuote() {
  const quoteTextEl = document.getElementById('quote-text');
  const quoteAuthorEl = document.getElementById('quote-author');
  if (!quoteTextEl) return;

  // Immediately display fallback quote for instant load
  const fallback = COZY_QUOTES[Math.floor(Math.random() * COZY_QUOTES.length)];
  quoteTextEl.innerText = `"${fallback.text}"`;
  quoteAuthorEl.innerText = `— ${fallback.author}`;

  // Attempt to fetch from public API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('https://animechan.xyz/api/random', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.quote && data.character) {
        quoteTextEl.innerText = `"${data.quote}"`;
        quoteAuthorEl.innerText = `— ${data.character} (${data.anime})`;
      }
    }
  } catch (err) {
    console.log('Using offline fallback quote.');
  }
}

function updateClock() {
  const clockEl = document.getElementById('clock');
  const ampmEl = document.getElementById('clock-ampm');
  if (!clockEl) return;

  chrome.storage.local.get(['toggle12h'], (result) => {
    const is12h = result.toggle12h !== false;
    const now = new Date();
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    let ampm = '';

    if (is12h) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      hours = String(hours).padStart(2, '0');
      ampmEl.innerText = ampm;
      ampmEl.style.display = '';
    } else {
      hours = String(hours).padStart(2, '0');
      ampmEl.innerText = '';
      ampmEl.style.display = 'none';
    }

    clockEl.innerText = `${hours}:${minutes}`;
  });
}

function updateGreeting(name = '') {
  const greetingEl = document.getElementById('greeting');
  if (!greetingEl) return;

  const now = new Date();
  const hour = now.getHours();
  let timeGreeting = "Breathe in, breathe out.";

  if (hour >= 5 && hour < 12) {
    timeGreeting = "Good morning";
  } else if (hour >= 12 && hour < 17) {
    timeGreeting = "Good afternoon";
  } else if (hour >= 17 && hour < 22) {
    timeGreeting = "Good evening";
  } else {
    timeGreeting = "Good night";
  }

  const prefix = name ? `${timeGreeting}, ${name}.` : `${timeGreeting}.`;
  greetingEl.innerText = prefix;
}

// --- 4. Daily Focus Goal Widget ---
function setupFocusGoal() {
  const setupContainer = document.getElementById('focus-setup-container');
  const displayContainer = document.getElementById('focus-display-container');
  const focusInput = document.getElementById('focus-input');
  const focusText = document.getElementById('focus-text');
  const focusCheckbox = document.getElementById('focus-checkbox');
  const focusClearBtn = document.getElementById('focus-clear-btn');

  // Load existing goal from local storage
  chrome.storage.local.get(['focusGoal', 'focusCompleted'], (result) => {
    if (result.focusGoal) {
      focusText.innerText = result.focusGoal;
      focusCheckbox.checked = result.focusCompleted === true;
      setupContainer.style.display = 'none';
      displayContainer.style.display = 'flex';
    } else {
      setupContainer.style.display = 'block';
      displayContainer.style.display = 'none';
    }
  });

  // Submit new goal
  focusInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && focusInput.value.trim() !== '') {
      const goal = focusInput.value.trim();
      chrome.storage.local.set({ 
        focusGoal: goal, 
        focusCompleted: false,
        focusRewarded: false 
      }, () => {
        focusText.innerText = goal;
        focusCheckbox.checked = false;
        setupContainer.style.display = 'none';
        displayContainer.style.display = 'flex';
        focusInput.value = '';
      });
    }
  });

  // Toggle goal completion
  focusCheckbox.addEventListener('change', () => {
    const isCompleted = focusCheckbox.checked;
    chrome.storage.local.set({ focusCompleted: isCompleted });
    if (isCompleted) {
      chrome.storage.local.get(['focusRewarded'], (result) => {
        if (!result.focusRewarded) {
          chrome.storage.local.set({ focusRewarded: true }, () => {
            incrementPlantGrowth(10);
          });
        }
      });
    }
  });

  // Clear goal
  focusClearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['focusGoal', 'focusCompleted', 'focusRewarded'], () => {
      setupContainer.style.display = 'block';
      displayContainer.style.display = 'none';
      focusInput.focus();
    });
  });
}

// --- 5. Wallpaper Info Actions (Skip, Favorite, Download) ---
function setupWallpaperActions() {
  const nextBtn = document.getElementById('next-vibe-btn');
  const faveBtn = document.getElementById('favorite-vibe-btn');
  const dlBtn = document.getElementById('download-vibe-btn');

  // Next Random Vibe
  nextBtn.addEventListener('click', () => {
    nextBtn.disabled = true;
    // Add micro-rotation anim
    nextBtn.style.transform = 'rotate(180deg)';
    
    chrome.runtime.sendMessage({ action: "triggerRotation" }, (response) => {
      setTimeout(() => {
        nextBtn.disabled = false;
        nextBtn.style.transform = '';
      }, 1000);
    });
  });

  // Toggle Favorite
  faveBtn.addEventListener('click', () => {
    if (!currentMeta) return;

    chrome.storage.local.get(['favoriteWallpapers'], (result) => {
      let favorites = result.favoriteWallpapers || [];
      const index = favorites.findIndex(fav => fav.name === currentMeta.name);

      let isFavoritedNow = false;
      if (index === -1) {
        // Add to favorites
        favorites.push(currentMeta);
        isFavoritedNow = true;
      } else {
        // Remove from favorites
        favorites.splice(index, 1);
        isFavoritedNow = false;
      }

      chrome.storage.local.set({ favoriteWallpapers: favorites }, () => {
        updateFavoriteBtnUI(isFavoritedNow);
      });
    });
  });

  // Download Wallpaper (Fetches blob to bypass browser image display behavior)
  dlBtn.addEventListener('click', async () => {
    dlBtn.disabled = true;
    dlBtn.style.opacity = '0.5';

    try {
      const result = await chrome.storage.local.get(['cachedImage', 'currentWallpaper']);
      const imageUrl = result.cachedImage || result.currentWallpaper;
      if (!imageUrl) return;

      let filename = currentMeta ? currentMeta.name : 'cozy-sanctuary.gif';
      let downloadUrl = imageUrl;

      // If it's a web URL, convert to Blob objectURL first to force download
      if (imageUrl.startsWith('http')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (imageUrl.startsWith('http')) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    } catch (err) {
      console.error('Failed to download wallpaper', err);
    } finally {
      dlBtn.disabled = false;
      dlBtn.style.opacity = '';
    }
  });
}

function updateFavoriteBtnUI(isFavorited) {
  const faveBtn = document.getElementById('favorite-vibe-btn');
  const outlineHeart = faveBtn.querySelector('.heart-outline');
  const filledHeart = faveBtn.querySelector('.heart-filled');

  if (isFavorited) {
    outlineHeart.style.display = 'none';
    filledHeart.style.display = '';
    faveBtn.classList.add('active');
  } else {
    outlineHeart.style.display = '';
    filledHeart.style.display = 'none';
    faveBtn.classList.remove('active');
  }
}

// --- 6. Soundscape Popover Logic ---
function setupSoundscapePopover() {
  const toggleBtn = document.getElementById('soundscape-toggle-btn');
  const popover = document.getElementById('soundscape-popover');
  const volumeSlider = document.getElementById('soundscape-volume');
  const options = document.querySelectorAll('.soundscape-option');

  // Toggle popover display
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close other panels to avoid overlapping
    const zenPopover = document.getElementById('zen-garden-popover');
    if (zenPopover) zenPopover.classList.remove('active');
    const settingsDrawer = document.getElementById('settings-drawer');
    if (settingsDrawer) settingsDrawer.classList.remove('open');
    
    popover.classList.toggle('active');
  });

  // Close popover if clicking outside
  document.addEventListener('click', (e) => {
    if (popover.classList.contains('active') && !popover.contains(e.target) && e.target !== toggleBtn) {
      popover.classList.remove('active');
    }
  });

  // Soundscape volume control
  volumeSlider.addEventListener('input', (e) => {
    currentVolume = parseFloat(e.target.value);
    if (masterGain) {
      masterGain.gain.value = currentVolume;
    }
    
    // Mute/unmute icon toggle
    const speakerIcon = toggleBtn.querySelector('.icon-speaker');
    const muteIcon = toggleBtn.querySelector('.icon-mute');
    if (currentVolume === 0) {
      speakerIcon.style.display = 'none';
      muteIcon.style.display = '';
    } else {
      speakerIcon.style.display = '';
      muteIcon.style.display = 'none';
    }
  });

  // Play/Pause individual ambient tracks
  options.forEach(option => {
    const soundType = option.dataset.sound;
    const playBtn = option.querySelector('.sound-play-btn');

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();

      const isActive = option.classList.contains('active');
      
      if (isActive) {
        // Stop sound
        stopSound(soundType);
        option.classList.remove('active');
        playBtn.innerText = 'Play';
      } else {
        // Start sound
        startSound(soundType);
        option.classList.add('active');
        playBtn.innerText = 'Mute';
      }

      // Check if any sound is running, otherwise suspend context to save CPU
      updateVolumeStateUI();
    });
  });
}

function updateVolumeStateUI() {
  const toggleBtn = document.getElementById('soundscape-toggle-btn');
  const hasActiveSounds = Object.keys(activeSounds).length > 0;
  
  if (hasActiveSounds) {
    toggleBtn.classList.add('active');
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } else {
    toggleBtn.classList.remove('active');
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend();
    }
  }
}

// --- 7. Settings Slide-out Drawer ---
function setupSettingsDrawer() {
  const toggleBtn = document.getElementById('settings-toggle-btn');
  const drawer = document.getElementById('settings-drawer');
  const closeBtn = document.getElementById('drawer-close-btn');

  // Toggle drawer slide-in/out
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close other panels to avoid overlapping
    const soundPopover = document.getElementById('soundscape-popover');
    if (soundPopover) soundPopover.classList.remove('active');
    const zenPopover = document.getElementById('zen-garden-popover');
    if (zenPopover) zenPopover.classList.remove('active');
    
    drawer.classList.toggle('open');
  });

  closeBtn.addEventListener('click', () => {
    drawer.classList.remove('open');
  });

  // Close drawer if clicking outside
  document.addEventListener('click', (e) => {
    if (drawer.classList.contains('open') && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
      drawer.classList.remove('open');
    }
  });

  // Hook settings UI inputs
  const usernameInput = document.getElementById('settings-username');
  const clockCheck = document.getElementById('toggle-clock');
  const formatCheck = document.getElementById('toggle-12h');
  const greetingCheck = document.getElementById('toggle-greeting');
  const focusCheck = document.getElementById('toggle-focus');
  const searchCheck = document.getElementById('toggle-search');
  const dimmerSlider = document.getElementById('dimmer-slider');
  const dimmerValText = document.getElementById('dimmer-value');
  const blurSlider = document.getElementById('blur-slider');
  const blurValText = document.getElementById('blur-value');
  const cycleFavoritesCheck = document.getElementById('toggle-cycle-favorites');

  // Username Change
  usernameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    chrome.storage.local.set({ userName: val }, () => {
      updateGreeting(val);
    });
  });

  // Toggles listeners
  clockCheck.addEventListener('change', () => {
    const val = clockCheck.checked;
    chrome.storage.local.set({ toggleClock: val }, () => {
      toggleElementVisibility('clock-widget', val);
      toggleElementVisibility('clock-format-row', val);
    });
  });

  formatCheck.addEventListener('change', () => {
    chrome.storage.local.set({ toggle12h: formatCheck.checked }, () => {
      updateClock();
    });
  });

  greetingCheck.addEventListener('change', () => {
    const val = greetingCheck.checked;
    chrome.storage.local.set({ toggleGreeting: val }, () => {
      toggleElementVisibility('greeting-widget', val);
    });
  });

  focusCheck.addEventListener('change', () => {
    const val = focusCheck.checked;
    chrome.storage.local.set({ toggleFocus: val }, () => {
      toggleElementVisibility('focus-widget', val);
    });
  });

  searchCheck.addEventListener('change', () => {
    const val = searchCheck.checked;
    chrome.storage.local.set({ toggleSearch: val }, () => {
      toggleElementVisibility('search-widget', val);
    });
  });

  dimmerSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    chrome.storage.local.set({ dimmerVal: val }, () => {
      document.getElementById('bg-dimmer-overlay').style.opacity = val / 100;
      dimmerValText.innerText = `${val}%`;
    });
  });

  blurSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    chrome.storage.local.set({ bgBlurVal: val }, () => {
      applyBackgroundBlur(val);
      blurValText.innerText = `${val}px`;
    });
  });

  cycleFavoritesCheck.addEventListener('change', () => {
    chrome.storage.local.set({ toggleCycleFavorites: cycleFavoritesCheck.checked });
  });
}

// --- 8. Zen Mode Helper ---
function setupCleanVibeMode() {
  const zenIndicator = document.getElementById('zen-indicator');
  let timer = null;

  function toggleZenMode() {
    document.body.classList.toggle('clean-vibe-mode');
    
    if (document.body.classList.contains('clean-vibe-mode')) {
      zenIndicator.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => {
        zenIndicator.classList.remove('show');
      }, 3000);
    } else {
      zenIndicator.classList.remove('show');
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleZenMode();
    }
  });

  document.addEventListener('dblclick', (e) => {
    if (
      e.target.id === 'sanctuary-bg' || 
      e.target.id === 'bg-dimmer-overlay' || 
      e.target.classList.contains('overlay') ||
      e.target.classList.contains('center-content')
    ) {
      toggleZenMode();
    }
  });
}

function setupZenGarden() {
  const toggleBtn = document.getElementById('zen-garden-toggle-btn');
  const popover = document.getElementById('zen-garden-popover');
  const waterBtn = document.getElementById('water-plant-btn');
  const cooldownLabel = document.getElementById('water-cooldown-label');
  const svgContainer = document.getElementById('plant-svg-container');
  const progressFill = document.getElementById('plant-progress-fill');
  const growthPercent = document.getElementById('plant-growth-percent');
  const stageLabel = document.getElementById('plant-stage-label');

  let cooldownTimer = null;

  // Toggle popover display
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close other panels to avoid overlapping
    const soundPopover = document.getElementById('soundscape-popover');
    if (soundPopover) soundPopover.classList.remove('active');
    const settingsDrawer = document.getElementById('settings-drawer');
    if (settingsDrawer) settingsDrawer.classList.remove('open');
    
    popover.classList.toggle('active');
    if (popover.classList.contains('active')) {
      updatePlantUI();
    }
  });

  // Close popover if clicking outside
  document.addEventListener('click', (e) => {
    if (popover.classList.contains('active') && !popover.contains(e.target) && e.target !== toggleBtn) {
      popover.classList.remove('active');
    }
  });

  // Update Plant visuals & stats
  function updatePlantUI() {
    chrome.storage.local.get(['plantGrowth', 'lastWateredTime'], (result) => {
      const now = Date.now();
      const hasLastWatered = result.lastWateredTime !== undefined;

      let health = 'healthy';
      let growth = result.plantGrowth || 0;
      let elapsedHours = 0;

      if (hasLastWatered) {
        const lastWatered = result.lastWateredTime;
        elapsedHours = (now - lastWatered) / (1000 * 60 * 60);

        if (elapsedHours >= 72) { // 3 Days neglect = dead
          health = 'dead';
          growth = 0;
        } else if (elapsedHours >= 36) { // 1.5 Days neglect = withered
          health = 'withered';
          // Lose 1.5% growth per hour of neglect after 36 hours
          const neglectHours = elapsedHours - 36;
          const loss = Math.floor(neglectHours * 1.5);
          growth = Math.max(0, growth - loss);
        }
      }

      // Save updated growth back to local storage if it changed dynamically
      if (growth !== result.plantGrowth) {
        chrome.storage.local.set({ plantGrowth: growth });
      }

      // Update progress bar & label
      progressFill.style.width = `${growth}%`;
      growthPercent.innerText = `${growth}%`;

      // Determine stage label & badge background
      let stageName = 'Seedling';
      if (health === 'dead') {
        stageName = 'Dead Twig';
        stageLabel.style.background = '#2d2424'; // Dark charcoal brown
      } else if (health === 'withered') {
        stageName = 'Dry / Dying';
        stageLabel.style.background = '#d4a373'; // Withered yellow/beige
      } else {
        if (growth >= 75) {
          stageName = 'Blooming Sakura';
          stageLabel.style.background = '#e86f88'; // Pink
        } else if (growth >= 50) {
          stageName = 'Bonsai Tree';
          stageLabel.style.background = '#50b386'; // Green
        } else if (growth >= 25) {
          stageName = 'Sapling';
          stageLabel.style.background = '#7ca8e6'; // Blue
        } else {
          stageName = 'Sprout';
          stageLabel.style.background = '#a3a3a3'; // Grey
        }
      }
      stageLabel.innerText = stageName;

      // Render SVG plant
      svgContainer.innerHTML = getPlantSVG(growth, health);

      // Water Button Text & Action Setup
      const waterBtnText = waterBtn.querySelector('span');

      if (health === 'dead') {
        waterBtn.disabled = false;
        waterBtnText.innerText = 'Replant Seed';
        cooldownLabel.innerText = 'Neglected for 3+ days';
      } else if (health === 'withered') {
        waterBtn.disabled = false;
        waterBtnText.innerText = 'Water & Revive';
        cooldownLabel.innerText = 'Needs water urgently!';
      } else {
        waterBtnText.innerText = 'Water (+5)';
        
        if (!hasLastWatered) {
          waterBtn.disabled = false;
          cooldownLabel.innerText = 'Ready to water';
        } else {
          // Cooldown: 12 Hours
          const cooldownMs = 12 * 60 * 60 * 1000;
          const elapsed = now - result.lastWateredTime;

          if (elapsed < cooldownMs) {
            waterBtn.disabled = true;
            startCooldownCountdown(cooldownMs - elapsed);
          } else {
            waterBtn.disabled = false;
            cooldownLabel.innerText = 'Ready to water';
          }
        }
      }
    });
  }

  function startCooldownCountdown(remainingMs) {
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        clearInterval(cooldownTimer);
        waterBtn.disabled = false;
        cooldownLabel.innerText = 'Ready to water';
      } else {
        cooldownLabel.innerText = getCooldownString(remainingMs);
      }
    }, 1000);
    cooldownLabel.innerText = getCooldownString(remainingMs);
  }

  function getCooldownString(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `Cooldown: ${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `Cooldown: ${minutes}m ${seconds}s`;
    } else {
      return `Cooldown: ${seconds}s`;
    }
  }

  // Water / Replant / Revive action
  waterBtn.addEventListener('click', () => {
    waterBtn.disabled = true;
    const now = Date.now();
    
    chrome.storage.local.get(['plantGrowth', 'lastWateredTime'], (result) => {
      const hasLastWatered = result.lastWateredTime !== undefined;
      const cooldownMs = 12 * 60 * 60 * 1000;
      
      if (hasLastWatered) {
        const lastWatered = result.lastWateredTime;
        const elapsedHours = (now - lastWatered) / (1000 * 60 * 60);
        
        if (elapsedHours >= 72) {
          // REPLANT ACTION (Resets growth and sets last watered time to now)
          chrome.storage.local.set({ 
            plantGrowth: 0, 
            lastWateredTime: now 
          }, () => {
            playReplantSound();
            updatePlantUI();
          });
        } else if (elapsedHours >= 36) {
          // REVIVE ACTION (Keeps current neglected growth, sets watered time to now)
          chrome.storage.local.set({ 
            lastWateredTime: now 
          }, () => {
            playWaterDropletSound();
            updatePlantUI();
          });
        } else {
          // Check cooldown to prevent multiple quick waterings (e.g. key/click spam)
          const elapsedMs = now - lastWatered;
          if (elapsedMs < cooldownMs) {
            console.log("Watering on cooldown");
            updatePlantUI();
            return;
          }
          
          // STANDARD WATER ACTION (+5 growth, sets watered time to now)
          chrome.storage.local.set({ lastWateredTime: now }, () => {
            incrementPlantGrowth(5);
          });
        }
      } else {
        // FIRST WATERING EVER
        chrome.storage.local.set({ lastWateredTime: now }, () => {
          incrementPlantGrowth(5);
        });
      }
    });
  });

  // Initialize UI on popover load
  updatePlantUI();
}

function incrementPlantGrowth(amount) {
  chrome.storage.local.get(['plantGrowth'], (result) => {
    let currentGrowth = result.plantGrowth || 0;
    let newGrowth = Math.min(100, currentGrowth + amount);
    
    chrome.storage.local.set({ plantGrowth: newGrowth }, () => {
      // Play satisfying bubble droplet synthesised sound
      playWaterDropletSound();
      
      // Refresh Zen Garden UI if active
      const popover = document.getElementById('zen-garden-popover');
      if (popover && popover.classList.contains('active')) {
        updatePlantUI();
      }
    });
  });
}

function playWaterDropletSound() {
  try {
    initAudio();
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;

    // 1. Initial splash impact click (filtered noise burst)
    const bufferSize = audioCtx.sampleRate * 0.012; // 12ms
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(6000, now);
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.05, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.012);

    // 2. Primary water bubble resonance ("bloop")
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(450, now);
    osc1.frequency.exponentialRampToValueAtTime(1150, now + 0.08);
    
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.13);

    // 3. Secondary echo ripple (slightly delayed)
    const delayTime = 0.05; // 50ms delay
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(650, now + delayTime);
    osc2.frequency.exponentialRampToValueAtTime(1350, now + delayTime + 0.06);
    
    gain2.gain.setValueAtTime(0.08, now + delayTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + delayTime + 0.09);
    
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc2.start(now + delayTime);
    osc2.stop(now + delayTime + 0.1);

  } catch(err) {
    console.error('Audio droplet sound failed:', err);
  }
}

function playReplantSound() {
  try {
    initAudio();
    if (!audioCtx) return;
    
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, audioCtx.currentTime + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.22);
    osc2.stop(audioCtx.currentTime + 0.22);
  } catch(err) {
    console.error('Audio replant sound failed:', err);
  }
}

function getPlantSVG(growth, health = 'healthy') {
  // Detailed 3D Terracotta Pot and soil base
  const potSVG = `
    <!-- Soil -->
    <ellipse cx="32" cy="46" rx="14" ry="4.5" fill="#5c4033" stroke="#2d2424" stroke-width="1.5" />
    
    <!-- Pot Body (underneath top rim) -->
    <path d="M 19 49 L 23 58 L 41 58 L 45 49 Z" fill="#c68469" stroke="#2d2424" stroke-width="1.8" stroke-linejoin="round" />
    
    <!-- Pot Rim -->
    <path d="M 17 46 L 47 46 L 45 49 L 19 49 Z" fill="#b06d50" stroke="#2d2424" stroke-width="1.8" stroke-linejoin="round" />
    
    <!-- Inner Pot Shadow -->
    <path d="M 23 58 C 32 60, 32 60, 41 58 C 43 49, 43 49, 45 49 C 32 51, 32 51, 19 49 Z" fill="#a05d40" opacity="0.3" pointer-events="none" />
    
    <!-- Pot Light Highlight reflection -->
    <path d="M 21 50 L 24 57" stroke="#ffa485" stroke-width="1.2" stroke-linecap="round" pointer-events="none" />
  `;

  if (health === 'dead') {
    if (growth < 25) {
      return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                ${potSVG}
                <!-- Dead sprout twig -->
                <path d="M 32 46 Q 32 37, 28 32 Q 26 28, 30 26" fill="none" stroke="#6b5e54" stroke-width="2.5" stroke-linecap="round" />
              </svg>`;
    } else if (growth < 50) {
      return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                ${potSVG}
                <!-- Dead sapling twigs -->
                <path d="M 32 46 C 32 38, 30 32, 28 28 C 26 24, 28 20, 31 18" fill="none" stroke="#6b5e54" stroke-width="3.8" stroke-linecap="round" />
                <path d="M 29 34 Q 35 32, 38 28" fill="none" stroke="#6b5e54" stroke-width="2.5" stroke-linecap="round" />
              </svg>`;
    } else {
      return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                ${potSVG}
                <!-- Dead bonsai twigs -->
                <path d="M 32 46 C 32 35, 26 28, 24 22 C 22 16, 25 12, 29 10" fill="none" stroke="#6b5e54" stroke-width="5.5" stroke-linecap="round" />
                <path d="M 31 46 C 31 36, 25 29, 23 23 C 21 17, 24 13, 28 11" fill="none" stroke="#524841" stroke-width="1.8" stroke-linecap="round" />
                <path d="M 28 32 Q 37 29, 39 22" fill="none" stroke="#6b5e54" stroke-width="3.5" stroke-linecap="round" />
              </svg>`;
    }
  }

  if (growth < 25) {
    // Sprout
    const stemCol = health === 'withered' ? '#827a68' : '#77b03b';
    const leaf1Col = health === 'withered' ? '#a49b6b' : '#8bc34a';
    const leaf1Stroke = health === 'withered' ? '#625c40' : '#4f7a28';
    const leaf2Col = health === 'withered' ? '#c2b78b' : '#a0d468';
    const dewdropOpacity = health === 'withered' ? '0' : '0.9';

    return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              ${potSVG}
              <path d="M 32 46 Q 32 37, 28 32 Q 26 28, 30 26" fill="none" stroke="${stemCol}" stroke-width="2.5" stroke-linecap="round" />
              <path d="M 28 32 C 24 32, 23 27, 27 26 C 29 26, 29 29, 28 32 Z" fill="${leaf1Col}" stroke="${leaf1Stroke}" stroke-width="1" />
              <path d="M 30 26 C 33 24, 37 23, 35 28 C 33 30, 31 28, 30 26 Z" fill="${leaf2Col}" stroke="${leaf1Stroke}" stroke-width="1" />
              <circle cx="25" cy="27" r="1.2" fill="#e0f7fa" opacity="${dewdropOpacity}" />
            </svg>`;
  } else if (growth < 50) {
    // Sapling
    const trunkCol = health === 'withered' ? '#5a463b' : '#6e5040';
    const trunkShadow = health === 'withered' ? '#3d2f27' : '#4d3326';
    const leaf1 = health === 'withered' ? '#4a3d2b' : '#2d6a42';
    const leaf2 = health === 'withered' ? '#6d5f47' : '#4ea568';
    const leaf3 = health === 'withered' ? '#8b7a5a' : '#69c288';
    const leaf4 = health === 'withered' ? '#b8a278' : '#95d5b2';

    return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              ${potSVG}
              <path d="M 32 46 C 32 38, 30 32, 28 28 C 26 24, 28 20, 31 18" fill="none" stroke="${trunkCol}" stroke-width="3.8" stroke-linecap="round" />
              <path d="M 31.5 46 C 31.5 38, 29.5 32, 27.5 28" fill="none" stroke="${trunkShadow}" stroke-width="1.5" stroke-linecap="round" />
              <path d="M 29 34 Q 35 32, 38 28" fill="none" stroke="${trunkCol}" stroke-width="2.5" stroke-linecap="round" />
              
              <!-- Top Cluster -->
              <circle cx="31" cy="16" r="6.5" fill="${leaf1}" />
              <circle cx="28" cy="14" r="5" fill="${leaf2}" />
              <circle cx="33" cy="14" r="4.5" fill="${leaf3}" />
              <circle cx="30" cy="12" r="2.5" fill="${leaf4}" />
              
              <!-- Side Cluster -->
              <circle cx="38" cy="27" r="5" fill="${leaf1}" />
              <circle cx="37" cy="25" r="4" fill="${leaf2}" />
              <circle cx="40" cy="26" r="3" fill="${leaf3}" />
            </svg>`;
  } else if (growth < 75) {
    // Bonsai Tree
    const trunkCol = health === 'withered' ? '#5a463b' : '#6e5040';
    const trunkHighlight = health === 'withered' ? '#785e4f' : '#8b5a2b';
    const leafDark = health === 'withered' ? '#3d3224' : '#1b4332';
    const leafMid = health === 'withered' ? '#524330' : '#2d6a42';
    const leafLight = health === 'withered' ? '#6e5b41' : '#409b72';
    const leafGlow = health === 'withered' ? '#8b7553' : '#52b788';
    const leafBright = health === 'withered' ? '#a89066' : '#74c69d';

    return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              ${potSVG}
              <path d="M 32 46 C 32 35, 26 28, 24 22 C 22 16, 25 12, 29 10" fill="none" stroke="${trunkCol}" stroke-width="5.5" stroke-linecap="round" />
              <path d="M 31 46 C 31 36, 25 29, 23 23 C 21 17, 24 13, 28 11" fill="none" stroke="${trunkHighlight}" stroke-width="1.8" stroke-linecap="round" />
              <path d="M 28 32 Q 37 29, 39 22" fill="none" stroke="${trunkCol}" stroke-width="3.5" stroke-linecap="round" />
              <path d="M 29 32 Q 37 29, 39 22" fill="none" stroke="${trunkHighlight}" stroke-width="1.2" stroke-linecap="round" />
              
              <!-- Left Cluster -->
              <circle cx="28" cy="10" r="9.5" fill="${leafDark}" />
              <circle cx="25" cy="8" r="8" fill="${leafMid}" />
              <circle cx="31" cy="11" r="7" fill="${leafLight}" />
              <circle cx="28" cy="7" r="5" fill="${leafGlow}" />
              <circle cx="26" cy="9" r="2.5" fill="${leafBright}" />

              <!-- Right Cluster -->
              <circle cx="39" cy="22" r="7.5" fill="${leafDark}" />
              <circle cx="37" cy="20" r="6" fill="${leafMid}" />
              <circle cx="42" cy="22" r="5" fill="${leafLight}" />
              <circle cx="40" cy="19" r="3.5" fill="${leafGlow}" />
            </svg>`;
  } else {
    // Blooming Sakura Bonsai
    const trunkCol = health === 'withered' ? '#5a463b' : '#6e5040';
    const trunkHighlight = health === 'withered' ? '#785e4f' : '#8b5a2b';
    const leafDark = health === 'withered' ? '#782d3e' : '#c9184a';
    const leafMid = health === 'withered' ? '#9c3f54' : '#ff4d6d';
    const leafLight = health === 'withered' ? '#b85a6e' : '#ff758f';
    const leafGlow = health === 'withered' ? '#cc7889' : '#ff8fa3';
    const leafBright = health === 'withered' ? '#e69bb0' : '#ffb3c1';
    
    const blossomStroke = health === 'withered' ? '#db8b9a' : '#ffccd5';
    const petalCol1 = health === 'withered' ? '#e69bb0' : '#ffccd5';
    const petalCol2 = health === 'withered' ? '#b85a6e' : '#ff8fa3';

    return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              ${potSVG}
              <path d="M 32 46 C 32 35, 26 28, 24 22 C 22 16, 25 12, 29 10" fill="none" stroke="${trunkCol}" stroke-width="5.5" stroke-linecap="round" />
              <path d="M 31 46 C 31 36, 25 29, 23 23 C 21 17, 24 13, 28 11" fill="none" stroke="${trunkHighlight}" stroke-width="1.8" stroke-linecap="round" />
              <path d="M 28 32 Q 37 29, 39 22" fill="none" stroke="${trunkCol}" stroke-width="3.5" stroke-linecap="round" />
              
              <!-- Left Cluster -->
              <circle cx="28" cy="10" r="9.5" fill="${leafDark}" />
              <circle cx="25" cy="8" r="8" fill="${leafMid}" />
              <circle cx="31" cy="11" r="7" fill="${leafLight}" />
              <circle cx="28" cy="7" r="5" fill="${leafGlow}" />
              <circle cx="26" cy="9" r="3" fill="${leafBright}" />
              
              <!-- Left Blossoms -->
              <path d="M 23 6 L 27 6 M 25 4 L 25 8" stroke="${blossomStroke}" stroke-width="0.8" />
              <circle cx="25" cy="6" r="0.8" fill="#fff" />
              <path d="M 29 12 L 33 12 M 31 10 L 31 14" stroke="${blossomStroke}" stroke-width="0.8" />
              <circle cx="31" cy="12" r="0.8" fill="#fff" />

              <!-- Right Cluster -->
              <circle cx="39" cy="22" r="7.5" fill="${leafDark}" />
              <circle cx="37" cy="20" r="6" fill="${leafMid}" />
              <circle cx="42" cy="22" r="5" fill="${leafLight}" />
              <circle cx="40" cy="19" r="3" fill="${leafGlow}" />
              
              <!-- Right Blossom -->
              <path d="M 38 18 L 42 18 M 40 16 L 40 20" stroke="${blossomStroke}" stroke-width="0.8" />
              <circle cx="40" cy="18" r="0.8" fill="#fff" />

              <!-- Falling Sakura Petals -->
              <path d="M 16 26 C 14 26, 13 28, 15 29 C 16 30, 17 28, 16 26 Z" fill="${petalCol1}" />
              <path d="M 46 36 C 44 36, 43 38, 45 39 C 46 40, 47 38, 46 36 Z" fill="${petalCol2}" />
            </svg>`;
  }
}

// --- 9b. Most Visited Websites Widget ---
// Curated hostname -> pretty display name map. Falls back to a prettified
// domain for anything not listed here. This also doubles as our "smart
// grouping" table: entries that share a key are grouped as one site.
const MV_KNOWN_SITES = {
  'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'chatgpt.com': 'ChatGPT',
  'chat.openai.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'linkedin.com': 'LinkedIn',
  'mail.google.com': 'Gmail',
  'docs.google.com': 'Google Docs',
  'drive.google.com': 'Google Drive',
  'calendar.google.com': 'Google Calendar',
  'accounts.google.com': 'Google',
  'twitter.com': 'Twitter',
  'x.com': 'X',
  'reddit.com': 'Reddit',
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'stackoverflow.com': 'Stack Overflow',
  'amazon.com': 'Amazon',
  'netflix.com': 'Netflix',
  'whatsapp.com': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  'notion.so': 'Notion',
  'figma.com': 'Figma',
  'wikipedia.org': 'Wikipedia',
  'open.spotify.com': 'Spotify',
  'spotify.com': 'Spotify'
};

// Bare search-engine homepages/search-results pages are excluded on purpose:
// almost everyone hits google.com dozens of times a day just to search,
// which would otherwise permanently bury real destination sites like
// YouTube, Claude, or Spotify at the top of the list. Subdomains like
// mail.google.com or docs.google.com are NOT affected by this - only the
// bare "google.<tld>" search homepage itself.
const MV_EXCLUDED_SEARCH_HOMEPAGES = /^google\.[a-z.]{2,}$/i;

// URL patterns that should never be counted as a "visited website".
const MV_IGNORED_URL_PATTERNS = [
  /^chrome:/i, /^chrome-extension:/i, /^chrome-search:/i, /^chrome-untrusted:/i,
  /^edge:/i, /^about:/i, /^devtools:/i, /^file:/i, /^view-source:/i
];

const MV_MIN_REFRESH_INTERVAL_MS = 30000; // don't recompute more than once per 30s
const MV_MAX_SLOTS = 5; // total chips shown: pinned sites first, then auto-ranked fill the rest
let mvLastComputeTime = 0;

// Bumped whenever the ranking/exclusion logic changes shape. A cached
// result written by an older version (e.g. one that didn't exclude
// google.com yet) is discarded instead of being shown, so a logic fix
// can never be masked by a stale cached render.
const MV_CACHE_VERSION = 2;

// Strips common mobile/AMP subdomain prefixes so e.g. m.youtube.com and
// youtube.com fold into the same group.
function mvNormalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^(www|m|mobile|amp)\./, '');
}

function mvPrettifyDomain(hostname) {
  const parts = hostname.split('.');
  const main = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return main.charAt(0).toUpperCase() + main.slice(1);
}

function mvEscapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Pulls recent browser history, groups it into logical "sites", and scores
// each one by a blend of visit volume and recency so a site you used heavily
// yesterday doesn't outrank one you're actively using today.
// `excludedSet` keeps out anything that shouldn't appear in the auto-ranked
// results: sites the user hid via the "x" button, AND sites already shown
// as manually pinned (so a pinned site never gets duplicated below itself).
// `excludedNameSet` catches the same real-world site reachable through a
// different hostname (e.g. a pin on open.spotify.com shouldn't let plain
// spotify.com sneak back in as a second "Spotify" chip).
async function mvComputeRanking(mode, excludedSet, excludedNameSet) {
  if (!chrome.history || !chrome.history.search) {
    return null; // signals "history permission unavailable" to the caller
  }

  const periodMs = mode === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startTime = now - periodMs;

  let historyItems;
  try {
    historyItems = await chrome.history.search({ text: '', startTime, maxResults: 3000 });
  } catch (err) {
    console.error('Most Visited: history query failed', err);
    return null;
  }

  const groups = new Map();

  for (const item of historyItems) {
    if (!item.url) continue;
    if (MV_IGNORED_URL_PATTERNS.some((p) => p.test(item.url))) continue;

    let urlObj;
    try {
      urlObj = new URL(item.url);
    } catch {
      continue;
    }
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') continue;
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') continue;

    const rawHost = urlObj.hostname.toLowerCase();
    const normalizedHost = mvNormalizeHostname(rawHost);
    if (MV_EXCLUDED_SEARCH_HOMEPAGES.test(normalizedHost)) continue;

    const known = MV_KNOWN_SITES[rawHost];
    const groupKey = known ? rawHost : normalizedHost;
    if (excludedSet && excludedSet.has(groupKey)) continue;
    const displayName = known || MV_KNOWN_SITES[groupKey] || mvPrettifyDomain(groupKey);
    if (excludedNameSet && excludedNameSet.has(displayName.toLowerCase())) continue;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { name: displayName, hostname: groupKey, totalVisits: 0, lastVisit: 0, sampleUrl: item.url });
    }
    const g = groups.get(groupKey);
    g.totalVisits += item.visitCount || 1;
    if (item.lastVisitTime > g.lastVisit) {
      g.lastVisit = item.lastVisitTime;
      g.sampleUrl = item.url; // most recent URL for this site, used to open/match tabs
    }
  }

  const candidates = Array.from(groups.values());
  if (candidates.length === 0) return [];

  const maxVisits = Math.max(...candidates.map((c) => c.totalVisits));
  candidates.forEach((c) => {
    const visitScore = maxVisits > 0 ? c.totalVisits / maxVisits : 0;
    const recencyScore = Math.max(0, Math.min(1, (c.lastVisit - startTime) / periodMs));
    // Visit volume matters most, but recent activity gets real weight too,
    // so "today's" surge (e.g. GitHub) can outrank "this week's" leader.
    c.score = visitScore * 0.65 + recencyScore * 0.35;
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MV_MAX_SLOTS);
}

function mvRenderRanking(items) {
  const container = document.getElementById('most-visited-list');
  if (!container) return;

  container.innerHTML = '';

  if (items === null) {
    const empty = document.createElement('div');
    empty.className = 'mv-empty';
    empty.textContent = 'No browsing history available.';
    container.appendChild(empty);
    return;
  }
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mv-empty';
    empty.textContent = 'Your most visited sites will appear here.';
    container.appendChild(empty);
    return;
  }

  items.forEach((site, idx) => {
    // A real <button> can't legally contain another <button> (the remove
    // control), so the chip itself is a div acting as a button (role +
    // tabindex + keydown handling) with the remove button nested inside.
    const chip = document.createElement('div');
    chip.className = site.pinned ? 'mv-site mv-pinned' : 'mv-site';
    chip.setAttribute('role', 'button');
    chip.tabIndex = 0;
    chip.style.animationDelay = `${idx * 0.06}s`;
    chip.dataset.hostname = site.hostname;
    chip.dataset.url = site.sampleUrl;

    if (site.pinned) {
      chip.setAttribute('aria-label', `Open ${site.name} (pinned)`);
      chip.title = `${site.name} — Pinned`;
    } else {
      const visitLabel = site.totalVisits === 1 ? '1 visit' : `${site.totalVisits} visits`;
      // Visit count is intentionally not shown as a visible badge - only the
      // favicon + name are displayed. It's kept here for screen readers and
      // the hover tooltip only.
      chip.setAttribute('aria-label', `Open ${site.name}, ${visitLabel}`);
      chip.title = `${site.name} — ${visitLabel}`;
    }

    // site.sampleUrl must always be a real URL here (auto-ranked items get
    // it from history; pinned items get it copied from their saved `url` in
    // mvRefresh) - a missing sampleUrl was the root cause of pinned sites
    // showing a broken favicon and opening a blank tab instead of the site.
    const faviconUrl = site.sampleUrl
      ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(site.sampleUrl)}&size=32`
      : '';
    const removeLabel = site.pinned ? `Unpin ${site.name}` : `Remove ${site.name} from Most Visited`;
    const initial = mvEscapeHtml((site.name || '?').charAt(0).toUpperCase());

    chip.innerHTML = `
      <span class="mv-favicon">${
        faviconUrl
          ? `<img src="${faviconUrl}" alt="" width="16" height="16" onerror="mvFaviconFallback(this, '${initial}')">`
          : `<span class="mv-favicon-fallback">${initial}</span>`
      }</span>
      <span class="mv-name">${mvEscapeHtml(site.name)}</span>
      <button type="button" class="mv-remove-btn" aria-label="${mvEscapeHtml(removeLabel)}" title="${mvEscapeHtml(removeLabel)}">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const openSite = (e) => {
      mvSpawnRipple(chip, e);
      mvHandleClick(site);
    };

    chip.addEventListener('click', openSite);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSite(e);
      }
    });

    const removeBtn = chip.querySelector('.mv-remove-btn');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (site.pinned) {
        mvUnpinSite(site.hostname, chip);
      } else {
        mvHideSite(site.hostname, chip);
      }
    });
    // Prevent the chip's own click/keydown handling from firing when the
    // remove button is used via keyboard too.
    removeBtn.addEventListener('keydown', (e) => e.stopPropagation());

    container.appendChild(chip);
  });
}

// Replaces a broken favicon <img> with a small letter-avatar instead of
// leaving a blank/broken image icon behind. Called from the inline
// onerror handler, so it must be a global function (newtab.js is a plain
// script, not a module).
function mvFaviconFallback(imgEl, letter) {
  const span = document.createElement('span');
  span.className = 'mv-favicon-fallback';
  span.textContent = letter;
  if (imgEl && imgEl.parentNode) imgEl.replaceWith(span);
}

// Small Material-style click ripple, contained to the button, matching the
// 150-250ms timing used by the rest of the extension's micro-interactions.
function mvSpawnRipple(btn, event) {
  const existing = btn.querySelector('.mv-ripple');
  if (existing) existing.remove();

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.6;
  const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
  const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.className = 'mv-ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// Permanently removes a site from Most Visited. This is a one-way action
// by design - there's no "Hidden Sites" list to restore from. Plays a
// quick fade/scale-out, then re-ranks so the next-best site backfills the
// freed slot.
async function mvHideSite(hostname, chipEl) {
  if (chipEl) chipEl.classList.add('mv-removing');

  const { mvHiddenSites } = await chrome.storage.local.get(['mvHiddenSites']);
  const hidden = Array.isArray(mvHiddenSites) ? mvHiddenSites.slice() : [];
  if (!hidden.includes(hostname)) hidden.push(hostname);
  await chrome.storage.local.set({ mvHiddenSites: hidden });

  // Let the removal animation finish before re-rendering the row.
  setTimeout(() => mvRefresh(true), 220);
}

// --- Manually pinned sites ("Choose My Own Sites") ---
// Lets the user directly choose which sites show up, instead of relying
// only on auto-detected history. Pinned sites always take the first slots;
// auto-ranked history fills whatever's left, up to MV_MAX_SLOTS total.
// Managed entirely from Settings (behind the "Choose My Own Sites" toggle) -
// pinned chips still live in the row itself, with their own "x" to unpin.

// Accepts things like "spotify.com", "www.spotify.com", or a full URL, and
// returns a normalized URL object, or null if it's not a usable address.
function mvParseUserSiteInput(raw) {
  let value = (raw || '').trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
  try {
    const u = new URL(value);
    if (!u.hostname.includes('.')) return null;
    return u;
  } catch {
    return null;
  }
}

async function mvPinSite(urlObj) {
  const rawHost = urlObj.hostname.toLowerCase();
  const hostname = mvNormalizeHostname(rawHost);
  const name = MV_KNOWN_SITES[rawHost] || MV_KNOWN_SITES[hostname] || mvPrettifyDomain(hostname);

  const { mvPinnedSites, mvHiddenSites } = await chrome.storage.local.get(['mvPinnedSites', 'mvHiddenSites']);
  const pinned = Array.isArray(mvPinnedSites) ? mvPinnedSites.slice() : [];

  if (pinned.some((p) => p.hostname === hostname)) {
    return { error: `${name} is already pinned.` };
  }
  // Belt-and-suspenders: catches cases where two different hostnames
  // resolve to the same real-world site (e.g. open.spotify.com vs
  // spotify.com) but aren't caught by the exact hostname check above.
  if (pinned.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: `${name} is already pinned.` };
  }
  if (pinned.length >= MV_MAX_SLOTS) {
    return { error: `Most Visited is full (${MV_MAX_SLOTS}/${MV_MAX_SLOTS}). Unpin a site first.` };
  }

  pinned.push({ hostname, name, url: urlObj.href });
  // Pinning always wins over a previous hide.
  const hidden = (Array.isArray(mvHiddenSites) ? mvHiddenSites : []).filter((h) => h !== hostname);

  await chrome.storage.local.set({ mvPinnedSites: pinned, mvHiddenSites: hidden });
  mvRefresh(true);
  return { success: true, name };
}

async function mvUnpinSite(hostname, chipEl) {
  if (chipEl) chipEl.classList.add('mv-removing');

  const { mvPinnedSites } = await chrome.storage.local.get(['mvPinnedSites']);
  const pinned = (Array.isArray(mvPinnedSites) ? mvPinnedSites : []).filter((p) => p.hostname !== hostname);
  await chrome.storage.local.set({ mvPinnedSites: pinned });

  setTimeout(() => mvRefresh(true), 220);
}

// Shows/hides the "Choose My Own Sites" add-a-site panel in Settings.
function mvSetManualPanelVisible(visible) {
  const panel = document.getElementById('mv-manual-add-panel');
  if (panel) panel.hidden = !visible;
}

// Switches to an already-open tab for this site instead of opening a
// duplicate; only falls back to creating a new tab if none is found.
async function mvHandleClick(site) {
  try {
    const tabs = await chrome.tabs.query({});
    const match = tabs.find((t) => {
      if (!t.url) return false;
      try {
        const h = mvNormalizeHostname(new URL(t.url).hostname);
        const siteHost = mvNormalizeHostname(site.hostname);
        return h === siteHost;
      } catch {
        return false;
      }
    });

    if (match) {
      await chrome.tabs.update(match.id, { active: true });
      await chrome.windows.update(match.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: site.sampleUrl });
    }
  } catch (err) {
    console.error('Most Visited: could not focus/open tab', err);
    try { await chrome.tabs.create({ url: site.sampleUrl }); } catch { /* no-op */ }
  }
}

async function mvRefresh(force = false) {
  const now = Date.now();
  if (!force && now - mvLastComputeTime < MV_MIN_REFRESH_INTERVAL_MS) return;
  mvLastComputeTime = now;

  const { mvRankingMode, mvHiddenSites, mvPinnedSites } = await chrome.storage.local.get(
    ['mvRankingMode', 'mvHiddenSites', 'mvPinnedSites']
  );
  const mode = mvRankingMode === 'daily' ? 'daily' : 'weekly';
  const pinned = Array.isArray(mvPinnedSites) ? mvPinnedSites : [];

  // Auto-ranking must skip both hidden sites AND anything already pinned,
  // so a pinned site never shows up a second time further down the row.
  const excludedSet = new Set([
    ...(Array.isArray(mvHiddenSites) ? mvHiddenSites : []),
    ...pinned.map((p) => p.hostname)
  ]);
  // Also exclude by display name, in case the pinned hostname is a
  // different subdomain of the same real site (e.g. pinning
  // open.spotify.com shouldn't let plain spotify.com sneak back in).
  const excludedNameSet = new Set(pinned.map((p) => p.name.toLowerCase()));

  const remainingSlots = Math.max(0, MV_MAX_SLOTS - pinned.length);
  const autoItems = remainingSlots > 0 ? await mvComputeRanking(mode, excludedSet, excludedNameSet) : [];

  // Pinned entries are stored with a `.url` field, but rendering/opening
  // code (favicon fetch + click-to-open) expects `.sampleUrl` - without
  // this mapping, pinned chips showed a broken favicon and clicking one
  // opened a blank new tab instead of the actual site.
  const pinnedItems = pinned.map((p) => ({ ...p, pinned: true, sampleUrl: p.url }));

  let finalItems;
  if (autoItems === null) {
    // History permission unavailable - still show pinned sites if any.
    finalItems = pinnedItems.length > 0 ? pinnedItems : null;
  } else {
    finalItems = [...pinnedItems, ...autoItems.slice(0, remainingSlots)].slice(0, MV_MAX_SLOTS);
  }

  mvRenderRanking(finalItems);

  if (autoItems !== null) {
    chrome.storage.local.set({ mvCache: { items: autoItems, computedAt: now, mode, version: MV_CACHE_VERSION } });
  }
}

function mvSetModeUI(mode) {
  const dailyBtn = document.getElementById('mv-mode-daily');
  const weeklyBtn = document.getElementById('mv-mode-weekly');
  if (!dailyBtn || !weeklyBtn) return;
  dailyBtn.classList.toggle('active', mode === 'daily');
  dailyBtn.setAttribute('aria-checked', mode === 'daily');
  weeklyBtn.classList.toggle('active', mode === 'weekly');
  weeklyBtn.setAttribute('aria-checked', mode === 'weekly');
}

// Toggles a stronger, more translucent frosted-glass look for the Most
// Visited chips so more of the wallpaper artwork shows through them.
function mvSetGlassUI(enabled) {
  const list = document.getElementById('most-visited-list');
  const toggle = document.getElementById('toggle-mv-glass');
  if (list) list.classList.toggle('mv-glass-enhanced', enabled);
  if (toggle) toggle.checked = enabled;
}

function setupMostVisited() {
  const container = document.getElementById('most-visited-list');
  if (!container) return;

  // Render instantly from cache (if any) for a snappy first paint, then
  // recompute in the background so the list is always fresh. A cache
  // written by an older logic version (e.g. before google.com was
  // excluded) is intentionally discarded rather than shown - this is what
  // previously let a stale "google.com" chip flash back in after a fix.
  chrome.storage.local.get(
    ['mvCache', 'mvRankingMode', 'mvGlassEnhanced', 'mvPinnedSites', 'mvManualAddEnabled'],
    (result) => {
      mvSetModeUI(result.mvRankingMode === 'daily' ? 'daily' : 'weekly');
      mvSetGlassUI(result.mvGlassEnhanced === true);
      mvSetManualPanelVisible(result.mvManualAddEnabled === true);
      const manualToggle = document.getElementById('toggle-mv-manual');
      if (manualToggle) manualToggle.checked = result.mvManualAddEnabled === true;

      const pinned = (result.mvPinnedSites || []).map((p) => ({ ...p, pinned: true, sampleUrl: p.url }));
      const cache = result.mvCache;
      const remainingSlots = Math.max(0, MV_MAX_SLOTS - pinned.length);

      if (pinned.length > 0 || (cache && cache.items && cache.version === MV_CACHE_VERSION)) {
        const autoPart = (cache && cache.version === MV_CACHE_VERSION) ? cache.items : [];
        mvRenderRanking([...pinned, ...autoPart.slice(0, remainingSlots)].slice(0, MV_MAX_SLOTS));
      }
      mvRefresh(true);
    }
  );

  // Real-time updates: react to new history entries while this tab is open,
  // throttled so we never hammer the History API.
  if (chrome.history && chrome.history.onVisited) {
    chrome.history.onVisited.addListener(() => mvRefresh(false));
  }

  // Backstop poll in case no history events fire while the page is open.
  setInterval(() => mvRefresh(false), MV_MIN_REFRESH_INTERVAL_MS);

  // Settings drawer: Daily / Weekly segmented toggle.
  const dailyBtn = document.getElementById('mv-mode-daily');
  const weeklyBtn = document.getElementById('mv-mode-weekly');

  if (dailyBtn && weeklyBtn) {
    dailyBtn.addEventListener('click', () => {
      chrome.storage.local.set({ mvRankingMode: 'daily' }, () => {
        mvSetModeUI('daily');
        mvRefresh(true);
      });
    });

    weeklyBtn.addEventListener('click', () => {
      chrome.storage.local.set({ mvRankingMode: 'weekly' }, () => {
        mvSetModeUI('weekly');
        mvRefresh(true);
      });
    });
  }

  // Settings drawer: Glassmorphism toggle for the Most Visited chips.
  const glassToggle = document.getElementById('toggle-mv-glass');
  if (glassToggle) {
    glassToggle.addEventListener('change', () => {
      const val = glassToggle.checked;
      chrome.storage.local.set({ mvGlassEnhanced: val }, () => {
        mvSetGlassUI(val);
      });
    });
  }

  // Settings drawer: "Choose My Own Sites" toggle - shows/hides the add
  // form. Lives entirely inside Settings now, not as a floating box next
  // to the row.
  const manualToggle = document.getElementById('toggle-mv-manual');
  if (manualToggle) {
    manualToggle.addEventListener('change', () => {
      const val = manualToggle.checked;
      chrome.storage.local.set({ mvManualAddEnabled: val }, () => {
        mvSetManualPanelVisible(val);
      });
    });
  }

  // Settings drawer: the "Add a site" form itself (only visible while the
  // toggle above is on).
  const addInput = document.getElementById('mv-add-input');
  const addConfirmBtn = document.getElementById('mv-add-confirm');
  const addErrorEl = document.getElementById('mv-add-error');

  const confirmAdd = async () => {
    const urlObj = mvParseUserSiteInput(addInput ? addInput.value : '');
    if (!urlObj) {
      if (addErrorEl) addErrorEl.textContent = 'Enter a valid site, e.g. spotify.com';
      return;
    }
    const result = await mvPinSite(urlObj);
    if (result.error) {
      if (addErrorEl) addErrorEl.textContent = result.error;
      return;
    }
    if (addErrorEl) addErrorEl.textContent = `${result.name} added.`;
    if (addInput) addInput.value = '';
  };

  if (addConfirmBtn) addConfirmBtn.addEventListener('click', confirmAdd);
  if (addInput) {
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmAdd();
      }
    });
  }
}

// --- 10. Event Listeners & Bootstrapping ---
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "refreshUI") {
    updateUI();
  }
});

setInterval(updateClock, 1000);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const liveWallpaperKeys = ['toggleLiveWallpaper', 'activeLiveWallpaper', 'liveWallpaperLibraryRev', 'plantGrowth', 'lastWateredTime'];
  const hasOtherChanges = Object.keys(changes).some(k => !liveWallpaperKeys.includes(k));
  if (hasOtherChanges) {
    updateUI();
  }
  if (changes.focusGoal || changes.focusCompleted) {
    setupFocusGoal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  setupFocusGoal();
  setupWallpaperActions();
  setupSoundscapePopover();
  setupSettingsDrawer();
  setupCleanVibeMode();
  setupZenGarden();
  setupMostVisited();
  updateUI();
  fetchQuote();
});
