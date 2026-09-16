import { useState, useEffect } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const invoke = (...args) =>
  window.__TAURI_INTERNALS__
    ? tauriInvoke(...args)
    : Promise.reject(new Error('Desktop cache is unavailable in browser mode'));

// Module-level deduplication: URLs currently being resolved.
// Multiple components requesting the same URL share one IPC call.
const inFlight = new Map(); // url -> Promise<string>

// Bounded resolved-result cache. Avoids re-querying the backend on re-render.
// FIFO eviction at MAX_CACHE_SIZE keeps memory bounded.
const MAX_CACHE_SIZE = 2000;
const resolvedCache = new Map(); // url -> cachedUrl

function getCached(url) {
  if (resolvedCache.has(url)) return resolvedCache.get(url);
  return null;
}

function setCached(url, value) {
  if (resolvedCache.size >= MAX_CACHE_SIZE) {
    // Delete the oldest entry (Map preserves insertion order).
    resolvedCache.delete(resolvedCache.keys().next().value);
  }
  resolvedCache.set(url, value);
}

function resolveUrl(url) {
  if (inFlight.has(url)) return inFlight.get(url);
  const promise = invoke('get_cached_image', { url })
    .then((cachedUrl) => {
      inFlight.delete(url);
      const result = (cachedUrl && cachedUrl.startsWith('asset://localhost/')) ? cachedUrl : url;
      setCached(url, result);
      return result;
    })
    .catch((err) => {
      inFlight.delete(url);
      console.warn('[CozyPixels] get_cached_image failed for', url, err);
      setCached(url, url); // Cache the fallback so we don't retry on every render.
      return url;
    });
  inFlight.set(url, promise);
  return promise;
}

export function useCachedImage(url) {
  const [src, setSrc] = useState(() => {
    // If already resolved, use it immediately without waiting for an effect.
    const cached = url ? getCached(url) : null;
    return cached || url;
  });

  useEffect(() => {
    if (!url) return;

    // Non-CDN URLs (asset://, local paths) don't need cache lookup.
    if (!url.startsWith('http')) {
      setSrc(url);
      return;
    }
    if (url.startsWith('http://asset.localhost') || url.startsWith('https://asset.localhost')) {
      setSrc(url);
      return;
    }

    let isMounted = true;

    // Check in-memory cache first (synchronous).
    const cached = getCached(url);
    if (cached) {
      setSrc(cached);
    } else {
      // Set CDN URL immediately so the image starts loading while we resolve.
      setSrc(url);
    }

    // Resolve via deduplicating IPC call.
    resolveUrl(url).then((resolved) => {
      if (isMounted) setSrc(resolved);
    });

    const handleCacheCleared = (event) => {
      if (event.detail === url) {
        resolvedCache.delete(url);
        setSrc(url);
      }
    };
    window.addEventListener('cozy-cache-cleared', handleCacheCleared);

    return () => {
      isMounted = false;
      window.removeEventListener('cozy-cache-cleared', handleCacheCleared);
    };
  }, [url]);

  return src;
}
