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
        edited_image TEXT,
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

app.get('/editor', (req, res) => {
  res.render('editor');
});


// Endpoint to get project metadata from SQL db. Contains ids which can be used to call projects/images endpoint too
app.get('/projects', (req, res) => {
  db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Error retrieving projects:', err);
      return res.status(500).send('Database error');
    }
    // Map database rows to image endpoint paths, so images can be requested
    const projects = rows.map((project) => ({
      id: project.id,
      original_image: `/projects/image/${project.original_image}`,
      edited_image: `/projects/image/${project.edited_image}`,
      grid_size: project.grid_size,
      tolerance: project.tolerance,
      created_at: project.created_at,
    }));
    // Render the EJS template with metadata and img endpoint paths. If client requests paths, the project/image endpoint will be called
    res.render('gallery', { projects });
  });
});

// Image endpoint, consider redoing
app.get('/projects/image/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'data/img', filename);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('Image not found:', filePath);
      return res.status(404).send('Image not found');
    }
    res.sendFile(filePath); // send img file to client
  });
});

app.post('/projects', upload.fields([{ name: 'original_image' }, { name: 'edited_image' }]), (req, res) => {
  const { grid_size, tolerance, project_id } = req.body;
  const originalImage = req.files.original_image[0];
  const editedImage = req.files.edited_image[0];
  const saveImages = (id) => {
      const originalImagePath = path.join('data/img', `${id}_original.png`);
      const editedImagePath = path.join('data/img', `${id}_edited.png`);
      fs.renameSync(originalImage.path, originalImagePath);
      fs.renameSync(editedImage.path, editedImagePath);
      return { originalImagePath, editedImagePath };
  };
  const handleError = (err, message) => {
      console.error(message, err);
      res.status(500).json({ error: message });
  };
  if (project_id) { // if project ID is established, pre-existing project
      const { originalImagePath, editedImagePath } = saveImages(project_id);
      db.run( // update project row
          `UPDATE projects 
           SET original_image = ?, edited_image = ?, grid_size = ?, tolerance = ?, created_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [path.basename(originalImagePath), path.basename(editedImagePath), parseInt(grid_size, 10), parseInt(tolerance, 10), project_id],
          (err) => {
              if (err) return handleError(err, 'Database update error');
              res.json({ project_id, message: 'Project updated successfully' });
          }
      );
  } else {
      // insert a new project
      db.run(
          `INSERT INTO projects (original_image, edited_image, grid_size, tolerance) VALUES (?, ?, ?, ?)`,
          ['placeholder', 'placeholder', parseInt(grid_size, 10), parseInt(tolerance, 10)],
          function (err) {
              if (err) return handleError(err, 'Database insertion error');

              const newProjectId = this.lastID;
              const { originalImagePath, editedImagePath } = saveImages(newProjectId);

              db.run(
                  `UPDATE projects 
                   SET original_image = ?, edited_image = ? 
                   WHERE id = ?`,
                  [path.basename(originalImagePath), path.basename(editedImagePath), newProjectId],
                  (updateErr) => {
                      if (updateErr) return handleError(updateErr, 'Database update error');
                      res.json({ project_id: newProjectId, message: 'Project saved successfully' });
                  }
              );
          }
      );
  }
});

app.delete('/projects/:id', (req, res) => {
  const projectID = req.params.id;
  const originalImagePath = path.join(__dirname, 'data/img', `${projectID}_original.png`);
  const editedImagePath = path.join(__dirname, 'data/img', `${projectID}_edited.png`);
  // delete from SQL
  db.run('DELETE FROM projects WHERE id = ?', [projectID], (deleteErr) => {
    if (deleteErr) {
      console.error('Error deleting project from database:', deleteErr);
      return res.status(500).send('Failed to delete project');
    }
    // delete associated image files
    [originalImagePath, editedImagePath].forEach((filePath) => {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.error(`Error deleting file ${filePath}:`, unlinkErr);
        }
      });
    });
    console.log(`Project ${projectID} deleted.`);
    res.send(`Project ${projectID} deleted.`);
  });
});







// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
