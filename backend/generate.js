const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const WALLPAPER_DIRS = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(name => name !== 'node_modules');

let allWallpapers = [];
let seenPaths = new Set();

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
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.webm', '.mkv'].includes(ext)) {
          const relativePath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/');

          // Security: Prevent directory traversal in generated paths
          if (relativePath.includes('..')) {
            console.warn(`Security warning: Path traversal attempt skipped: ${relativePath}`);
            return;
          }

          const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');

          // Security: Expose minimal safe metadata only - removed redundant/sensitive fields
          results.push({
            name: file,
            path: `/${encodedPath}`,
            category: category
          });
        }
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return results;
};

WALLPAPER_DIRS.forEach(category => {
  const dirPath = path.join(PUBLIC_DIR, category);
  if (fs.existsSync(dirPath)) {
    const images = findImages(dirPath, category);
    images.forEach(img => {
      if (!seenPaths.has(img.path)) {
        seenPaths.add(img.path);
        allWallpapers.push(img);
      }
    });
  }
});

fs.writeFileSync(path.join(__dirname, 'wallpapers.json'), JSON.stringify(allWallpapers, null, 2));
fs.writeFileSync(path.join(__dirname, '..', 'frontend', 'public', 'wallpapers.json'), JSON.stringify(allWallpapers, null, 2));
console.log('wallpapers.json generated successfully!');
