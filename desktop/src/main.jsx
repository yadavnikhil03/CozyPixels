import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { VideoBackgroundPlayer } from './components/VideoBackgroundPlayer.jsx';

// Detect whether we are running in the video_bg window before React renders.
// This avoids conditional hook calls inside App (React Rules of Hooks).
const isVideoWindow = (() => {
  try {
    return window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label === 'video_bg';
  } catch {
    return false;
  }
})();

const params = new URLSearchParams(window.location.search);
const initialVideoUrl = params.get('videoUrl');

let RootComponent;
if (isVideoWindow) {
  // Render the video/GIF background player window.
  // VideoWindowApp handles polling for the URL from the Rust side when not in query string.
  RootComponent = <VideoBackgroundPlayer initialUrl={initialVideoUrl} isVideoWindow={isVideoWindow} />;
} else {
  RootComponent = (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {RootComponent}
  </React.StrictMode>,
);
