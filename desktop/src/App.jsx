import React, { useState, useEffect, useCallback, useRef, useDeferredValue, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { check } from '@tauri-apps/plugin-updater';
import { open } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from './useFocusTrap.js';
import {
  LuSearch, LuDownload, LuImage, LuLayoutGrid,
  LuRefreshCw, LuCheck, LuX, LuTrash,
  LuMonitor, LuSparkles, LuSun, LuMoon,
  LuChevronDown, LuChevronUp, LuChevronLeft, LuChevronRight,
  LuFolderPlus, LuTriangleAlert, LuStar
} from 'react-icons/lu';
import './App.css';
import { SplashScreen } from './components/SplashScreen.jsx';
import { Toast } from './components/Toast.jsx';
import { WallpaperCard } from './components/WallpaperCard.jsx';
import { Lightbox } from './components/Lightbox.jsx';
import { UpdateModal } from './components/UpdateModal.jsx';
import { getVersion } from '@tauri-apps/api/app';


const API_URL = 'https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@main/frontend/public/wallpapers.json';
const STATIC_URL = 'https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@main/frontend/public';

export default function App() {
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => { getVersion().then(setAppVersion); }, []);
  const updatesEnabled = !import.meta.env.DEV;
  const [wallpapers, setWallpapers] = useState([]);
  const [localFolders, setLocalFolders] = useState(() => JSON.parse(localStorage.getItem('cozy_localFolders') || '[]'));
  const [customWallpapers, setCustomWallpapers] = useState([]);
  const allWallpapers = useMemo(() => [...customWallpapers, ...wallpapers], [customWallpapers, wallpapers]);
  const categories = useMemo(() => [...new Set(allWallpapers.map(w => w.category))], [allWallpapers]);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cozy_favorites')) || []; } catch { return []; }
  });

  const categoryCounts = useMemo(() => {
    const counts = { All: allWallpapers.length, Favorites: favorites.length };
    allWallpapers.forEach(w => {
      counts[w.category] = (counts[w.category] || 0) + 1;
    });
    return counts;
  }, [allWallpapers, favorites]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [fetchError, setFetchError] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const splashStartRef = useRef(Date.now());
  const fetchAbortRef = useRef(null);
  const deferredSearch = useDeferredValue(search);
  const [displayCount, setDisplayCount] = useState(48);
  const [preview, setPreview] = useState(null);
  const [settingWallpaper, setSettingWallpaper] = useState(null);
  const [settingLockScreen, setSettingLockScreen] = useState(null);
  const [dark, setDark] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [toast, setToast] = useState(null);
  const toastQueue = useRef([]);
  const toastTimer = useRef(null);
  const toastIdCounter = useRef(0);
  const manualRotateRef = useRef(false);

  const toastRef = useRef(null);

  const showNextToast = useCallback(() => {
    const next = toastQueue.current.shift();
    if (next) {
      toastRef.current = next;
      setToast(next);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(showNextToast, 3500);
    } else {
      toastRef.current = null;
      toastTimer.current = null;
      setToast(null);
    }
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    // Dedup: skip if same message+type already shown or queued
    if (toastRef.current && toastRef.current.message === message && toastRef.current.type === type) return;
    if (toastQueue.current.some(t => t.message === message && t.type === type)) return;
    toastIdCounter.current += 1;
    toastQueue.current.push({ id: toastIdCounter.current, message, type });
    if (!toastTimer.current) {
      showNextToast();
    }
  }, [showNextToast]);

  const intervals = useMemo(() => [
    { label: '5m', value: 5 * 60 * 1000 },
    { label: '15m', value: 15 * 60 * 1000 },
    { label: '30m', value: 30 * 60 * 1000 },
    { label: '1h', value: 60 * 60 * 1000 },
  ], []);
  const [autoRotate, setAutoRotate] = useState(() => localStorage.getItem('cozy_autoRotate') === 'true');
  const [rotateInterval, setRotateInterval] = useState(() => parseInt(localStorage.getItem('cozy_rotateInterval')) || 15 * 60 * 1000);
  const [rotateCategory, setRotateCategory] = useState(() => localStorage.getItem('cozy_rotateCategory') || 'All');
  const [rotateStatus, setRotateStatus] = useState(false);
  const [rotateExpanded, setRotateExpanded] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => { localStorage.setItem('cozy_autoRotate', autoRotate); }, [autoRotate]);
  useEffect(() => { localStorage.setItem('cozy_rotateInterval', rotateInterval); }, [rotateInterval]);
  useEffect(() => { localStorage.setItem('cozy_rotateCategory', rotateCategory); }, [rotateCategory]);

  const observerRef = useRef();
  const loaderRef = useCallback(node => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setDisplayCount(c => c + 48);
    }, { rootMargin: '300px' });
    if (node) observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setFetchError(false);
    setFetching(true);

    fetch(API_URL, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (Array.isArray(d)) { setWallpapers(d); setFetchError(false); } })
      .catch(e => {
        if (e.name !== 'AbortError') {
          console.error('Failed to fetch wallpapers:', e);
          setFetchError(true);
        }
      })
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!fetching) {
      const elapsed = Date.now() - splashStartRef.current;
      const remaining = Math.max(0, 2700 - elapsed);
      const timer = setTimeout(() => setShowSplash(false), remaining);
      return () => clearTimeout(timer);
    }
  }, [fetching]);

  useEffect(() => {
    localStorage.setItem('cozy_localFolders', JSON.stringify(localFolders));
    let cancelled = false;
    async function scanLocal() {
       let arr = [];
       for (let folder of localFolders) {
           try {
              let paths = await invoke('scan_local_directory', { path: folder });
              if (cancelled) return;
              arr.push(...paths.map(p => {
                 const pClean = p.replace(/\\/g, '/');
                 const localUrl = convertFileSrc(pClean, 'cozy');
                 return {
                   name: pClean.split('/').pop(),
                   path: localUrl,
                   realPath: pClean,
                   category: `Local: ${folder.split('\\').pop()?.split('/').pop()}`,
                   downloadPath: localUrl
                 };
              }));
           } catch (e) { console.error('Local scan error:', e); }
       }
       if (cancelled) return;
       setCustomWallpapers(arr);
    }
    scanLocal();
    return () => { cancelled = true; };
  }, [localFolders]);
  
  const [updateModal, setUpdateModal] = useState({ show: false, state: 'checking', version: '', progress: 0, error: '' });
  const pendingUpdateRef = useRef(null);

  const showUpdateModal = useCallback((s) => setUpdateModal(prev => ({ ...prev, show: true, ...s })), []);
  const closeUpdateModal = useCallback(() => setUpdateModal(prev => ({ ...prev, show: false })), []);

  const performUpdate = useCallback(async (manual = false) => {
    if (!updatesEnabled) {
      if (manual) {
        // create a mock update that simulates a gradual download in dev
        pendingUpdateRef.current = {
          version: appVersion,
          downloadAndInstall: async (onEvent) => {
            onEvent?.({ event: 'Started', data: { contentLength: 100 } });
            // simulate chunked progress (10 steps)
            for (let i = 1; i <= 10; i++) {
              // wait a bit to show animation
              // eslint-disable-next-line no-await-in-loop
              await new Promise(r => setTimeout(r, 180));
              onEvent?.({ event: 'Progress', data: { chunkLength: 10 } });
            }
            onEvent?.({ event: 'Finished' });
          },
        };
        showUpdateModal({ state: 'available', version: appVersion });
      }
      return;
    }
    if (manual) showUpdateModal({ state: 'checking', version: '', progress: 0, error: '' });
    try {
      const update = await check();
      if (update) {
        pendingUpdateRef.current = update;
        showUpdateModal({ state: 'available', version: update.version });
      } else if (manual) {
        showUpdateModal({ state: 'uptodate', version: appVersion });
      }
    } catch (err) {
      if (manual) {
        showUpdateModal({ state: 'error', error: String(err) });
      } else {
        console.error('Update check failed:', err);
      }
    }
  }, [showUpdateModal, closeUpdateModal, updatesEnabled]);

  const handleInstallUpdate = useCallback(async () => {
    const update = pendingUpdateRef.current;
    if (!update) return;
    showUpdateModal({ state: 'downloading', version: update.version, progress: 0 });
    try {
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data?.contentLength) {
          contentLength = event.data.contentLength;
        } else if (event.event === 'Progress' && event.data?.chunkLength) {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            setUpdateModal(prev => ({ ...prev, progress: (downloaded / contentLength) * 100 }));
          }
        } else if (event.event === 'Finished') {
          setUpdateModal(prev => ({ ...prev, progress: 100 }));
        }
      });
      if (updatesEnabled) {
        // in production, relaunch will restart the app after install
        await relaunch();
      } else {
        // dev: show installed state briefly then close
        showUpdateModal({ state: 'uptodate', version: appVersion });
        setTimeout(() => closeUpdateModal(), 1200);
      }
    } catch (err) {
      showUpdateModal({ state: 'error', error: String(err) });
    }
  }, [showUpdateModal, updatesEnabled]);

  useEffect(() => {
    if (updatesEnabled) performUpdate(false);
  }, [performUpdate, updatesEnabled]);

  const handleManualUpdateCheck = useCallback(() => {
    performUpdate(true);
  }, [performUpdate]);


  useEffect(() => {
    if (autoRotate && rotateStatus) {
      invoke('update_rotate_interval', { newIntervalMs: rotateInterval })
        .catch(err => console.error(err));
    }
  }, [rotateInterval, rotateStatus, autoRotate]);

  useEffect(() => {
    if (manualRotateRef.current) {
      manualRotateRef.current = false;
      return;
    }
    if (autoRotate && categoryCounts.All > 0 && !rotateStatus) {
      const pool = allWallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: w.realPath || (w.path.startsWith('http') || w.path.startsWith('cozy://') ? w.path : `${STATIC_URL}${w.path}`) }));
      if (pool.length) {
        let startIndex = 0;
        let initialDelayMs = rotateInterval;
        
        const lastName = localStorage.getItem('cozy_lastRotationName');
        const lastTime = parseInt(localStorage.getItem('cozy_lastRotationTime'));
        
        if (lastName) {
          const idx = pool.findIndex(w => w.name === lastName);
          if (idx !== -1) startIndex = idx;
        }
        
        if (lastTime) {
          const elapsed = Date.now() - lastTime;
          initialDelayMs = Math.max(0, rotateInterval - elapsed);
        }

        invoke('start_auto_rotate', { 
          intervalMs: rotateInterval, 
          wallpapers: pool,
          startIndex,
          initialDelayMs
        })
          .then(() => {
            setRotateStatus(true);
          })
          .catch(() => setAutoRotate(false));
      }
    }
  }, [allWallpapers, autoRotate, rotateCategory, rotateInterval, rotateStatus, addToast]);

  useEffect(() => {
    const u = listen('wallpaper-changed', e => {
      localStorage.setItem('cozy_lastRotationName', e.payload);
      localStorage.setItem('cozy_lastRotationTime', Date.now().toString());
      addToast('Rotated to next wallpaper', 'rotate');
    });
    return () => { u.then(fn => fn()); };
  }, [addToast]);








  const handleSetWallpaper = useCallback(async (wallpaper) => {
    const url = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') 
       ? wallpaper.path 
       : `${STATIC_URL}${wallpaper.path}`;
       
    const rustUrl = wallpaper.realPath || (url.startsWith('cozy://localhost/') ? url.replace('cozy://localhost/', '') : url);
       
    setSettingWallpaper(wallpaper.path);
    try {
      await invoke('set_wallpaper', { url: rustUrl });
      addToast('Wallpaper set', 'wallpaper');
    } catch (err) {
      addToast(`${err}`, 'error');
    } finally {
      setSettingWallpaper(null);
    }
  }, [addToast]);

  const handleSetLockScreen = useCallback(async (wallpaper) => {
    const url = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') 
       ? wallpaper.path 
       : `${STATIC_URL}${wallpaper.path}`;
       
    const rustUrl = wallpaper.realPath || (url.startsWith('cozy://localhost/') ? url.replace('cozy://localhost/', '') : url);

    setSettingLockScreen(wallpaper.path);
    try {
      await invoke('set_lock_screen', { url: rustUrl });
      addToast('Lock screen updated', 'success');
    } catch (err) {
      addToast(`${err}`, 'error');
    } finally {
      setSettingLockScreen(null);
    }
  }, [addToast]);

  const handleDownload = useCallback(async (wallpaper) => {
    const url = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') 
      ? wallpaper.path 
      : `${STATIC_URL}${wallpaper.path}`;
    const name = wallpaper.name || 'wallpaper';

    try {
      let bytes;
      if (wallpaper.realPath) {
        bytes = await invoke('read_file_bytes', { path: wallpaper.realPath });
      } else {
        bytes = await invoke('fetch_image_bytes', { url });
      }
      const blob = new Blob([new Uint8Array(bytes)]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      addToast(`Downloaded ${name}`, 'success');
    } catch (err) {
      // Fallback: try direct download via anchor
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [addToast]);

  const handleToggleRotate = useCallback(async () => {
    if (autoRotate) {
      setAutoRotate(false);
      setRotateStatus(false);
      try { await invoke('stop_auto_rotate'); await disable(); } catch (e) { console.error('Stop rotate error:', e); }
      addToast('Auto-rotate off', 'rotate');
    } else {
      manualRotateRef.current = true;
      setAutoRotate(true);
      const pool = allWallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: w.realPath || (w.path.startsWith('http') || w.path.startsWith('cozy://') ? w.path : `${STATIC_URL}${w.path}`) }));
      if (!pool.length) { addToast('No wallpapers in this category', 'error'); return; }
      try {
        await invoke('start_auto_rotate', { 
          intervalMs: rotateInterval, 
          wallpapers: pool,
          startIndex: 0,
          initialDelayMs: rotateInterval
        });
        await enable();
        setRotateStatus(true);
        addToast(`Auto-rotate on — every ${rotateInterval / 60000}min`, 'rotate');
      } catch (err) {
        addToast(`${err}`, 'error');
        setAutoRotate(false);
      }
    }
  }, [autoRotate, allWallpapers, rotateInterval, rotateCategory, addToast]);

  // allWallpapers and categories moved up

  const filtered = useMemo(() => {
    let base = allWallpapers;
    if (category === 'Favorites') {
      base = allWallpapers.filter(w => favorites.includes(w.path));
    } else if (category !== 'All') {
      base = allWallpapers.filter(w => w.category === category);
    }
    return base
      .filter(w => {
        if (!deferredSearch.trim()) return true;
        const q = deferredSearch.toLowerCase();
        return w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q);
      });
  }, [allWallpapers, category, deferredSearch, favorites]);

  const toggleFavorite = useCallback((wallpaper) => {
    setFavorites(prev => {
      const isFav = prev.includes(wallpaper.path);
      const newFavs = isFav ? prev.filter(p => p !== wallpaper.path) : [...prev, wallpaper.path];
      localStorage.setItem('cozy_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  }, []);

  useEffect(() => {
    const uNext = listen('tray-next-wallpaper', () => {
      if (filtered.length > 0) {
        const randomWallpaper = filtered[Math.floor(Math.random() * filtered.length)];
        handleSetWallpaper(randomWallpaper);
      }
    });
    const uToggle = listen('tray-toggle-rotate', () => {
      setAutoRotate(prev => !prev);
    });
    return () => { 
      uNext.then(fn => fn()); 
      uToggle.then(fn => fn()); 
    };
  }, [filtered, autoRotate]);

  useEffect(() => {
    document.title = `CozyPixels — ${filtered.length} Wallpaper${filtered.length !== 1 ? 's' : ''}`;
  }, [filtered.length]);

  const previewIdx = useMemo(() => preview ? filtered.findIndex(w => w.path === preview.path) : -1, [preview, filtered]);
  const hasNext = previewIdx !== -1 && previewIdx < filtered.length - 1;
  const hasPrev = previewIdx > 0;
  const handleNext = useCallback(() => {
    if (previewIdx !== -1 && previewIdx < filtered.length - 1) setPreview(filtered[previewIdx + 1]);
  }, [filtered, previewIdx]);
  const handlePrev = useCallback(() => {
    if (previewIdx > 0) setPreview(filtered[previewIdx - 1]);
  }, [filtered, previewIdx]);

  const handlePreview = useCallback((w) => setPreview(w), []);
  const displayedWallpapers = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);

  return (
    <div className="app">
      <SplashScreen visible={showSplash} />
      <aside className="sidebar">
        <div className="logo">
          {!showSplash && (
            <>
              <motion.div layoutId="app-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LuSparkles size={18} />
              </motion.div>
              <motion.span layoutId="app-logo-text">CozyPixels</motion.span>
            </>
          )}
        </div>

        <nav className="nav">
          <button 
            className={`nav__item ${category === 'All' ? 'active' : ''}`} 
            onClick={() => setCategory('All')}
          >
            <LuLayoutGrid size={15} />
            <span>All Wallpapers</span>
            <span className="nav__badge">{categoryCounts.All}</span>
          </button>
          <button 
            className={`nav__item ${category === 'Favorites' ? 'active' : ''}`} 
            onClick={() => setCategory('Favorites')}
          >
            <LuStar size={15} />
            <span>Favorites</span>
            <span className="nav__badge">{categoryCounts.Favorites}</span>
          </button>
          {categories.map(cat => {
            const isCustom = cat.startsWith('Local:');
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <button 
                  className={`nav__item ${category === cat ? 'active' : ''}`} 
                  onClick={() => setCategory(cat)}
                  style={{ flex: 1, overflow: 'hidden' }}
                >
                  <LuImage size={15} style={{ flexShrink: 0 }} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{cat}</span>
                  <span className="nav__badge">{(categoryCounts[cat] || 0)}</span>
                </button>
                {isCustom && (
                    <button 
                      className="nav__item"
                      style={{ flex: '0 0 auto', padding: '8px', background: 'transparent', width: 'auto', minHeight: 'auto' }}
                      title="Remove"
                      aria-label={`Remove ${cat}`}
                      onClick={(e) => {
                      e.stopPropagation();
                      if (cat.startsWith('Local:')) {
                        const folderName = cat.replace('Local: ', '');
                        setLocalFolders(fs => {
                          const idx = fs.findIndex(f => {
                            const base = f.replace(/\\/g, '/').split('/').filter(Boolean).pop();
                            return base === folderName;
                          });
                          return idx === -1 ? fs : fs.filter((_, i) => i !== idx);
                        });
                      }
                      if (category === cat) setCategory('All');
                      addToast('Removed from library', 'success');
                    }}
                  >
                    <LuTrash size={15} color="var(--md-sys-color-error)" />
                  </button>
                )}
              </div>
            );
          })}
        </nav>


        <div style={{ padding: '0 12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button className="nav__item" onClick={async () => {
              const selected = await open({ directory: true, multiple: false });
              if (selected) {
                  if (!localFolders.includes(selected)) setLocalFolders([...localFolders, selected]);
                  addToast('Folder added', 'success');
              }
            }}>
              <LuFolderPlus size={15} />
              <span>Add Local Folder</span>
            </button>
        </div>

        <div className="sidebar__footer">
          <div style={{ padding: '16px 0', borderTop: '1px solid var(--md-sys-color-outline-variant)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--md-sys-color-outline)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '8px' }}>Settings</span>
            
            <div className="panel-row" onClick={() => setDark(!dark)} style={{ cursor: 'pointer' }}>
              <div className="panel-icon-wrap" style={{ width: '32px', height: '32px' }}>
                {dark ? <LuMoon size={14} /> : <LuSun size={14} />}
              </div>
              <div className="panel-text">
                <span className="panel-title">Theme</span>
                <span className="panel-desc">{dark ? 'Dark mode' : 'Light mode'}</span>
              </div>
              <div className={`premium-toggle ${dark ? 'on' : ''}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right', pointerEvents: 'none' }} role="switch" aria-checked={dark} aria-label="Toggle dark mode">
                <div className="premium-toggle__thumb" />
              </div>
            </div>

            <div className="panel-row" onClick={() => setRotateExpanded(!rotateExpanded)} style={{ cursor: 'pointer' }}>
              <div className="panel-icon-wrap" style={{ width: '32px', height: '32px' }}><LuRefreshCw size={14} /></div>
              <div className="panel-text">
                <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Auto-rotate {rotateExpanded ? <LuChevronUp size={14} color="var(--md-sys-color-outline)" /> : <LuChevronDown size={14} color="var(--md-sys-color-outline)" />}
                </span>
                <span className="panel-desc">Change automatically</span>
              </div>
                <div className={`premium-toggle ${autoRotate ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); handleToggleRotate(); }} style={{ transform: 'scale(0.85)', transformOrigin: 'right' }} role="switch" aria-checked={autoRotate} aria-label="Toggle auto-rotate">
                  <div className="premium-toggle__thumb" />
                </div>
            </div>
            <AnimatePresence>
              {rotateExpanded && (
                <motion.div className="panel-expand"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="panel-grid">
                    {intervals.map(iv => (
                      <button key={iv.value}
                        className={`panel-chip ${rotateInterval === iv.value ? 'active' : ''}`}
                        onClick={() => setRotateInterval(iv.value)}>
                        {iv.label}
                      </button>
                    ))}
                  </div>
                  <select className="premium-select" value={rotateCategory} onChange={e => setRotateCategory(e.target.value)}>
                    <option value="All">All Collections</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="nav__item" onClick={handleManualUpdateCheck} title={updatesEnabled ? 'Check for updates' : 'Open a mock update flow for testing'} style={{ marginTop: '4px' }}>
            <LuDownload size={15} />
            <span>Check for updates</span>
            <span className="nav__badge" style={{ fontSize: '10px', opacity: 0.5 }}>v{appVersion}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search">
            <LuSearch size={16} className="search__icon" />
            <input
              type="text"
              placeholder="Search wallpapers..."
              className="search__input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search wallpapers"
            />
            {search && (
              <button className="search__clear" onClick={() => setSearch('')} aria-label="Clear search">
                <LuX size={14} />
              </button>
            )}
          </div>
          <div className="topbar__right">
            <span className="topbar__count">{category === 'All' ? '' : category + ' — '}{filtered.length} curated</span>
          </div>
        </div>

        <div className="gallery" style={{ position: 'relative' }}>
          {displayedWallpapers.map((w, i) => (
            <WallpaperCard
              key={`${w.category}-${w.name}-${i}`}
              wallpaper={w}
              onSetWallpaper={handleSetWallpaper}
              onPreview={handlePreview}
              onDownload={handleDownload}
              setting={settingWallpaper === w.path}
              isFavorite={favorites.includes(w.path)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {filtered.length > displayCount && (
            <div ref={loaderRef} className="loader">
              <div className="spinner"></div> Loading...
            </div>
          )}
          {filtered.length === 0 && wallpapers.length > 0 && !fetchError && (
            <div className="empty"><LuImage size={44} /><p>No wallpapers found</p></div>
          )}
          {fetchError && (
            <div className="empty" style={{ gap: '12px' }}>
              <LuTriangleAlert size={44} />
              <p>Failed to load wallpapers</p>
              <button onClick={() => {
                fetchAbortRef.current?.abort();
                fetch(API_URL)
                  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
                  .then(d => { if (Array.isArray(d)) { setWallpapers(d); setFetchError(false); } })
                  .catch(e => { if (e.name !== 'AbortError') console.error('Retry failed:', e); });
              }} style={{
                padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--md-sys-color-outline-variant)',
                background: 'transparent', color: 'var(--md-sys-color-on-surface)', fontSize: '13px',
                fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit'
              }}>
                Retry
              </button>
            </div>
          )}
          {wallpapers.length === 0 && !fetchError && !fetching && (
            <div className="empty"><LuImage size={44} /><p>No wallpapers loaded yet</p></div>
          )}
        </div>
      </main>

      <AnimatePresence mode="wait">
        {preview && (
          <Lightbox
            wallpaper={preview}
            onClose={() => setPreview(null)}
            onSetWallpaper={handleSetWallpaper}
            onSetLockScreen={handleSetLockScreen}
            onDownload={handleDownload}
            setting={settingWallpaper === preview?.path}
            settingLock={settingLockScreen === preview?.path}
            onNext={handleNext}
            onPrev={handlePrev}
            hasNext={hasNext}
            hasPrev={hasPrev}
          />
        )}
      </AnimatePresence>
      
      <UpdateModal
        show={updateModal.show}
        state={updateModal.state}
        version={updateModal.version}
        progress={updateModal.progress}
        errorMsg={updateModal.error}
        onClose={closeUpdateModal}
        onInstall={handleInstallUpdate}
      />

      <div className="toasts" aria-live="polite" aria-label="Notifications">
        <AnimatePresence mode="wait">
          {toast && (
            <Toast key={toast.id} message={toast.message} type={toast.type} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
