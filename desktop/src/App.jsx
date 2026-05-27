import React, { useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { check } from '@tauri-apps/plugin-updater';
import { open } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { motion, AnimatePresence } from 'motion/react';
import {
  LuSearch, LuDownload, LuImage, LuLayoutGrid,
  LuSettings, LuRefreshCw, LuCheck, LuX, LuTrash,
  LuMonitor, LuClock, LuSparkles, LuSun, LuMoon,
  LuChevronDown, LuChevronUp, LuChevronLeft, LuChevronRight,
  LuFolderPlus, LuGlobe
} from 'react-icons/lu';
import './App.css';

const UpdateModal = ({ show, onClose, state, version, progress, errorMsg, onInstall }) => {
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

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      className={`toast toast--${type}`}
      initial={{ opacity: 0, y: 20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.94 }}
      transition={{ duration: 0.22 }}
    >
      {type === 'success' && <LuCheck size={14} />}
      {type === 'error' && <LuX size={14} />}
      {type === 'wallpaper' && <LuMonitor size={14} />}
      {type === 'rotate' && <LuRefreshCw size={14} />}
      <span>{message}</span>
    </motion.div>
  );
};

const WallpaperCard = React.memo(({ wallpaper, onSetWallpaper, onPreview, setting }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const cardRef = useRef(null);

  const baseImageUrl = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') 
    ? wallpaper.path 
    : `${STATIC_URL}${wallpaper.path}`;

  const displayName = wallpaper.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  useEffect(() => {
    let isMounted = true;
    
    if (baseImageUrl.startsWith('http')) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          
          invoke('fetch_image_bytes', { url: baseImageUrl })
            .then(bytes => {
              if (!isMounted) return;
              const blob = new Blob([new Uint8Array(bytes)]);
              setImgSrc(URL.createObjectURL(blob));
            })
            .catch(err => {
              if (!isMounted) return;
              console.error("Failed to proxy image:", err);
              setImgSrc(baseImageUrl);
            });
        }
      }, { rootMargin: '300px' });
      
      if (cardRef.current) observer.observe(cardRef.current);
      
      return () => {
        isMounted = false;
        observer.disconnect();
      };
    } else {
      setImgSrc(baseImageUrl);
    }
  }, [baseImageUrl]);

  return (
    <div
      ref={cardRef}
      className="card fade-in"
      onClick={() => loaded && onPreview(wallpaper)}
      onDoubleClick={() => loaded && onSetWallpaper(wallpaper)}
    >
      {!loaded && !error && <div className="card__skeleton" />}
      {error ? (
        <div className="card__error"><LuImage size={22} /><span>Failed to load</span></div>
      ) : (
        imgSrc && <img
          src={imgSrc}
          alt={displayName}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className="card__img"
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
              disabled={setting}
            >
              {setting ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
            </button>
            <a
              href={wallpaper.downloadPath || imageUrl}
              download={wallpaper.name}
              className="card__btn"
              onClick={e => e.stopPropagation()}
              title="Download"
            >
              <LuDownload size={15} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
});

const Lightbox = ({ wallpaper, onClose, onSetWallpaper, onSetLockScreen, setting, settingLock, onNext, onPrev, hasNext, hasPrev }) => {
  const [imgSrc, setImgSrc] = useState(null);

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
    if (!wallpaper) return;
    const baseImageUrl = wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') ? wallpaper.path : `${STATIC_URL}${wallpaper.path}`;
    
    if (wallpaper.path.startsWith('http')) {
      invoke('fetch_image_bytes', { url: wallpaper.path })
        .then(bytes => {
          if (!isMounted) return;
          const blob = new Blob([new Uint8Array(bytes)]);
          setImgSrc(URL.createObjectURL(blob));
        })
        .catch(err => {
          if (!isMounted) return;
          setImgSrc(baseImageUrl);
        });
    } else {
      setImgSrc(baseImageUrl);
    }
    
    return () => { isMounted = false; };
  }, [wallpaper]);

  if (!wallpaper) return null;
  const displayName = wallpaper.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <motion.div className="lightbox" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="lightbox__box" onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}>
        {hasPrev && (
          <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); onPrev(); }}>
            <LuChevronLeft size={24} />
          </button>
        )}
        {imgSrc && <img src={imgSrc} alt={displayName} className="lightbox__img" />}
        {hasNext && (
          <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); onNext(); }}>
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
              >
                {setting ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
                {setting ? 'Setting...' : 'Set as Wallpaper'}
              </button>
              <button
                className={`lb-btn lb-btn--ghost ${settingLock ? 'loading' : ''}`}
                onClick={() => onSetLockScreen(wallpaper)}
                disabled={setting || settingLock}
                title="Set as Windows Lock Screen"
              >
                {settingLock ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
                {settingLock ? 'Setting...' : 'Lock Screen'}
              </button>
            </div>
            <a href={wallpaper.downloadPath || (wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') ? wallpaper.path : `${STATIC_URL}${wallpaper.path}`)} download={wallpaper.name} className="lb-btn lb-btn--ghost">
              <LuDownload size={15} /> Download
            </a>
          </div>
          <button className="lightbox__close" onClick={onClose}><LuX size={16} /></button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [wallpapers, setWallpapers] = useState([]);
  const [localFolders, setLocalFolders] = useState(() => JSON.parse(localStorage.getItem('cozy_localFolders') || '[]'));
  const [webUrls, setWebUrls] = useState(() => JSON.parse(localStorage.getItem('cozy_webUrls') || '[]'));
  const [customWallpapers, setCustomWallpapers] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showWebModal, setShowWebModal] = useState(false);
  const [webInputUrl, setWebInputUrl] = useState('');
  const [isFetchingWeb, setIsFetchingWeb] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [displayCount, setDisplayCount] = useState(48);
  const [preview, setPreview] = useState(null);
  const [settingWallpaper, setSettingWallpaper] = useState(null);
  const [settingLockScreen, setSettingLockScreen] = useState(null);
  const [dark, setDark] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [toasts, setToasts] = useState([]);
  
  const intervals = [
    { label: '5m', value: 5 * 60 * 1000 },
    { label: '15m', value: 15 * 60 * 1000 },
    { label: '30m', value: 30 * 60 * 1000 },
    { label: '1h', value: 60 * 60 * 1000 },
  ];
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

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/wallpapers`)
      .then(r => r.json())
      .then(d => Array.isArray(d) && setWallpapers(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('cozy_localFolders', JSON.stringify(localFolders));
    async function scanLocal() {
       let arr = [];
       for (let folder of localFolders) {
           try {
              let paths = await invoke('scan_local_directory', { path: folder });
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
       setCustomWallpapers(prev => {
         const webOnly = prev.filter(w => w.category.startsWith('Web:'));
         return [...arr, ...webOnly];
       });
    }
    scanLocal();
  }, [localFolders]);

  useEffect(() => {
    localStorage.setItem('cozy_webUrls', JSON.stringify(webUrls));
    if (webUrls.length === 0) {
      setCustomWallpapers(prev => prev.filter(w => !w.category.startsWith('Web:')));
      setIsFetchingWeb(false);
      return;
    }
    async function fetchWeb() {
       setIsFetchingWeb(true);
       let webArr = [];
       for (let url of webUrls) {
           try {
              let urls = await invoke('fetch_web_images', { url });
              if (urls.length === 0) {
                addToast(`No images found on ${new URL(url).hostname}`, 'error');
              } else {
                addToast(`Found ${urls.length} images from ${new URL(url).hostname}`, 'success');
              }
              webArr.push(...urls.map(u => ({
                 name: u.split('/').pop().split('?')[0] || 'Web Image',
                 path: u,
                 category: `Web: ${new URL(url).hostname}`,
                 downloadPath: u,
              })));
           } catch (e) {
             console.error('Web fetch error:', e);
             addToast(`Failed to fetch from ${url}: ${e}`, 'error');
           }
       }
       setCustomWallpapers(prev => {
         const localOnly = prev.filter(w => w.category.startsWith('Local:'));
         return [...localOnly, ...webArr];
       });
       setIsFetchingWeb(false);
    }
    fetchWeb();
  }, [webUrls, addToast]);
  
  const [updateModal, setUpdateModal] = useState({ show: false, state: 'checking', version: '', progress: 0, error: '' });
  const pendingUpdateRef = useRef(null);

  const showUpdateModal = useCallback((s) => setUpdateModal(prev => ({ ...prev, show: true, ...s })), []);
  const closeUpdateModal = useCallback(() => setUpdateModal(prev => ({ ...prev, show: false })), []);

  const performUpdate = useCallback(async (manual = false) => {
    showUpdateModal({ state: 'checking', version: '', progress: 0, error: '' });
    try {
      const update = await check();
      if (update) {
        pendingUpdateRef.current = update;
        showUpdateModal({ state: 'available', version: update.version });
      } else if (manual) {
        const currentVersion = '1.0.5';
        showUpdateModal({ state: 'uptodate', version: currentVersion });
      } else {
        closeUpdateModal();
      }
    } catch (err) {
      if (manual) {
        showUpdateModal({ state: 'error', error: String(err) });
      } else {
        closeUpdateModal();
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
      addToast(`Wallpaper rotated`, 'rotate');
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
      addToast('Desktop background updated', 'success');
    } catch (err) {
      addToast(`Failed: ${err}`, 'error');
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
      addToast('Lock screen updated successfully', 'success');
    } catch (err) {
      addToast(`Failed: ${err}`, 'error');
    } finally {
      setSettingLockScreen(null);
    }
  }, [addToast]);

  const handleToggleRotate = useCallback(async () => {
    if (autoRotate) {
      setAutoRotate(false);
      setRotateStatus(false);
      try { await invoke('stop_auto_rotate'); await disable(); } catch {}
      addToast('Auto-rotate stopped', 'rotate');
    } else {
      setAutoRotate(true);
      const pool = wallpapers
        .filter(w => rotateCategory === 'All' || w.category === rotateCategory)
        .map(w => ({ name: w.name, url: `${STATIC_URL}${w.path}` }));
      if (!pool.length) { addToast('No wallpapers in category', 'error'); return; }
      try {
        await invoke('start_auto_rotate', { 
          intervalMs: rotateInterval, 
          wallpapers: pool,
          startIndex: 0,
          initialDelayMs: rotateInterval
        });
        await enable();
        setRotateStatus(true);
        addToast(`Auto-rotate enabled (${rotateInterval / 60000}m)`, 'rotate');
      } catch (err) {
        addToast(`Error: ${err}`, 'error');
        setAutoRotate(false);
      }
    }
  }, [autoRotate, wallpapers, rotateInterval, rotateCategory, addToast]);

  const allWallpapers = [...customWallpapers, ...wallpapers];
  const categories = [...new Set(allWallpapers.map(w => w.category))];

  const filtered = allWallpapers
    .filter(w => category === 'All' || w.category === category)
    .filter(w => {
      if (!deferredSearch.trim()) return true;
      const q = deferredSearch.toLowerCase();
      return w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q);
    });

  return (
    <div className="app">
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
            const isCustom = cat.startsWith('Local:') || cat.startsWith('Web:');
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
                    onClick={(e) => {
                      e.stopPropagation();
                      if (cat.startsWith('Local:')) {
                        const folderName = cat.replace('Local: ', '');
                        setLocalFolders(fs => fs.filter(f => !f.endsWith(folderName)));
                      } else {
                        const hostname = cat.replace('Web: ', '');
                        setWebUrls(ws => ws.filter(w => {
                          try { return !new URL(w).hostname.includes(hostname); } catch { return true; }
                        }));
                      }
                      if (category === cat) setCategory('All');
                      addToast('Removed', 'success');
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
                 addToast('Local folder added', 'success');
              }
            }}>
              <LuFolderPlus size={15} />
              <span>Add Local Folder</span>
            </button>
            <button className="nav__item" onClick={() => setShowWebModal(true)}>
              <LuGlobe size={15} />
              <span>Fetch from Web</span>
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
              <div className={`premium-toggle ${dark ? 'on' : ''}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right', pointerEvents: 'none' }}>
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
              <div className={`premium-toggle ${autoRotate ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); handleToggleRotate(); }} style={{ transform: 'scale(0.85)', transformOrigin: 'right' }}>
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
            <span className="nav__badge" style={{ fontSize: '10px', opacity: 0.5 }}>v1.0.5</span>
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
            />
          </div>
          <div className="topbar__right">
            <span className="topbar__count">{filtered.length} curated</span>
          </div>
        </div>

        <div className="gallery" style={{ position: 'relative' }}>
          <AnimatePresence>
            {isFetchingWeb && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(28, 28, 30, 0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                  gap: '20px'
                }}
              >
                <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                  <svg className="spin" viewBox="0 0 50 50" style={{ width: '100%', height: '100%', stroke: 'url(#gradient)', strokeWidth: '4', fill: 'none', strokeLinecap: 'round' }}>
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0A84FF" />
                        <stop offset="100%" stopColor="#5E5CE6" />
                      </linearGradient>
                    </defs>
                    <circle cx="25" cy="25" r="20" strokeDasharray="90, 150" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>Extracting Wallpapers</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Scanning website for high-resolution images...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {filtered.slice(0, displayCount).map((w, i) => (
            <WallpaperCard
              key={w.path}
              wallpaper={w}
              onSetWallpaper={handleSetWallpaper}
              onPreview={setPreview}
              setting={settingWallpaper === w.path}
            />
          ))}
          {filtered.length > displayCount && (
            <div ref={loaderRef} className="loader">
              <div className="spinner"></div> Loading...
            </div>
          )}
          {filtered.length === 0 && wallpapers.length > 0 && (
            <div className="empty"><LuImage size={44} /><p>No wallpapers found</p></div>
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
            setting={settingWallpaper === preview?.path}
            settingLock={settingLockScreen === preview?.path}
            onNext={() => {
              const idx = filtered.findIndex(w => w.path === preview.path);
              if (idx !== -1 && idx < filtered.length - 1) setPreview(filtered[idx + 1]);
            }}
            onPrev={() => {
              const idx = filtered.findIndex(w => w.path === preview.path);
              if (idx > 0) setPreview(filtered[idx - 1]);
            }}
            hasNext={filtered.findIndex(w => w.path === preview?.path) < filtered.length - 1}
            hasPrev={filtered.findIndex(w => w.path === preview?.path) > 0}
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

      <AnimatePresence>
        {showWebModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999
            }}
            onClick={() => { setShowWebModal(false); setWebInputUrl(''); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: 'rgba(28, 28, 30, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '24px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff', letterSpacing: '-0.3px' }}>Fetch Web Images</h3>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                  Enter the URL of a website to fetch all its images.
                </p>
              </div>
              
              <input 
                type="url"
                placeholder="https://example.com"
                value={webInputUrl}
                onChange={e => setWebInputUrl(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (webInputUrl && webInputUrl.startsWith('http')) {
                      if (!webUrls.includes(webInputUrl)) setWebUrls([...webUrls, webInputUrl]);
                      addToast('Fetching from web...', 'rotate');
                      setShowWebModal(false);
                      setWebInputUrl('');
                    } else if (webInputUrl) {
                      addToast('Please enter a valid HTTP URL', 'error');
                    }
                  }
                  if (e.key === 'Escape') { setShowWebModal(false); setWebInputUrl(''); }
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => { setShowWebModal(false); setWebInputUrl(''); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: '#0A84FF',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (webInputUrl && webInputUrl.startsWith('http')) {
                      if (!webUrls.includes(webInputUrl)) setWebUrls([...webUrls, webInputUrl]);
                      addToast('Fetching from web...', 'rotate');
                      setShowWebModal(false);
                      setWebInputUrl('');
                    } else if (webInputUrl) {
                      addToast('Please enter a valid HTTP URL', 'error');
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0A84FF',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: webInputUrl ? 'pointer' : 'default',
                    opacity: webInputUrl ? 1 : 0.5
                  }}
                  disabled={!webInputUrl}
                >
                  Fetch Images
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="toasts">
        <AnimatePresence>
          {toasts.map(t => (
            <Toast key={t.id} message={t.message} type={t.type}
              onClose={() => setToasts(ts => ts.filter(x => x.id !== t.id))} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
