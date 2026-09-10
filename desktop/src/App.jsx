import React, { useState, useEffect, useCallback, useRef, useDeferredValue, useMemo } from 'react';
import { invoke as tauriInvoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { check } from '@tauri-apps/plugin-updater';
import { open, save } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from './useFocusTrap.js';
import {
  LuSearch, LuDownload, LuImage, LuLayoutGrid,
  LuRefreshCw, LuX, LuTrash,
  LuMonitor, LuSparkles, LuSun, LuMoon,
  LuChevronDown, LuChevronUp, LuChevronLeft, LuChevronRight,
  LuFolderPlus, LuTriangleAlert, LuStar, LuMousePointerClick
} from 'react-icons/lu';
import './App.css?v=2';
import './premium.css';
import { SplashScreen } from './components/SplashScreen.jsx';
import { Toast } from './components/Toast.jsx';
import { WallpaperCard } from './components/WallpaperCard.jsx';
import { Lightbox } from './components/Lightbox.jsx';
import { UpdateModal } from './components/UpdateModal.jsx';
import { ConfirmModal } from './components/ConfirmModal.jsx';
import { VideoBackgroundPlayer } from './components/VideoBackgroundPlayer.jsx';
import { getVersion } from '@tauri-apps/api/app';

const isTauri = () => Boolean(window.__TAURI_INTERNALS__);
const invoke = (...args) => isTauri()
  ? tauriInvoke(...args)
  : Promise.reject(new Error('Run this action in the CozyPixels desktop app'));
const listen = (...args) => isTauri()
  ? tauriListen(...args)
  : Promise.resolve(() => {});


const STATIC_COMMIT = 'f86b8925c715881b33e50f70f34ef8898851a31e';
const API_URL = `https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@${STATIC_COMMIT}/frontend/public/wallpapers.json`;
const STATIC_URL = `https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@${STATIC_COMMIT}/frontend/public`;

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const videoUrl = params.get('videoUrl');

  if (videoUrl) {
    return <VideoBackgroundPlayer initialUrl={videoUrl} />;
  }

  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    if (isTauri()) getVersion().then(setAppVersion).catch(() => {});
  }, []);
  const updatesEnabled = !import.meta.env.DEV;
  const [wallpapers, setWallpapers] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('cozy_wallpapers_catalog') || '[]');
      return Array.isArray(cached) ? cached : [];
    } catch {
      return [];
    }
  });
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
  const [fetching, setFetching] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('cozy_wallpapers_catalog') || '[]');
      return !Array.isArray(cached) || cached.length === 0;
    } catch {
      return true;
    }
  });
  const [defaultDownloadPath, setDefaultDownloadPath] = useState(() => localStorage.getItem('cozy_download_path') || '');
  const [showSplash, setShowSplash] = useState(true);
  const splashStartRef = useRef(Date.now());
  const fetchAbortRef = useRef(null);
  const hasCachedCatalogRef = useRef(wallpapers.length > 0);
  const deferredSearch = useDeferredValue(search);
  const [displayCount, setDisplayCount] = useState(48);
  const [preview, setPreview] = useState(null);
  const [settingWallpaper, setSettingWallpaper] = useState(null);
  const [settingLockScreen, setSettingLockScreen] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWallpapers, setSelectedWallpapers] = useState([]);
  const [confirmState, setConfirmState] = useState({ show: false, message: '', title: '', resolve: null });
  const customConfirm = useCallback((message, options) => {
    return new Promise(resolve => {
      setConfirmState({ show: true, message, title: options?.title || 'Confirm', resolve });
    });
  }, []);
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
    setDisplayCount(48);
    galleryRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
  }, [category, deferredSearch]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;
    const handleChange = (e) => setDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => { localStorage.setItem('cozy_autoRotate', autoRotate); }, [autoRotate]);
  useEffect(() => { localStorage.setItem('cozy_rotateInterval', rotateInterval); }, [rotateInterval]);
  useEffect(() => { localStorage.setItem('cozy_rotateCategory', rotateCategory); }, [rotateCategory]);

  const observerRef = useRef();
  const galleryRef = useRef(null);
  const loaderRef = useCallback(node => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setDisplayCount(c => c + 24);
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
    setFetching(!hasCachedCatalogRef.current);

    fetch(API_URL, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { 
        if (Array.isArray(d)) { 
          setWallpapers(d); 
          localStorage.setItem('cozy_wallpapers_catalog', JSON.stringify(d));
          setFetchError(false); 
          const urls = d.map(w => w.path.startsWith('http') ? w.path : `${STATIC_URL}${w.path}`);
          invoke('sync_all_wallpapers', { urls }).catch(console.error);
        } 
      })
      .catch(e => {
        if (e.name !== 'AbortError') {
          console.error('Failed to fetch wallpapers:', e);
          setFetchError(!hasCachedCatalogRef.current);
        }
      })
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!fetching) {
      const timer = setTimeout(() => setShowSplash(false), 150);
      return () => clearTimeout(timer);
    }
  }, [fetching]);

  useEffect(() => {
    if (defaultDownloadPath) {
      localStorage.setItem('cozy_download_path', defaultDownloadPath);
    } else {
      localStorage.removeItem('cozy_download_path');
    }
  }, [defaultDownloadPath]);

  useEffect(() => {
    localStorage.setItem('cozy_localFolders', JSON.stringify(localFolders));
    let cancelled = false;
    async function scanLocal() {
       try {
         const results = await Promise.allSettled(
           localFolders.map(folder => invoke('scan_local_directory', { path: folder }))
         );
         if (cancelled) return;
         let arr = [];
         results.forEach((res, i) => {
           if (res.status === 'fulfilled') {
             const folder = localFolders[i];
             arr.push(...res.value.map(p => {
               const pClean = p.replace(/\\/g, '/');
               const localUrl = convertFileSrc(pClean);
               return {
                 name: pClean.split('/').pop(),
                 path: localUrl,
                 realPath: pClean,
                 category: `Local: ${folder.split('\\').pop()?.split('/').pop()}`,
                 downloadPath: localUrl
               };
             }));
           } else {
             console.error('Local scan error:', res.reason);
           }
         });
         setCustomWallpapers(arr);
       } catch (e) {
         console.error('Parallel scan error:', e);
       }
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
    if (autoRotate && rotateStatus) {
      const pool = allWallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: w.realPath || (w.path.startsWith('http') || w.path.startsWith('asset://') ? w.path : `${STATIC_URL}${w.path}`) }));
      
      if (pool.length > 0) {
        invoke('start_auto_rotate', { 
          intervalMs: rotateInterval, 
          wallpapers: pool,
          startIndex: 0,
          initialDelayMs: rotateInterval
        }).catch(err => console.error(err));
      } else {
        invoke('stop_auto_rotate').catch(err => console.error(err));
      }
    }
  }, [rotateCategory, allWallpapers]);

  useEffect(() => {
    if (manualRotateRef.current) {
      manualRotateRef.current = false;
      return;
    }
    if (autoRotate && categoryCounts.All > 0 && !rotateStatus) {
      const pool = allWallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: w.realPath || (w.path.startsWith('http') || w.path.startsWith('asset://') ? w.path : `${STATIC_URL}${w.path}`) }));
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
    if (!wallpaper?.path) {
      addToast('Wallpaper is unavailable', 'error');
      return false;
    }
    const url = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('asset://') 
       ? wallpaper.path 
       : `${STATIC_URL}${wallpaper.path}`;
       
    const rustUrl = wallpaper.realPath || (url.startsWith('asset://localhost/') ? url.replace('asset://localhost/', '') : url);
       
    const isAnimatedDesktop = wallpaper.path.toLowerCase().endsWith('.mp4') || wallpaper.path.toLowerCase().endsWith('.webm') || wallpaper.path.toLowerCase().endsWith('.mkv') || wallpaper.path.toLowerCase().endsWith('.gif');
       
    setSettingWallpaper(wallpaper.path);
    try {
      if (isAnimatedDesktop) {
        const playerUrl = rustUrl.startsWith('http://') || rustUrl.startsWith('https://')
          ? rustUrl
          : convertFileSrc(rustUrl);
        await invoke('set_video_wallpaper', { url: rustUrl, playerUrl });
      } else {
        await invoke('set_wallpaper', { url: rustUrl });
      }
      addToast('Wallpaper set', 'wallpaper');
      return true;
    } catch (err) {
      addToast(`${err}`, 'error');
      return false;
    } finally {
      setSettingWallpaper(null);
    }
  }, [addToast]);

  const handleSetLockScreen = useCallback(async (wallpaper) => {
    if (!wallpaper?.path) {
      addToast('Wallpaper is unavailable', 'error');
      return false;
    }
    const url = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('asset://') 
       ? wallpaper.path 
       : `${STATIC_URL}${wallpaper.path}`;
       
    const rustUrl = wallpaper.realPath || (url.startsWith('asset://localhost/') ? url.replace('asset://localhost/', '') : url);

    setSettingLockScreen(wallpaper.path);
    try {
      await invoke('set_lock_screen', { url: rustUrl });
      addToast('Lock screen updated', 'success');
      return true;
    } catch (err) {
      addToast(`${err}`, 'error');
      return false;
    } finally {
      setSettingLockScreen(null);
    }
  }, [addToast]);

  const handleDownload = useCallback(async (wallpaper) => {
    if (!wallpaper?.path) {
      addToast('Wallpaper is unavailable', 'error');
      return;
    }
    const url = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('asset://') 
      ? wallpaper.path 
      : `${STATIC_URL}${wallpaper.path}`;
      let filename = wallpaper.name || 'wallpaper';
  
      let extension = wallpaper.path.split('.').pop()?.toLowerCase();
      if (extension && extension.includes('?')) extension = extension.split('?')[0];
      if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(extension)) {
        extension = 'jpg';
      }
      
      const filenameExt = filename.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(filenameExt)) {
        filename = `${filename}.${extension}`;
      }

    try {
        let filePath;
        
        if (defaultDownloadPath) {
          const separator = defaultDownloadPath.includes('\\') ? '\\' : '/';
          filePath = defaultDownloadPath.endsWith(separator) ? `${defaultDownloadPath}${filename}` : `${defaultDownloadPath}${separator}${filename}`;
        } else {
          filePath = await save({
            defaultPath: filename,
            filters: [{
              name: 'Image',
              extensions: [extension]
            }]
          });
    
          if (!filePath) return;
    
          if (!filePath.toLowerCase().endsWith('.' + extension)) {
            filePath = filePath + '.' + extension;
          }
        }
  
      addToast('Downloading wallpaper...', 'info');

      if (wallpaper.realPath) {
        await invoke('copy_local_wallpaper', { source: wallpaper.realPath, dest: filePath });
      } else {
        await invoke('download_and_save_wallpaper', { url, path: filePath });
      }
      
      addToast(`Saved ${filename}`, 'success');
    } catch (err) {
      console.error(err);
      addToast(`Error: ${err.message || err}`, 'error');
    }
  }, [addToast, defaultDownloadPath]);

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
        .map(w => ({ name: w.name, url: w.realPath || (w.path.startsWith('http') || w.path.startsWith('asset://') ? w.path : `${STATIC_URL}${w.path}`) }));
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

  const toggleSelection = useCallback((wallpaper) => {
    setSelectedWallpapers(prev => 
      prev.includes(wallpaper.path) 
        ? prev.filter(p => p !== wallpaper.path)
        : [...prev, wallpaper.path]
    );
  }, []);

  const handleBulkDelete = useCallback(async () => {
    try {
      const count = selectedWallpapers.length;
      if (count === 0) return;
      const confirmed = await customConfirm(`Are you sure you want to permanently delete ${count} selected wallpaper${count > 1 ? 's' : ''}?`, { title: 'Delete Wallpapers', kind: 'warning' });
      if (confirmed) {
        for (const p of selectedWallpapers) {
          const w = customWallpapers.find(cw => cw.path === p);
          if (w) {
            const realPath = w.realPath || w.path;
            await invoke('delete_local_wallpaper', { path: realPath });
          }
        }
        setCustomWallpapers(prev => prev.filter(w => !selectedWallpapers.includes(w.path)));
        setFavorites(prev => {
          const newFavs = prev.filter(p => !selectedWallpapers.includes(p));
          localStorage.setItem('cozy_favorites', JSON.stringify(newFavs));
          return newFavs;
        });
        addToast(`Deleted ${count} wallpapers`, 'success');
        setSelectionMode(false);
        setSelectedWallpapers([]);
      }
    } catch (err) {
      addToast(`${err}`, 'error');
    }
  }, [selectedWallpapers, addToast, customConfirm]);

  const handleDeleteLocal = useCallback(async (wallpaper, isCache = false) => {
    try {
      const confirmed = await customConfirm(
        isCache 
          ? `Are you sure you want to remove "${wallpaper.name}" from local cache?`
          : `Are you sure you want to permanently delete "${wallpaper.name}" from your computer?`, 
        { title: isCache ? 'Clear Cache' : 'Delete Wallpaper', kind: 'warning' }
      );
      if (confirmed) {
        if (isCache) {
          const cacheUrl = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('asset://')
            ? wallpaper.path
            : `${STATIC_URL}${wallpaper.path}`;
          await invoke('delete_cached_wallpaper', { url: cacheUrl });
          window.dispatchEvent(new CustomEvent('cozy-cache-cleared', { detail: cacheUrl }));
          addToast(`Removed ${wallpaper.name} from cache`, 'success');
        } else {
          const realPath = wallpaper.realPath || wallpaper.path;
          await invoke('delete_local_wallpaper', { path: realPath });
          setCustomWallpapers(prev => prev.filter(w => w.path !== wallpaper.path));
          setFavorites(prev => {
            const newFavs = prev.filter(p => p !== wallpaper.path);
            localStorage.setItem('cozy_favorites', JSON.stringify(newFavs));
            return newFavs;
          });
          addToast(`Deleted ${wallpaper.name}`, 'success');
        }
      }
    } catch (err) {
      console.error(err);
      addToast(`Error: ${err}`, 'error');
    }
  }, [addToast, customConfirm]);

  const toggleFavorite = useCallback((wallpaper) => {
    setFavorites(prev => {
      const isFav = prev.includes(wallpaper.path);
      const newFavs = isFav ? prev.filter(p => p !== wallpaper.path) : [...prev, wallpaper.path];
      localStorage.setItem('cozy_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  }, []);

  const prevCustomWallpapersLength = useRef(customWallpapers.length);
  useEffect(() => {
    if (autoRotate && customWallpapers.length < prevCustomWallpapersLength.current) {
      const pool = allWallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: w.realPath || (w.path.startsWith('http') || w.path.startsWith('asset://') ? w.path : `${STATIC_URL}${w.path}`) }));
      
      if (pool.length > 0) {
        invoke('start_auto_rotate', { 
          intervalMs: rotateInterval, 
          wallpapers: pool,
          startIndex: 0,
          initialDelayMs: rotateInterval
        }).catch(console.error);
      } else {
        invoke('stop_auto_rotate').catch(console.error);
      }
    }
    prevCustomWallpapersLength.current = customWallpapers.length;
  }, [customWallpapers.length, autoRotate, allWallpapers, rotateCategory, rotateInterval]);

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

            <div className="panel-row" onClick={async () => {
              const selected = await open({ directory: true, multiple: false });
              if (selected) {
                setDefaultDownloadPath(selected);
                addToast('Download folder set', 'success');
              }
            }} style={{ cursor: 'pointer' }}>
              <div className="panel-icon-wrap" style={{ width: '32px', height: '32px' }}>
                <LuDownload size={14} />
              </div>
              <div className="panel-text">
                <span className="panel-title">Download Folder</span>
                <span className="panel-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                  {defaultDownloadPath || 'Ask every time'}
                </span>
              </div>
              {defaultDownloadPath && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setDefaultDownloadPath(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--md-sys-color-outline)', cursor: 'pointer', padding: '4px' }}
                  title="Clear default folder"
                >
                  <LuX size={14} />
                </button>
              )}
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
            {category.startsWith('Local:') && (
              selectionMode ? (
                <>
                  <button className="topbar__btn" onClick={() => { setSelectionMode(false); setSelectedWallpapers([]); }}>Cancel</button>
                  <button className="topbar__btn topbar__btn--danger" onClick={handleBulkDelete} disabled={selectedWallpapers.length === 0}>
                    <LuTrash size={15} /> Delete ({selectedWallpapers.length})
                  </button>
                </>
              ) : (
                <button className="topbar__btn" onClick={() => setSelectionMode(true)}>
                  <LuMousePointerClick size={15} /> Select
                </button>
              )
            )}
            <div className="topbar__count" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {category !== 'All' && (
                <>
                  <span style={{ fontWeight: 600 }}>{category}</span>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', opacity: 0.4 }} />
                </>
              )}
              <span style={{ opacity: 0.75 }}>{filtered.length} wallpaper{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div ref={galleryRef} className="gallery" style={{ position: 'relative' }}>
          {displayedWallpapers.map((w, i) => (
            <WallpaperCard
              key={`${w.category}-${w.name}-${i}`}
              wallpaper={w}
              onSetWallpaper={handleSetWallpaper}
              onPreview={handlePreview}
              onDownload={handleDownload}
              setting={settingWallpaper === w.path}
              selectionMode={selectionMode}
              isSelected={selectedWallpapers.includes(w.path)}
              onToggleSelect={toggleSelection}
              onDelete={handleDeleteLocal}
              isFavorite={favorites.includes(w.path)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {filtered.length > displayCount && (
            <div key={`${category}-${deferredSearch}`} ref={loaderRef} style={{ width: '100%', height: '40px', gridColumn: '1 / -1', contentVisibility: 'auto' }} />
          )}
        </div>
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
      </main>

      
      
      <ConfirmModal 
        show={confirmState.show}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={() => {
          setConfirmState(s => ({ ...s, show: false }));
          if (confirmState.resolve) confirmState.resolve(true);
        }}
        onCancel={() => {
          setConfirmState(s => ({ ...s, show: false }));
          if (confirmState.resolve) confirmState.resolve(false);
        }}
      />

      <div className="toasts" aria-live="polite" aria-label="Notifications">
        <AnimatePresence mode="wait">
          {toast && (
            <Toast key={toast.id} message={toast.message} type={toast.type} />
          )}
        </AnimatePresence>
      </div>

      <UpdateModal
        show={updateModal.show}
        state={updateModal.state}
        version={updateModal.version}
        progress={updateModal.progress}
        errorMsg={updateModal.error}
        onClose={closeUpdateModal}
        onInstall={handleInstallUpdate}
      />
    </div>
  );
}




