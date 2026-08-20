import React, { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LuImage, LuRefreshCw, LuMonitor, LuDownload, LuStar, LuTrash } from 'react-icons/lu';
import { formatWallpaperName } from '../utils.js';

const STATIC_URL = 'https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@main/frontend/public';

export const WallpaperCard = React.memo(({ wallpaper, onSetWallpaper, onPreview, onDownload, setting, isFavorite, onToggleFavorite, onDelete, selectionMode, isSelected, onToggleSelect }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const cardRef = useRef(null);

  const baseImageUrl = useMemo(() => 
    wallpaper.path.startsWith('http') || wallpaper.path.startsWith('cozy://') 
      ? wallpaper.path 
      : `${STATIC_URL}${wallpaper.path}`,
    [wallpaper.path]
  );

  const displayName = useMemo(() => formatWallpaperName(wallpaper.name), [wallpaper.name]);
  const [retrySrc, setRetrySrc] = useState(null);

  useEffect(() => {
    return () => {
      if (retrySrc) URL.revokeObjectURL(retrySrc);
    };
  }, [retrySrc]);

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
      className={`card fade-in ${selectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect(wallpaper);
        } else if (loaded) {
          onPreview(wallpaper);
        }
      }}
      onDoubleClick={() => !selectionMode && loaded && onSetWallpaper(wallpaper)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loaded && onPreview(wallpaper); } }}
      role="button"
      tabIndex={0}
      aria-label={`${displayName} — ${wallpaper.category}`}
    >
      {selectionMode && (
        <div className="card__checkbox">
          <div className={`checkbox__inner ${isSelected ? 'checked' : ''}`}></div>
        </div>
      )}
      {!loaded && !error && <div className="card__skeleton" />}
      {error && !retrySrc ? (
        <div className="card__error"><LuImage size={22} /><span>Failed to load</span></div>
      ) : (
        <img
          src={retrySrc || baseImageUrl}
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
              className={`card__btn card__btn--set ${isFavorite ? 'active-star' : ''}`}
              onClick={e => { e.stopPropagation(); onToggleFavorite(wallpaper); }}
              title="Toggle Favorite"
            >
              <LuStar size={15} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button
              className={`card__btn card__btn--set ${setting ? 'loading' : ''}`}
              onClick={e => { e.stopPropagation(); onSetWallpaper(wallpaper); }}
              title="Set as Wallpaper (Double-click card)"
              disabled={setting}
            >
              {setting ? <LuRefreshCw size={15} className="spin" /> : <LuMonitor size={15} />}
            </button>
            {wallpaper.category.startsWith('Local:') ? (
              <button
                className="card__btn card__btn--danger"
                onClick={e => { e.stopPropagation(); onDelete && onDelete(wallpaper); }}
                title="Delete local wallpaper"
              >
                <LuTrash size={15} />
              </button>
            ) : (
              <button
                className="card__btn"
                onClick={e => { e.stopPropagation(); onDownload(wallpaper); }}
                title="Download"
              >
                <LuDownload size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
