/**
 * Express REST API Routes for LogScan.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const LogService = require('./services/logService');
const { extractFromImage } = require('./ocr');
const { extractWithGemini } = require('./gemini');

const logService = new LogService(db);

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
    version: '0.3.0',
    timestamp: new Date().toISOString()
  });
});

// GET /api/processing-count - Returns count of background AI tasks processing
router.get('/processing-count', (req, res) => {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM form_logs WHERE status_verifikasi = 'processing'").get();
    res.json({ success: true, processingCount: row ? row.count : 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Async Background AI Extraction Task
 */
async function processBackgroundExtraction(logId, filePath) {
  try {
    console.log(`[Background AI] Starting extraction for log #${logId}...`);
    let extractionResult = null;
    let engineUsed = 'none';

    // 1. Try Gemini Vision AI first
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        console.log(`[Background AI] Running Gemini AI for #${logId}...`);
        extractionResult = await extractWithGemini(filePath);
        engineUsed = 'gemini';
      } catch (geminiErr) {
        console.warn(`[Background AI] Gemini AI failed for #${logId}:`, geminiErr.message);
      }
    }

    // 2. Fallback to Tesseract OCR if Gemini failed or unconfigured
    if (!extractionResult) {
      try {
        console.log(`[Background AI] Running Tesseract OCR fallback for #${logId}...`);
        extractionResult = await extractFromImage(filePath);
        engineUsed = 'ocr';
      } catch (ocrErr) {
        console.warn(`[Background AI] Tesseract OCR failed for #${logId}:`, ocrErr.message);
      }
    }

    // 3. Save extracted fields to DB
    if (extractionResult && extractionResult.fields) {
      logService.updateLog(logId, {
        ...extractionResult.fields,
        confidence_score: extractionResult.confidence || 0.95,
        status_verifikasi: 'auto'
      });
      console.log(`[Background AI] Log #${logId} extracted via ${engineUsed} and updated to 'auto' ✅`);
    } else {
      // Mark as failed but keep image for manual entry
      logService.updateLog(logId, {
        status_verifikasi: 'failed'
      });
      console.warn(`[Background AI] Extraction failed for #${logId}. Saved as 'failed' for manual entry.`);
    }
  } catch (err) {
    console.error(`[Background AI Exception] Log #${logId}:`, err.message);
    logService.updateLog(logId, { status_verifikasi: 'failed' });
  }
}

// POST /api/upload - Instant Upload & Non-blocking Background Queue Processing
router.post('/upload', upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Tidak ada file foto yang diunggah' });
    }

    const relativePath = path.relative(path.join(__dirname, '../'), req.file.path);
    console.log(`[Upload] Image saved: ${relativePath}`);

    // Create record immediately with status 'processing'
    const createdLog = logService.createLog({
      foto_path: relativePath,
      no_lapen: 'MEMPROSES...',
      no_kendaraan: 'PROSES AI',
      status_verifikasi: 'processing',
      confidence_score: 0.0
    });

    // Return instant HTTP 200 response to client (<100ms)
    res.json({
      success: true,
      status: 'processing',
      message: 'Foto berhasil diunggah! AI sedang memproses di latar belakang ⏳',
      data: createdLog
    });

    // Fire & forget async background extraction (does not block HTTP response)
    setImmediate(() => {
      processBackgroundExtraction(createdLog.id, req.file.path);
    });

  } catch (err) {
    console.error('[Upload Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs - List logs with search & pagination
router.get('/logs', (req, res) => {
  try {
    const result = logService.getLogs(req.query);
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
router.get('/logs/:id', (req, res) => {
  try {
    const data = logService.getLogById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs/:id/foto - Serve log image file
router.get('/logs/:id/foto', (req, res) => {
  try {
    const log = logService.getLogById(req.params.id);
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
router.post('/logs', (req, res) => {
  try {
    const created = logService.createLog(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[API] Error POST /logs:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/logs/:id - Update log entry
router.put('/logs/:id', (req, res) => {
  try {
    const updated = logService.updateLog(req.params.id, req.body);
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
router.delete('/logs/:id', (req, res) => {
  try {
    const deleted = logService.deleteLog(req.params.id);
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
