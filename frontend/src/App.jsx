import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LuGithub, LuTwitter, LuGlobe, LuSparkles, LuWind, LuRotateCcw, LuChevronRight, LuCopy, LuCheck } from 'react-icons/lu';
import SocialCard from './components/forgeui/social-card';
import FlipText from './components/forgeui/flip-text';
import SanctuaryMode from './components/forgeui/sanctuary-mode';
import './index.css';
import './custom-loader.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
const STATIC_URL = import.meta.env.VITE_STATIC_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');


const ExtensionModal = ({ onClose, browser }) => {
  const [copied, setCopied] = useState(false);
  const downloadUrl = 'https://github.com/user-attachments/files/28191045/extension.zip';

  const copyUrl = () => {
    navigator.clipboard.writeText(browser.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="extension-modal-content" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
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


const Hero = ({ searchQuery, onSearch }) => (
  <div className="hero-wrapper">
    <div className="hero-bg" />
    <div className="hero-blob blob-1" />
    <div className="hero-blob blob-2" />
    <div className="hero-blob blob-3" />
    <div className="hero-blob blob-4" />
    <section className="hero container text-center">
      <h1 className="hero-title text-center">
        <FlipText>Your Serene Space Starts Here</FlipText>
      </h1>
      <motion.p 
        className="hero-subtitle"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        Discover curated wallpapers designed for digital hygge. Minimalist, calm,
        and perfectly balanced for your sanctuary.
      </motion.p>
      <motion.div 
        className="search-wrapper"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <span className="material-symbols-outlined search-icon">search</span>
        <input
          type="text"
          placeholder="Search by name..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </motion.div>
    </section>
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
  <section className="container extension-promo">
    <motion.div 
      className="promo-card"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="promo-content">
        <motion.div 
          className="section-eyebrow"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          Premium Feature
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          The Cozy Engine
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Bring the serenity of CozyPixels to your browser. Our official extension 
          replaces your New Tab with a rotating digital sanctuary.
        </motion.p>
        
        <ul className="promo-features">
          {[
            { icon: <LuSparkles />, text: "Auto-rotating minimalist vibes" },
            { icon: <LuWind />, text: "Built-in focus & breathing tools" },
            { icon: <LuRotateCcw />, text: "Daily sanctuary refreshes" }
          ].map((item, i) => (
            <motion.li 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + (i * 0.1) }}
            >
              {item.icon} {item.text}
            </motion.li>
          ))}
        </ul>

        <motion.div 
          className="promo-actions"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
        >
          <button className="promo-btn primary" onClick={onOpenModal}>
            Install Cozy Engine Instantly
          </button>
        </motion.div>
      </div>

      <div className="promo-visual">
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
              <motion.div 
                className="mock-time"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                14:20
              </motion.div>
              <div className="mock-greeting">Breathe in...</div>
            </div>
          </div>
          
          {/* Floating UI Elements */}
          <motion.div 
            className="floating-ui f-1"
            animate={{ y: [0, 10, 0], x: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <LuWind /> Focus Active
          </motion.div>
          <motion.div 
            className="floating-ui f-2"
            animate={{ y: [0, -10, 0], x: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          >
            <LuSparkles /> Auto-Sync
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  </section>
);


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


const About = () => (
  <section id="about" className="container about-section">
    <div className="about-copy">
      <div className="section-eyebrow">About CozyPixels</div>
      <h2>Digital Hygge for Your Sanctuary</h2>
      <p>
        CozyPixels is a curated collection of minimalist and serene wallpapers. 
        Designed to bring a sense of calm and focus to your digital workspace. 
        Every pixel is chosen with intention, every palette crafted for harmony.
      </p>
    </div>
    <div className="about-card-wrap">
      <SocialCard
        title="Creator"
        name="@yadavnikhil03"
        image="https://github.com/yadavnikhil03.png"
        pitch="Building tools and assets for a more peaceful digital life. Join us in creating a more mindful web."
        icon={<LuSparkles />}
        buttons={[
          { label: 'GitHub', icon: <LuGithub />, link: 'https://github.com/yadavnikhil03' },
          { label: 'Website', icon: <LuGlobe />, link: 'https://github.com/yadavnikhil03' },
        ]}
      />
    </div>
  </section>
);


/* ==========================================
   CUSTOM LOADER
   ========================================== */
const CustomLoader = () => (
  <div className="loader-fullscreen-overlay">
    <div className="loader-wrapper">
      <span className="loader-letter">L</span>
      <span className="loader-letter">o</span>
      <span className="loader-letter">a</span>
      <span className="loader-letter">d</span>
      <span className="loader-letter">i</span>
      <span className="loader-letter">n</span>
      <span className="loader-letter">g</span>
      <span className="loader-letter">.</span>
      <span className="loader-letter">.</span>
      <span className="loader-letter">.</span>
      <div className="loader"></div>
    </div>
  </div>
);


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
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewWallpaper, setPreviewWallpaper] = useState(null);
  const [sanctuaryWallpaper, setSanctuaryWallpaper] = useState(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [browserInfo, setBrowserInfo] = useState({ name: 'Chrome', url: 'chrome://extensions' });

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
    const downloadUrl = 'https://github.com/user-attachments/files/28191045/extension.zip';
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
    // Fail-safe: Always hide loader after 5 seconds max
    const failSafeTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn('Loading timed out - forcing UI display');
        return false;
      });
    }, 5000);

    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
    
    fetch(`${API_URL}/wallpapers`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        return Promise.all([Promise.resolve(data), minLoadTime]);
      })
      .then(([data]) => {
        if (Array.isArray(data)) {
          setWallpapers(data);
        } else {
          console.error('Data is not an array:', data);
        }
        setLoading(false);
        clearTimeout(failSafeTimeout);
      })
      .catch((err) => {
        console.error('Error fetching wallpapers:', err);
        setLoading(false);
        clearTimeout(failSafeTimeout);
      });

    return () => clearTimeout(failSafeTimeout);
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

  const closeLightbox = useCallback(() => setPreviewWallpaper(null), []);


  return (
    <div>
      <Header totalCount={wallpapers.length} />
      <main>
        <Hero searchQuery={searchQuery} onSearch={setSearchQuery} />
        <ExtensionPromo onOpenModal={handleExtensionInstall} />
        <CategoryFilter
          categories={categories}
          selected={category}
          onSelect={setCategory}
          counts={counts}
        />
        <section className="container gallery" aria-label="Wallpapers collection">
          <h2 className="sr-only">High Resolution Wallpaper Gallery</h2>
          <AnimatePresence mode="popLayout">
            {filteredWallpapers.map((w) => (
              <WallpaperCard
                key={w.path}
                wallpaper={w}
                onPreview={setPreviewWallpaper}
              />
            ))}
          </AnimatePresence>
          {!loading && filteredWallpapers.length === 0 && (
            <div className="loader" style={{ gridColumn: '1 / -1' }}>
              No wallpapers found — try a different search or category.
            </div>
          )}
        </section>
        <About />
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
      {loading && <CustomLoader />}
    </div>
  );
}

export default App;
