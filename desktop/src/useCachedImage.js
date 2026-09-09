import { useState, useEffect } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const invoke = (...args) => window.__TAURI_INTERNALS__
  ? tauriInvoke(...args)
  : Promise.reject(new Error('Desktop cache is unavailable in browser mode'));

export function useCachedImage(url) {
  const [src, setSrc] = useState(url);

  useEffect(() => {
    let isMounted = true;
    
    if (!url) {
      setSrc(null);
      return;
    }
    
    // If it's already a local path, just use it
    if (!url.startsWith('http')) {
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
        // Keep the CDN URL as the fallback when local cache lookup fails.
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
