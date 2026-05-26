const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
const REPO_ROOT = path.join(__dirname, '..');

const WALLPAPER_DIRS = ['Catppuccin', 'Nord', 'One Dark'];

// Priority Route: Extension Download
app.get('/extension.zip', (req, res) => {
  console.log('Download request received for /extension.zip');
  const filePath = path.join(__dirname, 'extension.zip');
  if (fs.existsSync(filePath)) {
    console.log('Serving extension from backend folder');
    return res.download(filePath);
  }
  const rootPath = path.join(REPO_ROOT, 'extension.zip');
  if (fs.existsSync(rootPath)) {
    console.log('Serving extension from project root');
    return res.download(rootPath);
  }
  console.error('Extension bundle not found at either path');
  res.status(404).send('Extension bundle not found. Please contact the developer.');
});

const findImages = (dir, category) => {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(findImages(filePath, category));
      } else {
        const ext = path.extname(file).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
          const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
          const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
          results.push({
            name: file,
            path: `/${encodedPath}`, 
            category: category,
            downloadPath: `/api/download?path=${encodeURIComponent(relativePath)}`
          });
        }
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return results;
};

// Mount static routes for images
WALLPAPER_DIRS.forEach(dir => {
  const absolutePath = path.join(REPO_ROOT, dir);
  if (fs.existsSync(absolutePath)) {
    app.use(`/${dir}`, express.static(absolutePath));
    app.use(`/${encodeURIComponent(dir)}`, express.static(absolutePath));
  }
});

// Deployment-friendly routes (prefix /api is handled by vercel.json)
app.get('/wallpapers', (req, res) => {
  let allWallpapers = [];
  let seenNames = new Set();
  
  WALLPAPER_DIRS.forEach(category => {
    const dirPath = path.join(REPO_ROOT, category);
    if (fs.existsSync(dirPath)) {
      const images = findImages(dirPath, category);
      images.forEach(img => {
        if (!seenNames.has(img.name)) {
          seenNames.add(img.name);
          allWallpapers.push(img);
        }
      });
    }
  });

  res.json(allWallpapers);
});

app.get('/download', (req, res) => {
  const filePathParam = req.query.path;
  if (!filePathParam) {
    return res.status(400).send('Path is required');
  }

  const decodedPath = decodeURIComponent(filePathParam);
  const isAllowed = WALLPAPER_DIRS.some(dir => decodedPath.startsWith(`${dir}/`));
  
  if (!isAllowed) {
    return res.status(403).send('Forbidden');
  }

  const absolutePath = path.join(REPO_ROOT, decodedPath);
  
  if (fs.existsSync(absolutePath)) {
    res.download(absolutePath);
  } else {
    res.status(404).send('File not found');
  }
});

// Legacy support for local development if prefix is included
app.get('/api/wallpapers', (req, res) => {
  res.redirect('/wallpapers');
});
app.get('/api/download', (req, res) => {
  if (req.query.path) {
    res.redirect(`/download?path=${encodeURIComponent(req.query.path)}`);
  } else {
    res.status(400).send('Path is required');
  }
});
app.get('/api/extension.zip', (req, res) => {
  res.redirect('/extension.zip');
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
