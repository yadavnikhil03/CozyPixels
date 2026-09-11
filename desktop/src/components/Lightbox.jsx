import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LuChevronLeft, LuChevronRight, LuRefreshCw, LuMonitor, LuDownload, LuX } from 'react-icons/lu';
import { useFocusTrap } from '../useFocusTrap.js';
import { formatWallpaperName } from '../utils.js';
import { useCachedImage } from '../useCachedImage.js';
import { STATIC_URL } from '../constants.js';

export const Lightbox = ({ wallpaper, onClose, onSetWallpaper, onSetLockScreen, onDownload, setting, settingLock, onNext, onPrev, hasNext, hasPrev }) => {
  const [direction, setDirection] = useState(0);
  const [previewFallback, setPreviewFallback] = useState(false);
  const trapRef = useFocusTrap(true);

  const handleNext = () => { setDirection(1); onNext(); };
  const handlePrev = () => { setDirection(-1); onPrev(); };

  useEffect(() => {
    const fn = e => { 
      if (e.key === 'Escape') onClose(); 
      if (e.key === 'ArrowRight' && hasNext) handleNext();
      if (e.key === 'ArrowLeft' && hasPrev) handlePrev();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  useEffect(() => setPreviewFallback(false), [wallpaper?.path]);

  const baseImageUrl = wallpaper?.path?.startsWith('http') || wallpaper?.path?.startsWith('asset://') 
    ? wallpaper.path 
    : `${STATIC_URL}${wallpaper?.path}`;
    
  const cachedUrl = useCachedImage(baseImageUrl);
  const previewUrl = previewFallback ? baseImageUrl : cachedUrl;

  if (!wallpaper) return null;
  const displayName = formatWallpaperName(wallpaper.name);
  const isVideo = wallpaper.path.toLowerCase().endsWith('.mp4') || wallpaper.path.toLowerCase().endsWith('.webm') || wallpaper.path.toLowerCase().endsWith('.mkv');

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
          <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); handlePrev(); }} aria-label="Previous wallpaper">
            <LuChevronLeft size={24} />
          </button>
        )}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
          <AnimatePresence initial={false} custom={direction}>
            {previewUrl && (
              isVideo ? (
                <motion.video 
                  key={wallpaper.path} 
                  src={previewUrl} 
                  onError={() => cachedUrl !== baseImageUrl && setPreviewFallback(true)}
                  className="lightbox__img" 
                  style={{ position: 'absolute', top: 0, left: 0 }}
                  custom={direction}
                  variants={{
                    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
                    center: { x: 0, opacity: 1, zIndex: 1 },
                    exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0, zIndex: 0 })
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <motion.img 
                  key={wallpaper.path} 
                  src={previewUrl} 
                  alt={displayName} 
                  onError={() => cachedUrl !== baseImageUrl && setPreviewFallback(true)}
                  className="lightbox__img" 
                  style={{ position: 'absolute', top: 0, left: 0 }}
                  custom={direction}
                  variants={{
                    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
                    center: { x: 0, opacity: 1, zIndex: 1 },
                    exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0, zIndex: 0 })
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )
            )}
          </AnimatePresence>
        </div>
        {hasNext && (
          <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); handleNext(); }} aria-label="Next wallpaper">
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
              <button
                className={`lb-btn lb-btn--ghost ${(setting || settingLock) ? 'loading' : ''}`}
                onClick={async () => {
                  const wallpaperSet = await onSetWallpaper(wallpaper);
                  if (wallpaperSet) await onSetLockScreen(wallpaper);
                }}
                disabled={setting || settingLock}
                title="Set as Wallpaper & Lock Screen"
                aria-label={`Set ${displayName} as wallpaper and lock screen`}
              >
                {(setting || settingLock) ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
                Set Both
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
