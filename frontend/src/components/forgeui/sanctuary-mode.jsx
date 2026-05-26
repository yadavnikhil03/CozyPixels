"use client"

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LuPlay, LuPause, LuRotateCcw, LuVolume2, LuVolumeX, LuX, LuMaximize2, LuMinimize2, LuWind } from 'react-icons/lu';
import { cn } from '../../lib/utils';

const SanctuaryMode = ({ wallpaper, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Sync initial fullscreen state
  useEffect(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  // Timer Logic
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  // Audio Logic
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.4;
      if (isActive && !isMuted) {
        audioRef.current.play().catch(e => console.log("Audio play blocked"));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isActive, isMuted]);

  // Fullscreen Logic
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Hide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isActive) setShowControls(false);
    }, 3000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(25 * 60);
  };

  return (
    <motion.div 
      className="sanctuary-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={handleMouseMove}
    >
      <div className="sanctuary-bg-wrap">
        <img src={wallpaper} alt="Sanctuary" className="sanctuary-img" />
        <div className="sanctuary-vignette" />
      </div>

      <audio 
        ref={audioRef} 
        loop 
        src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" 
      />

      <button className="sanctuary-close" onClick={onClose}>
        <LuX />
      </button>

      <div className="sanctuary-content">
        <AnimatePresence>
          {showControls && (
            <motion.div 
              className="sanctuary-timer-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <div className="timer-label">Focus Session</div>
              <div className="timer-display">{formatTime(timeLeft)}</div>
              
              <div className="timer-controls">
                <button 
                  className={cn("timer-btn main", isActive && "active")}
                  onClick={() => setIsActive(!isActive)}
                >
                  {isActive ? <LuPause /> : <LuPlay />}
                </button>
                <button className="timer-btn" onClick={resetTimer}>
                  <LuRotateCcw />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            className="sanctuary-footer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="sanctuary-info">
              <LuWind className="ambient-icon" />
              <span>Ambient Serenity Active</span>
            </div>

            <div className="sanctuary-actions">
              <button className="sanctuary-btn" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? <LuVolumeX /> : <LuVolume2 />}
              </button>
              <button className="sanctuary-btn" onClick={toggleFullscreen}>
                {isFullscreen ? <LuMinimize2 /> : <LuMaximize2 />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SanctuaryMode;
