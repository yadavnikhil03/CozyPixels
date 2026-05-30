import React, { useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { motion, AnimatePresence, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { LuGithub, LuTwitter, LuGlobe, LuSparkles, LuWind, LuRotateCcw, LuChevronRight, LuCopy, LuCheck, LuImage, LuTrees, LuBuilding, LuMoon, LuSun, LuPalette, LuLayoutGrid } from 'react-icons/lu';
import SocialCard from './components/forgeui/social-card';
import FlipText from './components/forgeui/flip-text';
import SanctuaryMode from './components/forgeui/sanctuary-mode';
import './index.css';

const STATIC_URL = import.meta.env.PROD ? 'https://cdn.jsdelivr.net/gh/yadavnikhil03/CozyPixels@main/frontend/public' : (import.meta.env.VITE_STATIC_URL || 'http://localhost:3001');
const imageUrl = (path) => `${STATIC_URL}${path.startsWith('/') ? path : `/${path}`}`;

const promoSectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.12,
      delayChildren: 0.12,
    },
  },
};

const promoItemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut' },
  },
};

const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

const modalCardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 220, damping: 22 },
  },
  exit: { opacity: 0, y: 18, scale: 0.98, transition: { duration: 0.16 } },
};




const ExtensionModal = ({ onClose, browser }) => {
  const [copied, setCopied] = useState(false);
  const downloadUrl = 'https://github.com/user-attachments/files/28376068/cozyPixels_extension_v1.0.1.zip';

  const copyUrl = () => {
    navigator.clipboard.writeText(browser.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="lightbox-overlay extension-modal-overlay"
      onClick={onClose}
      variants={modalBackdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="extension-modal-content"
        onClick={(e) => e.stopPropagation()}
        variants={modalCardVariants}
      >
        <button className="lightbox-close" onClick={onClose}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>

        <div className="modal-header">
          <div className="modal-icon">
            <LuSparkles />
          </div>
          <h3>Activate for {browser.name}</h3>
          <p>Almost there! Just 2 quick steps to activate your sanctuary.</p>
        </div>

        <div className="installation-steps">
          <div className="step-item">
            <div className="step-num">1</div>
            <div className="step-text">
              <strong>Open Extensions Page</strong>
              <p>Copy this address and paste it into a new tab:</p>
              <div className="copy-url-bar" onClick={copyUrl}>
                <code>{browser.url}</code>
                {copied ? <LuCheck style={{ color: '#27c93f' }} /> : <LuCopy />}
              </div>
            </div>
          </div>

          <div className="step-item">
            <div className="step-num">2</div>
            <div className="step-text">
              <strong>Load Unpacked Sanctuary</strong>
              <p>
                Enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong>,
                and select the folder you just downloaded.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="promo-btn primary" style={{ width: '100%' }} onClick={onClose}>
            I've loaded the Engine!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};


const Header = ({ totalCount }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="container flex items-center justify-between w-full">
        <span className="logo-text">CozyPixels</span>
        <div className="header-actions">
          <a href="#about" className="header-link">About</a>
          {totalCount > 0 && (
            <span className="wallpaper-count-header">
              {totalCount} wallpapers
            </span>
          )}
        </div>
      </div>
    </header>
  );
};


const HERO_WALLPAPERS = [
  'Nord/Pixel%20Art/pixelcity.png',
  'Nord/Pixel%20Art/pixelmoon.png',
  'Catppuccin/Abstract%20%26%20Artistic/galaxy-waves.jpg',
  'Catppuccin/Abstract%20%26%20Artistic/cartoon-castle.png',
  'Catppuccin/Abstract%20%26%20Artistic/dark-waves.jpg',
  'Catppuccin/Abstract%20%26%20Artistic/droplets.png',
  'Nord/Abstract%20%26%20Artistic/ign_FluidifiedST-1.png',
  'Nord/Abstract%20%26%20Artistic/ign_MaterialMountains-1.png',
  'Nord/Abstract%20%26%20Artistic/ign_nordic_rose.png',
];

const Hero = ({ totalCount = 0 }) => (
  <div className="hero-wrapper">
    <div className="hero-bg-gradient" />
    <div className="hero-orb hero-orb-1" />
    <div className="hero-orb hero-orb-2" />
    <div className="hero-orb hero-orb-3" />

    <div id="about" className="hero-split-container">
      {/* LEFT: Text content */}
      <motion.div
        className="hero-left"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="hero-title-split">
          <span className="hero-title-line">Your <span className="hero-title-accent">Serene</span></span>
          <span className="hero-title-line">Space Starts Here</span>
        </h1>

        <motion.p
          className="hero-subtitle-split"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
        >
          Minimalist wallpapers, obsessively curated. Pick your vibe,
          transform your desktop into a place you actually want to look at.
        </motion.p>

        <motion.div
          className="hero-actions-row"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          <a href="#gallery" className="hero-cta-primary">
            Browse Wallpapers <LuChevronRight />
          </a>
          <a
            href="https://github.com/yadavnikhil03"
            target="_blank"
            rel="noopener noreferrer"
            className="creator-pill-badge"
          >
            <img src="https://github.com/yadavnikhil03.png" alt="@yadavnikhil03" className="creator-pill-avatar" />
            <span className="creator-pill-text">by <strong>@yadavnikhil03</strong></span>
            <LuGithub className="creator-pill-icon" />
          </a>
        </motion.div>
      </motion.div>

      {/* RIGHT: Wallpaper mosaic */}
      <motion.div
        className="hero-right"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        <div className="hero-mosaic">
          {HERO_WALLPAPERS.slice(0, 9).map((path, i) => (
            <motion.div
              key={path}
              className={`mosaic-card mosaic-card-${i}`}
              whileHover={{ scale: 1.04, zIndex: 10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.3 + i * 0.06, duration: 0.6 } }}
            >
              <img
                src={imageUrl(path)}
                alt={`wallpaper ${i + 1}`}
                className="mosaic-img"
                loading="eager"
                decoding="async"
              />
            </motion.div>
          ))}
        </div>
        <div className="hero-mosaic-fade-bottom" />
        <div className="hero-mosaic-fade-right" />
      </motion.div>
    </div>
  </div>
);

const getCategoryIcon = (cat) => {
  switch (cat.toLowerCase()) {
    case 'all': return <LuLayoutGrid />;
    case 'nature': return <LuTrees />;
    case 'architecture': case 'city': return <LuBuilding />;
    case 'dark': case 'night': return <LuMoon />;
    case 'light': case 'minimal': return <LuSun />;
    case 'art': case 'abstract': return <LuPalette />;
    default: return <LuImage />;
  }
};

const CategoryFilter = ({ categories, selected, onSelect, counts }) => (
  <nav className="container filters" aria-label="Wallpaper categories">
    <button
      className={`filter-btn ${selected === 'All' ? 'active' : ''}`}
      onClick={() => onSelect('All')}
      aria-pressed={selected === 'All'}
    >
      <span className="filter-icon">{getCategoryIcon('All')}</span>
      <span className="filter-text">All Wallpapers</span>
      <span className="filter-count">{counts.total}</span>
    </button>
    {categories.map((cat) => (
      <button
        key={cat}
        className={`filter-btn ${selected === cat ? 'active' : ''}`}
        onClick={() => onSelect(cat)}
        aria-pressed={selected === cat}
      >
        <span className="filter-icon">{getCategoryIcon(cat)}</span>
        <span className="filter-text">{cat}</span>
        <span className="filter-count">{counts[cat] || 0}</span>
      </button>
    ))}
  </nav>
);


const MOCKUP_WALLPAPERS = [
  { path: 'Nord/Pixel%20Art/pixelcity.png', name: 'pixelcity' },
  { path: 'Nord/Pixel%20Art/pixelmoon.png', name: 'pixelmoon' },
  { path: 'Nord/Anime%20%26%20Gaming/ign_DynamicFry-1.png', name: 'ign_DynamicFry-1' },
  { path: 'Catppuccin/Abstract%20%26%20Artistic/galaxy-waves.jpg', name: 'galaxy-waves' },
  { path: 'Catppuccin/Abstract%20%26%20Artistic/cartoon-castle.png', name: 'cartoon-castle' },
];

const ExtensionPromo = ({ onOpenModal }) => {
  const [wallpaperIdx, setWallpaperIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setWallpaperIdx(i => (i + 1) % MOCKUP_WALLPAPERS.length);
        setFade(true);
      }, 250);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentWallpaper = MOCKUP_WALLPAPERS[wallpaperIdx];

  return (
  <motion.section
    className="container apple-promo-section"
    variants={promoSectionVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.2 }}
  >
    <div className="apple-promo-container">
      <div className="apple-promo-bg-glow"></div>
      
      <div className="apple-promo-header">
        <motion.div className="apple-promo-eyebrow" variants={promoItemVariants}>
          Apps & Extensions
        </motion.div>
        <motion.h2 className="apple-promo-title" variants={promoItemVariants}>
          Your screen.<br/>Reimagined.
        </motion.h2>
        <motion.p className="apple-promo-subtitle" variants={promoItemVariants}>
          Transform your desktop and browser into a serene digital sanctuary with our standalone app and browser extension.
        </motion.p>
        <motion.div className="apple-promo-actions" variants={promoItemVariants} style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
          <motion.button 
            className="apple-promo-btn" 
            onClick={onOpenModal}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Install Extension
          </motion.button>
          <motion.a 
            className="apple-promo-btn" 
            href="https://github.com/yadavnikhil03/CozyPixels/releases/latest/download/CozyPixels_1.0.8_x64-setup.exe"
            style={{ backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.5)', color: '#ffffff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: '#ffffff' }}
            whileTap={{ scale: 0.95 }}
          >
            Download Desktop App
          </motion.a>
        </motion.div>
      </div>

      <motion.div 
        className="apple-promo-visual"
        variants={promoItemVariants}
      >
        <div className="apple-browser-mockup">
          <div className="apple-browser-header">
            <div className="apple-browser-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="apple-browser-bar"></div>
          </div>
          <div 
            className="apple-browser-body"
            style={{
              backgroundImage: `url('${imageUrl(currentWallpaper.path)}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: fade ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          >
            <div className="new-tab-content">
              <h1 className="new-tab-clock">17:36</h1>
              <p className="new-tab-quote">Breathe in, breathe out.</p>
            </div>
            
            <div className="new-tab-footer">
              <span className="new-tab-credit">{currentWallpaper.name}</span>
              <span className="new-tab-brand">Cozy Engine</span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div className="apple-promo-features" variants={promoItemVariants}>
        <div className="apple-feature-card">
          <LuSparkles className="feature-icon" />
          <span>Fast install & startup</span>
        </div>
        <div className="apple-feature-card">
          <LuWind className="feature-icon" />
          <span>Focused new-tab layout</span>
        </div>
        <div className="apple-feature-card">
          <LuRotateCcw className="feature-icon" />
          <span>Wallpaper rotation controls</span>
        </div>
      </motion.div>
    </div>
  </motion.section>
  );
};


const HorizontalShowcase = ({ wallpapers = [], onPreview }) => {
  if (!wallpapers.length) return null;


  const infiniteWallpapers = [...wallpapers, ...wallpapers];

  return (
    <section className="showcase-section-drag">
      <div className="showcase-intro-block">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="showcase-intro-label"
        >
          Curated Collection
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="showcase-intro-title"
        >
          The Serene Gallery
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="showcase-intro-desc"
        >
          Discover our hand-picked selection of minimalist artworks, perfectly framed for your digital space. Pause by hovering.
        </motion.p>
      </div>

      <div className="showcase-marquee-container">
        <div className="showcase-marquee-track">
          {infiniteWallpapers.map((wp, index) => {
            return (
              <motion.div
                key={`${wp.path}-${index}`}
                className="showcase-card"
                onClick={() => onPreview(wp)}
                whileHover={{ scale: 0.98 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="showcase-card-overlay" />
                <img
                  src={`${STATIC_URL}${wp.path}`}
                  alt={wp.name}
                  className="showcase-card-img"
                  draggable="false"
                  loading="lazy"
                  decoding="async"
                />
                <div className="showcase-card-content">
                  <p className="showcase-card-cat">{wp.category}</p>
                  <p className="showcase-card-title">
                    {wp.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};


const WallpaperCard = React.memo(({ wallpaper, onPreview, onShowToast }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageUrl = `${STATIC_URL}${wallpaper.path}`;
  const downloadUrl = `${STATIC_URL}${wallpaper.downloadPath}`;

  const displayName = wallpaper.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`wallpaper-card ${isLoaded ? 'loaded' : 'loading'}`}
      onClick={() => isLoaded && onPreview(wallpaper)}
    >
      {!isLoaded && !hasError && (
        <div className="skeleton-card" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      )}

      {hasError ? (
        <div className="wallpaper-error">
          <span className="material-symbols-outlined">broken_image</span>
          <p>Failed to load</p>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={displayName}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.6s ease', willChange: 'opacity, transform' }}
        />
      )}

      {isLoaded && (
        <div className="overlay">
          <div className="card-info">
            <span className="card-title">{wallpaper.category}</span>
            <span className="card-name">{displayName}</span>
          </div>
          <div className="card-actions">
            <a
              href={downloadUrl}
              download={wallpaper.name}
              className="download-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShowToast("Wallpaper saved", "download");
              }}
              title="Download"
            >
              <span className="material-symbols-outlined">download</span>
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
});


const Lightbox = ({ wallpaper, onClose, onSanctuary, onShowToast }) => {
  if (!wallpaper) return null;
  const imageUrl = `${STATIC_URL}${wallpaper.path}`;
  const downloadUrl = `${STATIC_URL}${wallpaper.downloadPath}`;

  const displayName = wallpaper.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={imageUrl} alt="" className="lightbox-ambient-bg" />
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
        <img src={imageUrl} alt={displayName} className="lightbox-main-img" />
        <div className="lightbox-footer">
          <div className="lightbox-info">
            <span className="lightbox-title" title={displayName}>{displayName}</span>
            <span className="lightbox-category">{wallpaper.category}</span>
          </div>
          <a
            href={downloadUrl}
            download={wallpaper.name}
            className="lightbox-download"
            onClick={() => onShowToast("Wallpaper saved", "download")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Download
          </a>
          <button
            className="lightbox-sanctuary-btn"
            onClick={() => onSanctuary(wallpaper)}
            title="Enter Focus Sanctuary"
          >
            <LuSparkles />
            Sanctuary
          </button>
        </div>

      </div>
    </div>
  );
};





const Footer = () => (
  <footer className="footer container">
    <div className="logo-text">CozyPixels</div>
    <p>© 2026 CozyPixels. Crafted for serenity.</p>
  </footer>
);


const ScrollToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      className={`scroll-top-btn ${visible ? 'visible' : ''}`}
      onClick={scrollUp}
      aria-label="Scroll to top"
      title="Back to top"
    >
      <span className="material-symbols-outlined">arrow_upward</span>
    </button>
  );
};


function App() {
  const [wallpapers, setWallpapers] = useState([]);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [previewWallpaper, setPreviewWallpaper] = useState(null);
  const [sanctuaryWallpaper, setSanctuaryWallpaper] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [browserInfo, setBrowserInfo] = useState({ name: 'Chrome', url: 'chrome://extensions' });
  const [toast, setToast] = useState(null);

  const [displayCount, setDisplayCount] = useState(30);
  const loaderRef = useRef(null);

  const toastTimeoutRef = useRef(null);

  const showToast = (msg, type = 'default') => {
    setToast({ message: msg, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setDisplayCount(30);
  }, [category, searchQuery]);

  const enterSanctuary = (wallpaper) => {
    setPreviewWallpaper(null);
    setSanctuaryWallpaper(`${STATIC_URL}${wallpaper.path}`);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(e => console.log(e));
    }
    showToast("Entering Sanctuary Mode", "sanctuary");
  };

  const detectBrowser = () => {
    const ua = window.navigator.userAgent;
    if (ua.indexOf("Edg") > -1) return { name: 'Edge', url: 'edge://extensions' };
    if (ua.indexOf("OPR") > -1 || ua.indexOf("Opera") > -1) return { name: 'Opera', url: 'opera://extensions' };
    if (ua.indexOf("Brave") > -1 || (navigator.brave && navigator.brave.isBrave)) return { name: 'Brave', url: 'brave://extensions' };
    return { name: 'Chrome', url: 'chrome://extensions' };
  };

  const handleExtensionInstall = () => {
    const browser = detectBrowser();
    setBrowserInfo(browser);

    const downloadUrl = 'https://github.com/user-attachments/files/28376068/cozyPixels_extension_v1.0.1.zip';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'cozy-engine.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExtensionModal(true);
  };

  useEffect(() => {
    fetch('/wallpapers.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setWallpapers(data);
        } else {
          console.error('Data is not an array:', data);
        }
      })
      .catch((err) => {
        console.error('Error fetching wallpapers:', err);
      });
  }, []);


  const categories = Array.isArray(wallpapers) ? [...new Set(wallpapers.map((w) => w.category))] : [];

  const counts = {
    total: wallpapers.length,
    ...categories.reduce((acc, cat) => {
      acc[cat] = wallpapers.filter((w) => w.category === cat).length;
      return acc;
    }, {}),
  };

  const filteredWallpapers = wallpapers
    .filter((w) => category === 'All' || w.category === category)
    .filter((w) => {
      if (!deferredSearchQuery.trim()) return true;
      const q = deferredSearchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
      );
    });

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayCount(prev => prev + 30);
      }
    }, { threshold: 0.1, rootMargin: '400px' });

    const currentRef = loaderRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [filteredWallpapers.length]);

  const closeLightbox = useCallback(() => setPreviewWallpaper(null), []);


  return (
    <div>
      <Header totalCount={wallpapers.length} />
      <main>
        <Hero totalCount={wallpapers.length} />

        <HorizontalShowcase
          wallpapers={wallpapers}
          onPreview={setPreviewWallpaper}
        />
        <ExtensionPromo onOpenModal={handleExtensionInstall} />

        <div id="gallery" className="container" style={{ paddingTop: '8px', paddingBottom: '16px' }}>
          <motion.div
            className="search-wrapper"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              type="text"
              placeholder="Search wallpapers..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </motion.div>
        </div>

        <CategoryFilter
          categories={categories}
          selected={category}
          onSelect={setCategory}
          counts={counts}
        />
        <section className="container gallery" aria-label="Wallpapers collection">
          <h2 className="sr-only">High Resolution Wallpaper Gallery</h2>
          <AnimatePresence mode="popLayout">
            {filteredWallpapers.slice(0, displayCount).map((w) => (
              <WallpaperCard
                key={w.path}
                wallpaper={w}
                onPreview={setPreviewWallpaper}
                onShowToast={showToast}
              />
            ))}
          </AnimatePresence>
          {filteredWallpapers.length > displayCount && (
            <div ref={loaderRef} className="loader" style={{ gridColumn: '1 / -1', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined spin" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
              <span style={{ marginLeft: '12px' }}>Loading more wallpapers...</span>
            </div>
          )}
          {filteredWallpapers.length === 0 && (
            <div className="loader" style={{ gridColumn: '1 / -1' }}>
              No wallpapers found — try a different search or category.
            </div>
          )}
        </section>
      </main>
      <Footer />
      <ScrollToTop />
      <AnimatePresence>
        {previewWallpaper && (
          <Lightbox
            wallpaper={previewWallpaper}
            onClose={closeLightbox}
            onSanctuary={enterSanctuary}
            onShowToast={showToast}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sanctuaryWallpaper && (
          <SanctuaryMode
            wallpaper={sanctuaryWallpaper}
            onClose={() => {
              setSanctuaryWallpaper(null);
              if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(e => console.log(e));
              }
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showExtensionModal && (
          <ExtensionModal
            browser={browserInfo}
            onClose={() => setShowExtensionModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="dynamic-island-toast"
            initial={{ opacity: 0, x: "-50%", y: -40, scale: 0.8, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: "-50%", y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: "-50%", y: -40, scale: 0.8, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <div className="dynamic-island-content">
              <span className="dynamic-island-icon">
                {toast.type === 'download' ? <LuCheck /> : <LuSparkles />}
              </span>
              <span className="dynamic-island-text">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;
