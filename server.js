const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ---------------------- Middleware ----------------------
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
pp.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------- Ensure temp folder ----------------------
const tempDir = path.join(__dirname, 'temp');
fs.mkdirSync(tempDir, { recursive: true });

// ---------------------- Multer Setup ----------------------
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, tempDir),
        filename: (req, file, cb) => cb(null, file.originalname)
    })
});

// ---------------------- Database ----------------------
const db = new sqlite3.Database('./database.db', err => {
    if(err) return console.error('DB error:', err.message);
    console.log('Connected to SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        semester_id INTEGER,
        FOREIGN KEY(semester_id) REFERENCES semesters(id),
        UNIQUE(name, semester_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER,
        section TEXT,
        type TEXT,
        filename TEXT,
        obtained INTEGER,
        total INTEGER,
        last_date TEXT,
        FOREIGN KEY(subject_id) REFERENCES subjects(id)
    )`);
});

// ---------------------- Routes ----------------------

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------- Semester Routes ----------------------

// Add Semester
app.post('/add-semester', (req, res) => {
    const { name } = req.body;
    if(!name) return res.status(400).json({ error: 'Semester name required' });
    db.run(`INSERT INTO semesters(name) VALUES(?)`, [name], function(err){
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Semester added', semesterId: this.lastID });
    });
});

// Update Semester
app.post('/update-semester', (req, res) => {
    const { id, name } = req.body;
    if(!id || !name) return res.status(400).json({ error: 'ID and new name required' });
    db.run(`UPDATE semesters SET name=? WHERE id=?`, [name, id], function(err){
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Semester updated' });
    });
});

// Delete Semester (and related subjects)
app.delete('/delete-semester', (req, res) => {
    const id = req.query.id;
    if(!id) return res.status(400).json({ error: 'ID required' });

    db.run(`DELETE FROM subjects WHERE semester_id=?`, [id], (err) => {
        if(err) console.error('Error deleting subjects:', err.message);
    });

    db.run(`DELETE FROM semesters WHERE id=?`, [id], function(err){
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Semester deleted' });
    });
});

// Get All Semesters
app.get('/semesters', (req, res) => {
    db.all(`SELECT * FROM semesters ORDER BY name`, [], (err, rows) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ semesters: rows });
    });
});

// ---------------------- Subject Routes ----------------------

// Add Subject
app.post('/add-subject', (req, res) => {
    const { name, semesterId } = req.body;
    if(!name || !semesterId) return res.status(400).json({ error: 'Name and semesterId required' });

    db.run(`INSERT INTO subjects(name, semester_id) VALUES(?, ?)`, [name, semesterId], function(err){
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Subject added', subjectId: this.lastID });
    });
});

// Get All Subjects
app.get('/subjects', (req, res) => {
    db.all(`SELECT * FROM subjects ORDER BY name`, [], (err, rows) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ subjects: rows });
    });
});

// ---------------------- File Routes (Subject Page) ----------------------

// Upload / Update File
app.post('/upload', upload.single('file'), (req, res) => {
    const { subject, section, type, obtained, total, lastDate, update, filename } = req.body;
    if (!subject || !section || !type || !req.file) 
        return res.status(400).json({ error: 'Missing fields or file' });

    db.get(`SELECT id FROM subjects WHERE name=?`, [subject], (err, row) => {
        if(err) return res.status(500).json({ error: err.message });
        if(!row) return res.status(400).json({ error: 'Subject not found' });

        const subject_id = row.id;
        const safeSubject = subject.replace(/[<>:"/\\|?*]/g, '_');
        const dir = path.join(__dirname, 'uploads', safeSubject, section, type);
        fs.mkdirSync(dir, { recursive: true });
        const newPath = path.join(dir, req.file.originalname);

        if(update && filename){
            const oldPath = path.join(dir, filename);
            if(fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

            db.run(`DELETE FROM files WHERE subject_id=? AND section=? AND type=? AND filename=?`,
                [subject_id, section, type, filename], err2 => {
                    if(err2) console.error('Error deleting old file:', err2.message);
                });
        }

        fs.rename(req.file.path, newPath, err => {
            if(err) return res.status(500).json({ error: err.message });
            db.run(`INSERT INTO files(subject_id, section, type, filename, obtained, total, last_date) 
                    VALUES(?,?,?,?,?,?,?)`,
                [subject_id, section, type, req.file.originalname, obtained||null, total||null, lastDate||null],
                err2 => {
                    if(err2) return res.status(500).json({ error: err2.message });
                    res.json({ message: update ? 'File updated' : 'File uploaded' });
                });
        });
    });
});

// Get Files
app.get('/files', (req, res) => {
    const { subject, section, type } = req.query;
    if(!subject || !section || !type) return res.status(400).json({ error: 'Missing query params' });

    db.get(`SELECT id FROM subjects WHERE name=?`, [subject], (err, row) => {
        if(err || !row) return res.status(400).json({ error: 'Subject not found' });
        const subject_id = row.id;

        db.all(`SELECT * FROM files WHERE subject_id=? AND section=? AND type=?`,
            [subject_id, section, type], (err2, rows) => {
                if(err2) return res.status(500).json({ error: err2.message });
                res.json({ files: rows });
            });
    });
});

// Delete File
app.post('/delete-file', (req, res) => {
    const { subject, section, type, filename } = req.body;
    if(!subject || !section || !type || !filename) 
        return res.status(400).json({ error: 'Missing fields' });

    db.get(`SELECT id FROM subjects WHERE name=?`, [subject], (err, row) => {
        if(err || !row) return res.status(400).json({ error: 'Subject not found' });
        const subject_id = row.id;

        const filePath = path.join(__dirname, 'uploads', subject, section, type, filename);
        if(fs.existsSync(filePath)) fs.unlinkSync(filePath);

        db.run(`DELETE FROM files WHERE subject_id=? AND section=? AND type=? AND filename=?`,
            [subject_id, section, type, filename], err2 => {
                if(err2) return res.status(500).json({ error: err2.message });
                res.json({ message: 'File deleted successfully' });
            });
    });
});
app.post('/update-subject', (req, res) => {
    const { oldName, newName } = req.body;
    if(!oldName || !newName) return res.status(400).json({ error: 'Old and new name required' });

    db.get(`SELECT id FROM subjects WHERE name=?`, [oldName], (err, row) => {
        if(err) return res.status(500).json({ error: err.message });
        if(!row) return res.status(400).json({ error: 'Subject not found' });

        const subjectId = row.id;

        db.run(`UPDATE subjects SET name=? WHERE id=?`, [newName, subjectId], (err2) => {
            if(err2) return res.status(500).json({ error: err2.message });

            // Update related files folder names
            const oldDir = path.join(__dirname, 'uploads', oldName);
            const newDir = path.join(__dirname, 'uploads', newName);
            if(fs.existsSync(oldDir)){
                fs.renameSync(oldDir, newDir);
            }

            res.json({ message: 'Subject name updated successfully' });
        });
    });
});
// ---------------------- Start Server ----------------------
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
