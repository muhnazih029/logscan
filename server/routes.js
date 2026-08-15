const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('./db');
const LogService = require('./services/logService');

const logService = new LogService(db);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'LogScan API',
    version: '0.1.0',
    timestamp: new Date().toISOString()
  });
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
