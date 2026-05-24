const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
const REPO_ROOT = path.join(__dirname, '..');

const WALLPAPER_DIRS = ['Catppuccin', 'Nord', 'One Dark'];

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
app.get('/extension.zip', (req, res) => {
  const filePath = path.join(__dirname, 'extension.zip');
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    // Try project root if not in backend folder
    const rootPath = path.join(REPO_ROOT, 'extension.zip');
    if (fs.existsSync(rootPath)) {
      res.download(rootPath);
    } else {
      res.status(404).send('Extension bundle not found. Please contact the developer.');
    }
  }
});

app.get('/wallpapers', (req, res) => {
  let allWallpapers = [];
  
  WALLPAPER_DIRS.forEach(category => {
    const dirPath = path.join(REPO_ROOT, category);
    if (fs.existsSync(dirPath)) {
      const images = findImages(dirPath, category);
      allWallpapers = allWallpapers.concat(images);
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
  res.redirect(`/download?path=${req.query.path}`);
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
