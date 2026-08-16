/**
 * Express REST API Routes for LogScan.
 * Uses Promise-based Async SQLite & Non-blocking AI Processing Queue.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDb } = require('./db');
const LogService = require('./services/logService');
const AIProcessingQueue = require('./services/queueService');

const logService = new LogService(getDb);
const aiQueue = new AIProcessingQueue(logService);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${cleanName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan'));
    }
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'LogScan API',
    version: '0.4.0',
    timestamp: new Date().toISOString()
  });
});

// GET /api/processing-count - Returns count of background AI tasks processing
router.get('/processing-count', async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get("SELECT COUNT(*) as count FROM form_logs WHERE status_verifikasi = 'processing'");
    res.json({ success: true, processingCount: row ? row.count : 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload - Instant Upload & Async Queue Processing
router.post('/upload', upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Tidak ada file foto yang diunggah' });
    }

    const relativePath = path.relative(path.join(__dirname, '../'), req.file.path);
    console.log(`[Upload] Image saved: ${relativePath}`);

    // Create record immediately in Async SQLite with status 'processing'
    const createdLog = await logService.createLog({
      foto_path: relativePath,
      no_lapen: 'MEMPROSES...',
      no_kendaraan: 'PROSES AI',
      status_verifikasi: 'processing',
      confidence_score: 0.0
    });

    // Return instant HTTP 200 response to client
    res.json({
      success: true,
      status: 'processing',
      message: 'Foto berhasil diunggah. AI sedang mengekstrak data di latar belakang.',
      data: createdLog
    });

    // Enqueue task for sequential background AI processing
    aiQueue.enqueue(createdLog.id, req.file.path);

  } catch (err) {
    console.error('[Upload Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs - List logs with search & pagination
router.get('/logs', async (req, res) => {
  try {
    const result = await logService.getLogs(req.query);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[API] Error GET /logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs/:id - Get single log by ID
router.get('/logs/:id', async (req, res) => {
  try {
    const data = await logService.getLogById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs/:id/foto - Serve log image file
router.get('/logs/:id/foto', async (req, res) => {
  try {
    const log = await logService.getLogById(req.params.id);
    if (!log || !log.foto_path) {
      return res.status(404).json({ success: false, error: 'Foto tidak ditemukan' });
    }

    const fullPath = path.join(__dirname, '../', log.foto_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'File foto tidak ada di server' });
    }

    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/logs - Create manual log entry
router.post('/logs', async (req, res) => {
  try {
    const created = await logService.createLog(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[API] Error POST /logs:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/logs/:id - Update log entry
router.put('/logs/:id', async (req, res) => {
  try {
    const updated = await logService.updateLog(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[API] Error PUT /logs:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/logs/:id - Delete log entry
router.delete('/logs/:id', async (req, res) => {
  try {
    const deleted = await logService.deleteLog(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }
    res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err) {
    console.error('[API] Error DELETE /logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
