import React from 'react';
import { motion } from 'motion/react';
import { LuCheck, LuX, LuMonitor, LuRefreshCw, LuInfo } from 'react-icons/lu';

export const Toast = ({ message, type }) => {
  const iconMap = {
    success: { icon: LuCheck, color: '#30D158' },
    error: { icon: LuX, color: '#FF453A' },
    info: { icon: LuInfo, color: '#0A84FF' },
    wallpaper: { icon: LuMonitor, color: '#5E5CE6' },
    rotate: { icon: LuRefreshCw, color: '#0A84FF' },
  };
  const { icon: Icon, color } = iconMap[type] || iconMap.success;
  return (
    <motion.div
      className="toast"
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300, mass: 0.9 }}
    >
      <div className="toast__icon" style={{ background: color }}>
        <Icon size={16} />
      </div>
      <span className="toast__msg">{message}</span>
    </motion.div>
  );
};
