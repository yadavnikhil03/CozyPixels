const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

const allWallpapers = require('./wallpapers.json');

app.get('/wallpapers', (req, res) => {
  res.json(allWallpapers);
});


app.get('/api/wallpapers', (req, res) => {
  const { page, limit, search, category: cat } = req.query;
  let filtered = [...allWallpapers];
  if (cat) filtered = filtered.filter(w => w.category === cat);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(w => w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q));
  }
  if (page && limit) {
    const p = parseInt(page), l = parseInt(limit);
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
  const filtered = allWallpapers.filter(w => w.category.toLowerCase() === req.params.name.toLowerCase());
  res.json(filtered);
});

app.get('/api/wallpapers/search', (req, res) => {
  const q = req.query.q?.toLowerCase() || '';
  const filtered = allWallpapers.filter(w => w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q));
  res.json(filtered);
});

app.use((err, req, res, next) => {
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
