const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Security: Enable Helmet for security headers with safe defaults for CozyPixels
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com", "https://cozy-pixels.onrender.com"],
      mediaSrc: ["'self'", "https://cdn.jsdelivr.net", "https://raw.githubusercontent.com", "https://cozy-pixels.onrender.com"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cozypixels.eu.org", "https://cozy-pixels.onrender.com"]
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Security: Implement rate limiting to prevent resource exhaustion
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

app.use('/api/', apiLimiter);

// Security: Restrict CORS to trusted origins only
const allowedOrigins = [
  'https://cozy-pixels.vercel.app',
  'https://cozy-pixels.eu.org',
  'http://localhost:3000',
  'http://localhost:1420'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false,
  optionsSuccessStatus: 200
}));

// Security: Path traversal protection for static files
const staticDir = path.join(__dirname, '..', 'frontend', 'public');

// Secure static file serving with path validation
app.use('/static', (req, res, next) => {
  const requestedPath = path.normalize(req.path).replace(/^\//, '');
  const fullPath = path.join(staticDir, requestedPath);

  // Security check: ensure path stays within static directory
  if (!fullPath.startsWith(staticDir)) {
    return res.status(403).send('Access denied');
  }

  // Serve file securely
  express.static(staticDir)(req, res, next);
});

app.use(express.static(staticDir));

const allWallpapers = require('./wallpapers.json');

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CozyPixels API is running smoothly on Render!' });
});

app.get('/wallpapers', (req, res) => {
  res.json(allWallpapers);
});


app.get('/api/wallpapers', (req, res) => {
  const { page, limit, search, category: cat } = req.query;
  let filtered = [...allWallpapers];
  if (cat) filtered = filtered.filter(w => w.category === cat);

  // Secure search implementation with input validation and sanitization
  if (search) {
    // Input validation: allow alphanumeric characters, spaces, and basic punctuation
    const sanitizedSearch = String(search).replace(/[^\w\s\-.,]/g, '').trim();
    const safeSearch = sanitizedSearch.toLowerCase();

    if (safeSearch) {
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(safeSearch) ||
        w.category.toLowerCase().includes(safeSearch)
      );
    }
  }

  if (page && limit) {
    const p = parseInt(page), l = parseInt(limit);
    if (isNaN(p) || isNaN(l) || p < 1 || l < 1) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        message: 'Page and limit must be positive integers'
      });
    }
    const start = (p - 1) * l;
    res.json({ wallpapers: filtered.slice(start, start + l), total: filtered.length, page: p, limit: l });
  } else {
    res.json(filtered);
  }
});

app.get('/api/categories', (req, res) => {
  const cats = [...new Set(allWallpapers.map(w => w.category))];
  res.json(cats);
});

app.get('/api/collection/:name', (req, res) => {
  const name = req.params.name;

  // Validate category name input
  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      error: 'Invalid category name',
      message: 'Category name must be a non-empty string'
    });
  }

  const filtered = allWallpapers.filter(w => w.category.toLowerCase() === name.toLowerCase());
  res.json(filtered);
});

app.get('/api/wallpapers/search', (req, res) => {
  const q = req.query.q?.toLowerCase() || '';

  // Validate search query length
  if (q.length > 100) {
    return res.status(400).json({
      error: 'Search query too long',
      message: 'Search query must be 100 characters or less'
    });
  }

  const filtered = allWallpapers.filter(w =>
    w.name.toLowerCase().includes(q) ||
    w.category.toLowerCase().includes(q)
  );
  res.json(filtered);
});

// Security: Enhanced error handling middleware
app.use((err, req, res, next) => {
  // Log full error server-side for debugging
  console.error('API Error:', err);

  // Send generic error message to client
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.path} not found`
  });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
