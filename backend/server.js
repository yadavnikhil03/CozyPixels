const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

let allWallpapers = [];
try {
  allWallpapers = require('./wallpapers.json');
} catch (e) {
  console.log('wallpapers.json not found, make sure to run generate.js');
}

app.get('/wallpapers', (req, res) => {
  res.json(allWallpapers);
});


app.get('/api/wallpapers', (req, res) => {
  res.json(allWallpapers);
});

app.use((err, req, res, next) => {
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
