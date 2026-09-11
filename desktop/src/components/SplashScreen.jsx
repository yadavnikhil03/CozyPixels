import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LuSparkles } from 'react-icons/lu';

export const SplashScreen = ({ visible }) => {
  const circleRef = useRef(null);
  const CIRCUMFERENCE = 2 * Math.PI * 44;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="splash">
          <motion.div 
            className="splash__bg" 
            initial={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.5 }} 
          />

          <div className="splash__content">
            <motion.div
              className="splash__logo-wrap"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.svg className="splash__ring" viewBox="0 0 96 96" fill="none" exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.3 } }}>
                <circle
                  ref={circleRef}
                  cx="48" cy="48" r="44"
                  stroke="url(#splash-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE}
                  className="splash__ring-path"
                />
                <defs>
                  <linearGradient id="splash-grad" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="var(--md-sys-color-primary)" />
                    <stop offset="100%" stopColor="#5E5CE6" />
                  </linearGradient>
                </defs>
              </motion.svg>
              <motion.div
                className="splash__icon"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <LuSparkles size={30} />
              </motion.div>
            </motion.div>

            <motion.h1
className="splash__title"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              CozyPixels
            </motion.h1>

            <motion.div
              className="splash__bar-track"
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ delay: 0.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="splash__bar-fill" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

