import React, { useEffect, useState, useRef } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const invoke = (...args) =>
  window.__TAURI_INTERNALS__ ? tauriInvoke(...args) : Promise.reject(new Error('Not in Tauri'));

export const VideoBackgroundPlayer = ({ initialUrl, isVideoWindow = false }) => {
  const [url, setUrl] = useState(initialUrl || null);
  const [error, setError] = useState('');
  const imgRef = useRef(null);

  // When running as the dedicated video_bg window, poll the backend for the URL
  // if it was not passed via query string. This handles the case where the window
  // is opened before the Rust command has stored the URL.
  useEffect(() => {
    if (!isVideoWindow || url) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 25;

    const poll = () => {
      if (cancelled || attempts >= MAX_ATTEMPTS) return;
      attempts += 1;
      invoke('get_video_wallpaper_url')
        .then((u) => {
          if (u && !cancelled) setUrl(u);
          else if (!u && !cancelled && attempts < MAX_ATTEMPTS) setTimeout(poll, 300);
        })
        .catch(() => {
          if (!cancelled && attempts < MAX_ATTEMPTS) setTimeout(poll, 300);
        });
    };

    poll();
    return () => { cancelled = true; };
  }, [isVideoWindow, url]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      html, body, #root {
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: black !important;
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!url) {
    return <div style={{ position: 'fixed', inset: 0, background: 'black' }} />;
  }

  const isGif = url.toLowerCase().endsWith('.gif');

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: 'black', margin: 0 }}>
      {isGif ? (
        <img
          ref={imgRef}
          src={url}
          onError={() => setError(url)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', margin: 0 }}
          alt="Wallpaper"
        />
      ) : (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setError(url)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', margin: 0 }}
        />
      )}
      {error && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'black', color: '#ff6b6b', fontFamily: 'monospace', fontSize: 13, padding: 16, textAlign: 'center', wordBreak: 'break-all' }}>
          Failed to load: {error}
        </div>
      )}
    </div>
  );
};