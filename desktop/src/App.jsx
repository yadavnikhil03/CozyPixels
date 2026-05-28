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
  LuFolderPlus, LuTriangleAlert
} from 'react-icons/lu';
import './App.css';

const SplashScreen = ({ visible }) => {
  const circleRef = useRef(null);
  const CIRCUMFERENCE = 2 * Math.PI * 44; // r=44

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 1, 1] }}
        >
          <div className="splash__bg" />

          <div className="splash__content">
            <motion.div
              className="splash__logo-wrap"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <svg className="splash__ring" viewBox="0 0 96 96" fill="none">
                <circle
                  ref={circleRef}
                  cx="48" cy="48" r="44"
                  stroke="url(#splash-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE}
                  className="splash__ring-path"
                />
                <defs>
                  <linearGradient id="splash-grad" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="var(--md-sys-color-primary)" />
                    <stop offset="100%" stopColor="#5E5CE6" />
                  </linearGradient>
                </defs>
              </svg>
              <motion.div
                className="splash__icon"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <LuSparkles size={30} />
              </motion.div>
            </motion.div>

            <motion.h1
              className="splash__title"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              CozyPixels
            </motion.h1>

            <motion.div
              className="splash__bar-track"
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="splash__bar-fill" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const UpdateModal = ({ show, onClose, state, version, progress, errorMsg, onInstall }) => {
  const trapRef = useFocusTrap(show);

  useEffect(() => {
    if (state === 'uptodate') {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, onClose]);

  if (!show) return null;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="update-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={state !== 'downloading' ? onClose : undefined}
          role="dialog" aria-modal="true" aria-label="Update"
          ref={trapRef}
        >
          <motion.div
            className="update-modal"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            onClick={e => e.stopPropagation()}
          >
            {state === 'checking' && (
              <div className="update-content">
                <div className="update-icon-wrap update-icon--checking">
                  <svg className="update-spinner" viewBox="0 0 50 50">
                    <defs>
                      <linearGradient id="update-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--md-sys-color-primary)" />
                        <stop offset="100%" stopColor="#5E5CE6" />
                      </linearGradient>
                    </defs>
                    <circle cx="25" cy="25" r="20" stroke="url(#update-grad)" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="90, 150" />
                  </svg>
                </div>
                <h3 className="update-title">Checking for updates</h3>
                <p className="update-desc">Looking for the latest version...</p>
              </div>
            )}

            {state === 'available' && (
              <div className="update-content">
                <motion.div 
                  className="update-icon-wrap update-icon--available"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                >
                  <LuDownload size={28} />
                </motion.div>
                <h3 className="update-title">Update Available</h3>
                <p className="update-desc">Version <strong>{version}</strong> is ready to install</p>
                <div className="update-actions">
                  <button className="update-btn update-btn--ghost" onClick={onClose}>Later</button>
                  <button className="update-btn update-btn--primary" onClick={onInstall}>
                    <LuDownload size={15} />
                    Install Now
                  </button>
                </div>
              </div>
            )}

            {state === 'uptodate' && (
              <div className="update-content">
                <motion.div 
                  className="update-icon-wrap update-icon--success"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                >
                  <LuCheck size={28} />
                </motion.div>
                <h3 className="update-title">You're up to date!</h3>
                <p className="update-desc">CozyPixels v{version} is the latest version</p>
                <div className="update-actions">
                  <button className="update-btn update-btn--primary" onClick={onClose}>Awesome!</button>
                </div>
              </div>
            )}

            {state === 'downloading' && (
              <div className="update-content">
                <div className="update-icon-wrap update-icon--downloading">
                  <LuDownload size={28} className="update-bounce" />
                </div>
                <h3 className="update-title">Downloading Update</h3>
                <p className="update-desc">Installing v{version}... Please wait</p>
                <div className="update-progress-wrap">
                  <div className="update-progress-track">
                    <motion.div 
                      className="update-progress-fill"
                      initial={{ width: '0%' }}
                      animate={{ width: progress > 0 ? `${progress}%` : '100%' }}
                      transition={progress > 0 ? { duration: 0.3 } : { duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                  {progress > 0 && <span className="update-progress-text">{Math.round(progress)}%</span>}
                </div>
              </div>
            )}

            {state === 'error' && (
              <div className="update-content">
                <motion.div 
                  className="update-icon-wrap update-icon--error"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                >
                  <LuX size={28} />
                </motion.div>
                <h3 className="update-title">Update Failed</h3>
                <p className="update-desc">{errorMsg || 'Could not check for updates'}</p>
                <div className="update-actions">
                  <button className="update-btn update-btn--primary" onClick={onClose}>Close</button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const API_URL = 'https://cozy-pixels.vercel.app/api';
const STATIC_URL = 'https://cozy-pixels.vercel.app';

const Toast = ({ message, type }) => {
  const iconMap = {
    success: { icon: LuCheck, color: '#30D158' },
    error: { icon: LuX, color: '#FF453A' },
    wallpaper: { icon: LuMonitor, color: '#5E5CE6' },
    rotate: { icon: LuRefreshCw, color: '#0A84FF' },
  };
  const { icon: Icon, color } = iconMap[type] || iconMap.success;
  return (
    <motion.div
      className="toast"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300, mass: 0.9 }}
    >
      <div className="toast__icon" style={{ background: color }}>
        <Icon size={16} />
      </div>
      <span className="toast__msg">{message}</span>
    </motion.div>
  );
};

const WallpaperCard = React.memo(({ wallpaper, onSetWallpaper, onPreview, onDownload, setting }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const cardRef = useRef(null);

  const baseImageUrl = useMemo(() => 
    wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') 
      ? wallpaper.path 
      : `${STATIC_URL}${wallpaper.path}`,
    [wallpaper.path]
  );

  const displayName = useMemo(() => wallpaper.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()),
    [wallpaper.name]
  );

  const [retrySrc, setRetrySrc] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl = null;

    if (baseImageUrl.startsWith('http')) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          setImgSrc(baseImageUrl);
        }
      }, { rootMargin: '300px' });

      if (cardRef.current) observer.observe(cardRef.current);

      return () => {
        isMounted = false;
        observer.disconnect();
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
      };
    } else {
      setImgSrc(baseImageUrl);
    }
  }, [baseImageUrl]);

  useEffect(() => {
    if (!error || !baseImageUrl.startsWith('http') || retrySrc) return;
    (async () => {
      try {
        const bytes = await invoke('fetch_image_bytes', { url: baseImageUrl });
        const blob = new Blob([new Uint8Array(bytes)]);
        setRetrySrc(URL.createObjectURL(blob));
      } catch {
      }
    })();
  }, [error, baseImageUrl, retrySrc]);

  return (
    <div
      ref={cardRef}
            className="card fade-in"
      onClick={() => loaded && onPreview(wallpaper)}
      onDoubleClick={() => loaded && onSetWallpaper(wallpaper)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loaded && onPreview(wallpaper); } }}
      role="button"
      tabIndex={0}
      aria-label={`${displayName} — ${wallpaper.category}`}
    >
      {!loaded && !error && <div className="card__skeleton" />}
      {error && !retrySrc ? (
        <div className="card__error"><LuImage size={22} /><span>Failed to load</span></div>
      ) : (
        imgSrc && <img
          src={retrySrc || imgSrc}
          alt={displayName}
          onLoad={() => setLoaded(true)}
          onError={() => !retrySrc && setError(true)}
          className="card__img"
          loading="lazy"
          decoding="async"
        />
      )}
      {loaded && (
        <div className="card__overlay">
          <div className="card__meta">
            <span className="card__cat">{wallpaper.category}</span>
            <span className="card__name">{displayName}</span>
          </div>
          <div className="card__actions">
            <button
              className={`card__btn card__btn--set ${setting ? 'loading' : ''}`}
              onClick={e => { e.stopPropagation(); onSetWallpaper(wallpaper); }}
              title="Set as Wallpaper"
              aria-label={`Set ${displayName} as wallpaper`}
              disabled={setting}
            >
              {setting ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
            </button>
            <button
              className="card__btn"
              onClick={e => { e.stopPropagation(); onDownload(wallpaper); }}
              title="Download"
              aria-label={`Download ${displayName}`}
            >
              <LuDownload size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const Lightbox = ({ wallpaper, onClose, onSetWallpaper, onSetLockScreen, onDownload, setting, settingLock, onNext, onPrev, hasNext, hasPrev }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const trapRef = useFocusTrap(true);

  useEffect(() => {
    const fn = e => { 
      if (e.key === 'Escape') onClose(); 
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl = null;
    if (!wallpaper) return;
    const baseImageUrl = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') ? wallpaper.path : `${STATIC_URL}${wallpaper.path}`;
    
    if (wallpaper.path.startsWith('http')) {
      invoke('fetch_image_bytes', { url: wallpaper.path })
        .then(bytes => {
          if (!isMounted) return;
          const blob = new Blob([new Uint8Array(bytes)]);
          currentBlobUrl = URL.createObjectURL(blob);
          setImgSrc(currentBlobUrl);
        })
        .catch(err => {
          if (!isMounted) return;
          setImgSrc(baseImageUrl);
        });
    } else {
      setImgSrc(baseImageUrl);
    }
    
    return () => {
      isMounted = false;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [wallpaper]);

  if (!wallpaper) return null;
  const displayName = wallpaper.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <motion.div className="lightbox" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label={`Preview: ${displayName}`}
      ref={trapRef}>
      <motion.div className="lightbox__box" onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}>
        {hasPrev && (
          <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous wallpaper">
            <LuChevronLeft size={24} />
          </button>
        )}
        {imgSrc && <img src={imgSrc} alt={displayName} className="lightbox__img" />}
        {hasNext && (
          <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next wallpaper">
            <LuChevronRight size={24} />
          </button>
        )}
        <div className="lightbox__bar">
          <div className="lightbox__meta">
            <span className="lightbox__name">{displayName}</span>
            <span className="lightbox__cat">{wallpaper.category}</span>
          </div>

          <div className="lightbox__actions">
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`lb-btn lb-btn--primary ${setting ? 'loading' : ''}`}
                onClick={() => onSetWallpaper(wallpaper)}
                disabled={setting || settingLock}
                aria-label={`Set ${displayName} as wallpaper`}
              >
                {setting ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
                {setting ? 'Setting...' : 'Set as Wallpaper'}
              </button>
              <button
                className={`lb-btn lb-btn--ghost ${settingLock ? 'loading' : ''}`}
                onClick={() => onSetLockScreen(wallpaper)}
                disabled={setting || settingLock}
                title="Set as Windows Lock Screen"
                aria-label={`Set ${displayName} as lock screen`}
              >
                {settingLock ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
                {settingLock ? 'Setting...' : 'Lock Screen'}
              </button>
            </div>
            <button className="lb-btn lb-btn--ghost" onClick={() => onDownload(wallpaper)} aria-label={`Download ${displayName}`}>
              <LuDownload size={15} /> Download
            </button>
          </div>
          <button className="lightbox__close" onClick={onClose} aria-label="Close lightbox"><LuX size={16} /></button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [wallpapers, setWallpapers] = useState([]);
  const [localFolders, setLocalFolders] = useState(() => JSON.parse(localStorage.getItem('cozy_localFolders') || '[]'));
  const [customWallpapers, setCustomWallpapers] = useState([]);
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

    fetch(`${API_URL}/wallpapers`, { signal: controller.signal })
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
                 const localUrl = convertFileSrc(pClean);
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
    if (manual) showUpdateModal({ state: 'checking', version: '', progress: 0, error: '' });
    try {
      const update = await check();
      if (update) {
        pendingUpdateRef.current = update;
        showUpdateModal({ state: 'available', version: update.version });
      } else if (manual) {
        const currentVersion = '1.0.6';
        showUpdateModal({ state: 'uptodate', version: currentVersion });
      }
    } catch (err) {
      if (manual) {
        showUpdateModal({ state: 'error', error: String(err) });
      } else {
        console.error('Update check failed:', err);
      }
    }
  }, [showUpdateModal, closeUpdateModal]);

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
      await relaunch();
    } catch (err) {
      showUpdateModal({ state: 'error', error: String(err) });
    }
  }, [showUpdateModal]);

  useEffect(() => { performUpdate(false); }, []);

  const handleManualUpdateCheck = useCallback(() => performUpdate(true), [performUpdate]);


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
    if (autoRotate && wallpapers.length > 0 && !rotateStatus) {
      const pool = wallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: `${STATIC_URL}${w.path}` }));
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
  }, [wallpapers, autoRotate, rotateCategory, rotateInterval, rotateStatus, addToast]);

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
      const pool = wallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: `${STATIC_URL}${w.path}` }));
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
  }, [autoRotate, wallpapers, rotateInterval, rotateCategory, addToast]);

  const allWallpapers = useMemo(() => [...customWallpapers, ...wallpapers], [customWallpapers, wallpapers]);
  const categories = useMemo(() => [...new Set(allWallpapers.map(w => w.category))], [allWallpapers]);

  const filtered = useMemo(() => {
    return allWallpapers
      .filter(w => category === 'All' || w.category === category)
      .filter(w => {
        if (!deferredSearch.trim()) return true;
        const q = deferredSearch.toLowerCase();
        return w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q);
      });
  }, [allWallpapers, category, deferredSearch]);

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
          <LuSparkles size={18} />
          <span>CozyPixels</span>
        </div>

        <nav className="nav">
          <button className={`nav__item ${category === 'All' ? 'active' : ''}`} onClick={() => setCategory('All')}>
            <LuLayoutGrid size={15} />
            <span>All wallpapers</span>
            <span className="nav__badge">{allWallpapers.length}</span>
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
                  <span className="nav__badge">{allWallpapers.filter(w => w.category === cat).length}</span>
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

          <button className="nav__item" onClick={handleManualUpdateCheck} style={{ marginTop: '4px' }}>
            <LuDownload size={15} />
            <span>Check for updates</span>
            <span className="nav__badge" style={{ fontSize: '10px', opacity: 0.5 }}>v1.0.6</span>
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
          </div>
          <div className="topbar__right">
            <span className="topbar__count">{filtered.length} curated</span>
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
                fetch(`${API_URL}/wallpapers`)
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
            key={preview.path}
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
