const fs = require('fs');
const path = require('path');

const wallpapersPath = path.join(__dirname, 'wallpapers.json');
const sitemapPath = path.join(__dirname, '..', 'frontend', 'public', 'sitemap.xml');
const BASE_URL = 'https://cozy-pixels.vercel.app';

let wallpapers = [];
try {
  wallpapers = JSON.parse(fs.readFileSync(wallpapersPath, 'utf8'));
} catch (e) {
  console.error('Could not read wallpapers.json. Make sure to run generate.js first.', e);
  process.exit(1);
}

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

// Add homepage
xml += `  <url>\n`;
xml += `    <loc>${BASE_URL}/</loc>\n`;
xml += `    <changefreq>daily</changefreq>\n`;
xml += `    <priority>1.0</priority>\n`;
xml += `  </url>\n`;

// Add each wallpaper to the sitemap with Image tags
wallpapers.forEach(wp => {
  xml += `  <url>\n`;
  xml += `    <loc>${BASE_URL}/</loc>\n`;
  xml += `    <image:image>\n`;
  xml += `      <image:loc>${BASE_URL}${wp.path}</image:loc>\n`;
  xml += `      <image:title><![CDATA[${wp.name}]]></image:title>\n`;
  xml += `      <image:caption><![CDATA[CozyPixels ${wp.category} Wallpaper - ${wp.name}]]></image:caption>\n`;
  xml += `    </image:image>\n`;
  xml += `  </url>\n`;
});

xml += `</urlset>`;

fs.writeFileSync(sitemapPath, xml);
console.log(`Successfully generated sitemap.xml with ${wallpapers.length} images!`);
