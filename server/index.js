const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Structured HTTP Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`[${timeStr}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Disable browser caching for PWA Service Worker & App Shell to ensure instant updates
app.use((req, res, next) => {
  if (req.url.endsWith('sw.js') || req.url === '/' || req.url.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve Admin Page on /admin and /admin.html
app.get(['/admin', '/admin.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));
// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api', apiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`[LOGSCAN] Server running on http://localhost:${PORT}`);
});
