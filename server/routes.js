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

// Multer storage configuration
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
    version: '0.2.0',
    timestamp: new Date().toISOString()
  });
});

// POST /api/upload - Upload form photo and process with Gemini AI (fallback to Tesseract OCR)
router.post('/upload', upload.single('foto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Tidak ada file foto yang diunggah' });
    }

    const relativePath = path.relative(path.join(__dirname, '../'), req.file.path);
    console.log(`[Upload] Processing photo: ${relativePath}`);

    let extractionResult = null;
    let engineUsed = 'ocr';

    // 1. Try Gemini Vision AI first if API key configured
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        console.log('[Upload] Running Gemini Vision AI extraction...');
        extractionResult = await extractWithGemini(req.file.path);
        engineUsed = 'gemini';
      } catch (geminiErr) {
        console.warn('[Upload] Gemini AI extraction failed or unavailable, falling back to local OCR:', geminiErr.message);
      }
    }

    // 2. Fallback to Tesseract OCR if Gemini failed or key missing
    if (!extractionResult) {
      console.log('[Upload] Running Tesseract OCR fallback...');
      try {
        extractionResult = await extractFromImage(req.file.path);
        engineUsed = 'ocr';
      } catch (ocrErr) {
        console.error('[Upload] OCR failed:', ocrErr.message);
        extractionResult = {
          fields: { no_lapen: null, no_kendaraan: null, block: null, total: null, diameter_detail: [] },
          rawText: '',
          confidence: 0
        };
      }
    }

    const { fields, confidence, rawText } = extractionResult;

    // Confidence routing: >= 0.85 auto-save, < 0.85 return pending for review
    if (confidence >= 0.85) {
      const createdLog = logService.createLog({
        ...fields,
        foto_path: relativePath,
        confidence_score: confidence,
        status_verifikasi: 'auto'
      });

      return res.json({
        success: true,
        status: 'auto',
        engine: engineUsed,
        message: `Data form log berhasil diekstrak via ${engineUsed === 'gemini' ? 'Gemini AI' : 'OCR'} dan disimpan otomatis ✅`,
        data: createdLog,
        confidence
      });
    } else {
      return res.json({
        success: true,
        status: 'pending',
        engine: engineUsed,
        message: 'Data berhasil dibaca tetapi memerlukan konfirmasi Anda',
        data: {
          ...fields,
          foto_path: relativePath,
          confidence_score: confidence
        },
        confidence,
        rawText
      });
    }
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
    const fullPath = path.isAbsolute(log.foto_path)
      ? log.foto_path
      : path.join(__dirname, '../', log.foto_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'File foto tidak ada di server' });
    }

    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/logs - Create log entry manually
router.post('/logs', (req, res) => {
  try {
    const createdLog = logService.createLog(req.body);
    res.status(201).json({
      success: true,
      message: 'Log berhasil disimpan',
      data: createdLog
    });
  } catch (err) {
    console.error('[API] Error POST /logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/logs/:id - Update log entry (Inline editing)
router.put('/logs/:id', (req, res) => {
  try {
    const updatedLog = logService.updateLog(req.params.id, req.body);
    if (!updatedLog) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }
    res.json({
      success: true,
      message: 'Log berhasil diperbarui',
      data: updatedLog
    });
  } catch (err) {
    console.error('[API] Error PUT /logs:', err);
    res.status(500).json({ success: false, error: err.message });
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
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
