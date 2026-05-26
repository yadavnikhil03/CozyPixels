import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { LuGithub, LuTwitter, LuGlobe, LuSparkles, LuWind, LuRotateCcw, LuChevronRight, LuCopy, LuCheck } from 'react-icons/lu';
import SocialCard from './components/forgeui/social-card';
import FlipText from './components/forgeui/flip-text';
import SanctuaryMode from './components/forgeui/sanctuary-mode';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
const STATIC_URL = import.meta.env.VITE_STATIC_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

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
  const downloadUrl = 'https://github.com/user-attachments/files/28224987/cozyPixels_extension.zip';

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


const Hero = () => (
  <div className="hero-wrapper">
    <div className="hero-video-container">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="hero-video-native"
      >
        <source src="https://cdn.coverr.co/videos/coverr-beautiful-cloudscape-5426/1080p.mp4" type="video/mp4" />
      </video>
    </div>
    <div className="hero-video-overlay" />
    
    <div id="about" className="container hero-grid" style={{ position: 'relative', zIndex: 2, paddingTop: '80px', paddingBottom: '80px' }}>
      <section className="hero text-left" style={{ padding: 0 }}>
        <h1 className="hero-title" style={{ margin: '0 0 24px 0', textAlign: 'left', maxWidth: 'none' }}>
          <FlipText>Your Serene Space Starts Here</FlipText>
        </h1>
        <motion.p 
          className="hero-subtitle"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{ margin: '0 0 32px 0', maxWidth: 'none', textAlign: 'left' }}
        >
          CozyPixels is a curated collection of minimalist and serene wallpapers. 
          Designed to bring a sense of calm and focus to your digital workspace. 
          Every pixel is chosen with intention, every palette crafted for harmony.
        </motion.p>
      </section>

      <div className="hero-social-card-wrapper">
        <SocialCard
          title="Creator"
          name="@yadavnikhil03"
          image="https://github.com/yadavnikhil03.png"
          pitch="Building tools and assets for a more peaceful digital life. Join us in creating a more mindful web."
          icon={<LuSparkles />}
          buttons={[
            { label: 'GitHub', icon: <LuGithub />, link: 'https://github.com/yadavnikhil03' },
            { label: 'Website', icon: <LuGlobe />, link: 'https://cozy-pixels.vercel.app/' },
          ]}
        />
      </div>
    </div>
  </div>
);



const CategoryFilter = ({ categories, selected, onSelect, counts }) => (
  <nav className="container filters" aria-label="Wallpaper categories">
    <button
      className={`filter-btn ${selected === 'All' ? 'active' : ''}`}
      onClick={() => onSelect('All')}
      aria-pressed={selected === 'All'}
    >
      All Wallpapers
      <span className="filter-count">{counts.total}</span>
    </button>
    {categories.map((cat) => (
      <button
        key={cat}
        className={`filter-btn ${selected === cat ? 'active' : ''}`}
        onClick={() => onSelect(cat)}
        aria-pressed={selected === cat}
      >
        {cat}
        <span className="filter-count">{counts[cat] || 0}</span>
      </button>
    ))}
  </nav>
);


const ExtensionPromo = ({ onOpenModal }) => (
  <motion.section
    className="container extension-promo"
    variants={promoSectionVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.3 }}
  >
    <motion.div 
      className="promo-card"
      variants={promoItemVariants}
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      <div className="promo-content">
        <motion.div 
          className="section-eyebrow"
          variants={promoItemVariants}
        >
          Browser Extension
        </motion.div>
        <motion.h2
          variants={promoItemVariants}
        >
          CozyPixels for New Tabs
        </motion.h2>
        <motion.p
          variants={promoItemVariants}
        >
          Transform your new tab into a serene digital sanctuary with daily curated wallpapers and a calm layout.
        </motion.p>
        
        <ul className="promo-features">
          {[
            { icon: <LuSparkles />, text: "Fast install and instant startup" },
            { icon: <LuWind />, text: "Focused new-tab layout" },
            { icon: <LuRotateCcw />, text: "Wallpaper rotation controls" }
          ].map((item, i) => (
            <motion.li 
              key={i}
              variants={promoItemVariants}
              whileHover={{ x: 4 }}
            >
              {item.icon} {item.text}
            </motion.li>
          ))}
        </ul>

        <motion.div 
          className="promo-actions"
          variants={promoItemVariants}
        >
          <motion.button
            className="promo-btn primary"
            onClick={onOpenModal}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            Install Extension
          </motion.button>
        </motion.div>
      </div>

      <motion.div
        className="promo-visual"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="promo-orb promo-orb-a" />
        <div className="promo-orb promo-orb-b" />
        <motion.div 
          className="promo-floating-elements"
          animate={{ 
            y: [0, -15, 0],
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <div className="browser-mockup">
            <div className="browser-header">
              <div className="browser-dot red"></div>
              <div className="browser-dot yellow"></div>
              <div className="browser-dot green"></div>
            </div>
            <div className="browser-body">
              <div className="browser-body-shell">
                <div className="browser-body-label">New Tab</div>
                <div className="browser-body-title">CozyPixels</div>
                <div className="browser-body-copy">A calm default surface for your digital sanctuary.</div>
                <div className="browser-body-row">
                  <span>Refresh</span>
                  <span>Focus</span>
                  <span>Settings</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Floating UI Elements */}
          <motion.div 
            className="floating-ui f-1"
            animate={{ y: [0, 10, 0], x: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <LuWind /> New Tab UI
          </motion.div>
          <motion.div 
            className="floating-ui f-2"
            animate={{ y: [0, -10, 0], x: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          >
            <LuSparkles /> Wallpaper Sync
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  </motion.section>
);


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


const WallpaperCard = ({ wallpaper, onPreview }) => {
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
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
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
              onClick={(e) => e.stopPropagation()}
              title="Download"
            >
              <span className="material-symbols-outlined">download</span>
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
};


const Lightbox = ({ wallpaper, onClose, onSanctuary }) => {
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
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
        <img src={imageUrl} alt={displayName} />
        <div className="lightbox-footer">
          <div className="lightbox-info">
            {displayName}
            <span>{wallpaper.category}</span>
          </div>
          <a
            href={downloadUrl}
            download={wallpaper.name}
            className="lightbox-download"
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


/* ==========================================
   SCROLL TO TOP BUTTON
   ========================================== */
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
  const [previewWallpaper, setPreviewWallpaper] = useState(null);
  const [sanctuaryWallpaper, setSanctuaryWallpaper] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [browserInfo, setBrowserInfo] = useState({ name: 'Chrome', url: 'chrome://extensions' });
  
  const [displayCount, setDisplayCount] = useState(30);
  const loaderRef = useRef(null);

  useEffect(() => {
    setDisplayCount(30);
  }, [category, searchQuery]);

  const enterSanctuary = (wallpaper) => {
    setPreviewWallpaper(null);
    setSanctuaryWallpaper(`${STATIC_URL}${wallpaper.path}`);
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

    // 1. Trigger the download immediately from GitHub CDN
    const downloadUrl = 'https://github.com/user-attachments/files/28224987/cozyPixels_extension.zip';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'cozy-engine.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. Show the dynamic instruction modal (Browsers block opening chrome:// URLs directly)
    setShowExtensionModal(true);
  };

  useEffect(() => {
    fetch(`${API_URL}/wallpapers`)
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
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
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
        <Hero />
        
        <HorizontalShowcase 
          wallpapers={wallpapers} 
          onPreview={setPreviewWallpaper} 
        />
        <ExtensionPromo onOpenModal={handleExtensionInstall} />

        <div className="container" style={{ paddingTop: '8px', paddingBottom: '16px' }}>
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
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sanctuaryWallpaper && (
          <SanctuaryMode 
            wallpaper={sanctuaryWallpaper} 
            onClose={() => setSanctuaryWallpaper(null)} 
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
    </div>
  );
}

export default App;
