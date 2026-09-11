import React, { useEffect, useState } from 'react';

export const VideoBackgroundPlayer = ({ initialUrl }) => {
  const [error, setError] = useState('');

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

  if (!initialUrl) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: 'black', margin: 0 }}>
      {initialUrl.toLowerCase().endsWith('.gif') ? (
        <img
          src={initialUrl}
          ref={imgRef}
          onError={() => setError(initialUrl)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', margin: 0, transform: 'scale(1.01)' }}
          alt="Wallpaper"
        />
      ) : (
        <video
          src={initialUrl}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setError(initialUrl)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', margin: 0, transform: 'scale(1.01)' }}
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