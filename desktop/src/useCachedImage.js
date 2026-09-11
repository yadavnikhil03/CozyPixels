import { useState, useEffect } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const invoke = (...args) => window.__TAURI_INTERNALS__
  ? tauriInvoke(...args)
  : Promise.reject(new Error('Desktop cache is unavailable in browser mode'));

export function useCachedImage(url) {
  const [src, setSrc] = useState(url);

  useEffect(() => {
    let isMounted = true;
    
    if (!url || !url.startsWith('http')) {
      setSrc(url);
      return;
    }

    if (url.startsWith('http://asset.localhost') || url.startsWith('https://asset.localhost')) {
      setSrc(url);
      return;
    }

    setSrc(url);

    invoke('get_cached_image', { url })
      .then(cachedUrl => {
        if (isMounted && cachedUrl?.startsWith('asset://localhost/')) {
          setSrc(cachedUrl);
        }
      })
      .catch(() => {
      });

    const handleCacheCleared = event => {
      if (event.detail === url) setSrc(url);
    };
    window.addEventListener('cozy-cache-cleared', handleCacheCleared);

    return () => {
      isMounted = false;
      window.removeEventListener('cozy-cache-cleared', handleCacheCleared);
    };
  }, [url]);

  return src;
}
