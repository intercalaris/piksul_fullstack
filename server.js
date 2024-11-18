const express = require('express');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up SQLite database
const db = new sqlite3.Database('./data/database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database.');
    db.run(
      `CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_image TEXT,
        snapped_image TEXT,
        grid_size INTEGER,
        tolerance INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );
  }
});

// Multer setup for image uploads
const upload = multer({
  dest: 'data/img/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

app.get('/', (req, res) => {
  res.render('index'); 
});

app.get('/login', (req, res) => {
  res.render('editor');
});

// Save project
app.post('/save', upload.fields([
  { name: 'original_image'},
  { name: 'snapped_image'},
]), (req, res) => {
  const { grid_size, tolerance } = req.body;

  if (!req.files || !req.files.original_image || !req.files.snapped_image) {
      return res.status(400).json({ error: 'Missing image files.' });
  }

  const originalImagePath = req.files.original_image[0].path;
  const snappedImagePath = req.files.snapped_image[0].path;

  // Save project data to the database
  db.run(
      `INSERT INTO projects (original_image, snapped_image, grid_size, tolerance) VALUES (?, ?, ?, ?)`,
      [path.basename(originalImagePath), path.basename(snappedImagePath), parseInt(grid_size, 10), parseInt(tolerance, 10)],
      function (err) {
          if (err) {
              console.error('Error inserting into database:', err);
              return res.status(500).json({ error: 'Database error' });
          }

          res.json({ project_id: this.lastID });
      }
  );
});

// Display all saved projects (gallery!)
app.get('/projects', (req, res) => {
  db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Error retrieving projects:', err);
      res.status(500).send('Database error');
    } else {
      res.render('gallery', { projects: rows });
    }
  });
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
