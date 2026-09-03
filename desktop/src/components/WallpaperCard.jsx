import React, { useState, useMemo } from 'react';
import { LuImage, LuRefreshCw, LuMonitor, LuDownload, LuStar, LuTrash, LuPlay } from 'react-icons/lu';
import { formatWallpaperName } from '../utils.js';
import { useCachedImage } from '../useCachedImage.js';

const STATIC_URL = 'https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@f86b8925c715881b33e50f70f34ef8898851a31e/frontend/public';

export const WallpaperCard = React.memo(({ wallpaper, onSetWallpaper, onPreview, onDownload, setting, isFavorite, onToggleFavorite, onDelete, selectionMode, isSelected, onToggleSelect }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imageFallback, setImageFallback] = useState(false);
  const baseImageUrl = useMemo(() => 
    wallpaper.path.startsWith('http') || wallpaper.path.startsWith('asset://') 
      ? wallpaper.path 
      : `${STATIC_URL}${wallpaper.path}`,
    [wallpaper.path]
  );
  
  const cachedImageUrl = useCachedImage(baseImageUrl);
  const imageUrl = imageFallback ? baseImageUrl : (cachedImageUrl || baseImageUrl);

  const handleImageError = () => {
    if (!imageFallback && cachedImageUrl !== baseImageUrl) {
      setImageFallback(true);
      setLoaded(false);
    } else {
      setError(true);
    }
  };

  const displayName = useMemo(() => formatWallpaperName(wallpaper.name), [wallpaper.name]);

  const isVideo = useMemo(() => {
    const p = wallpaper.path.toLowerCase();
    return p.endsWith('.mp4') || p.endsWith('.webm') || p.endsWith('.mkv');
  }, [wallpaper.path]);

  return (
    <div
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
      {error ? (
        <div className="card__error"><LuImage size={22} /><span>Failed to load</span></div>
      ) : isVideo ? (
        <video
          src={imageUrl}
          className="card__img"
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setLoaded(true)}
          onError={handleImageError}
        />
      ) : (
        <img
          src={imageUrl}
          alt={displayName}
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
          className="card__img"
          loading="lazy"
          fetchPriority="low"
          decoding="async"
        />
      )}
      
      {isVideo && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '12px', zIndex: 5 }}>
          <LuPlay size={14} color="#fff" />
        </div>
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
            ) : cachedImageUrl && cachedImageUrl.startsWith('asset://') ? (
              <button
                className="card__btn card__btn--danger"
                onClick={e => { e.stopPropagation(); onDelete && onDelete(wallpaper, true); }}
                title="Remove from Cache"
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
