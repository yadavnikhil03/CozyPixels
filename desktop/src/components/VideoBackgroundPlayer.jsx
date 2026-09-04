import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export const VideoBackgroundPlayer = ({ initialUrl }) => {
  const [videoUrl, setVideoUrl] = React.useState(initialUrl);

  // Force the html/body to be edge-to-edge with no margins or background color
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

  useEffect(() => {
    let unlisten;
    const setupListener = async () => {
      unlisten = await listen('change-video', (event) => {
        if (event.payload) {
          setVideoUrl(event.payload);
        }
      });
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!videoUrl) return null;

  const isGif = videoUrl.toLowerCase().endsWith('.gif');

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: 'black', margin: 0 }}>
      {isGif ? (
        <img 
          src={videoUrl} 
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', margin: 0, transform: 'scale(1.01)' }} 
          alt="GIF Wallpaper" 
        />
      ) : (
        <video 
          src={videoUrl} 
          autoPlay 
          loop 
          muted 
          playsInline 
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', margin: 0, transform: 'scale(1.01)' }}
        />
      )}
    </div>
  );
};
