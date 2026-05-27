const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const WALLPAPER_DIRS = ['Catppuccin', 'Nord', 'One Dark'];

let allWallpapers = [];
let seenNames = new Set();

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
          const relativePath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/');
          const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
          results.push({
            name: file,
            path: `/${encodedPath}`, 
            category: category,
            downloadPath: `/${encodedPath}`
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
      if (!seenNames.has(img.name)) {
        seenNames.add(img.name);
        allWallpapers.push(img);
      }
    });
  }
});

fs.writeFileSync(path.join(__dirname, 'wallpapers.json'), JSON.stringify(allWallpapers, null, 2));
console.log('wallpapers.json generated successfully!');
