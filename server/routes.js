const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('./db');

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
    const q = req.query.q ? req.query.q.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) as total FROM form_logs';
    let dataSql = 'SELECT * FROM form_logs';
    const params = [];

    if (q) {
      const searchWhere = ' WHERE no_lapen LIKE ? OR no_kendaraan LIKE ? OR block LIKE ? OR nama_checker LIKE ?';
      countSql += searchWhere;
      dataSql += searchWhere;
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    const rows = db.prepare(dataSql).all(...params, limit, offset);

    // Parse JSON strings in diameter_detail
    const data = rows.map(row => {
      let diameterDetail = [];
      try {
        diameterDetail = row.diameter_detail ? JSON.parse(row.diameter_detail) : [];
      } catch (e) {
        diameterDetail = [];
      }
      return {
        ...row,
        diameter_detail: diameterDetail
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[API] Error GET /logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/logs/:id - Get single log by ID
router.get('/logs/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM form_logs WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }

    let diameterDetail = [];
    try {
      diameterDetail = row.diameter_detail ? JSON.parse(row.diameter_detail) : [];
    } catch (e) {
      diameterDetail = [];
    }

    res.json({
      success: true,
      data: {
        ...row,
        diameter_detail: diameterDetail
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/logs - Create log entry manually
router.post('/logs', (req, res) => {
  try {
    const {
      no_lapen,
      no_kendaraan,
      block,
      nama_checker,
      tanggal,
      jumlah_batang,
      diameter_detail,
      total,
      foto_path,
      confidence_score,
      status_verifikasi
    } = req.body;

    const stmt = db.prepare(`
      INSERT INTO form_logs (
        no_lapen, no_kendaraan, block, nama_checker, tanggal,
        jumlah_batang, diameter_detail, total, foto_path,
        confidence_score, status_verifikasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const jsonDetail = typeof diameter_detail === 'object' ? JSON.stringify(diameter_detail) : (diameter_detail || '[]');

    const info = stmt.run(
      no_lapen || '',
      no_kendaraan || '',
      block || '',
      nama_checker || '',
      tanggal || new Date().toISOString().split('T')[0],
      jumlah_batang || 0,
      jsonDetail,
      total || 0,
      foto_path || '',
      confidence_score || 1.0,
      status_verifikasi || 'manual'
    );

    res.status(201).json({
      success: true,
      message: 'Log berhasil disimpan',
      id: info.lastInsertRowid
    });
  } catch (err) {
    console.error('[API] Error POST /logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/logs/:id - Update log entry (Inline editing)
router.put('/logs/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM form_logs WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }

    const {
      no_lapen,
      no_kendaraan,
      block,
      nama_checker,
      tanggal,
      jumlah_batang,
      diameter_detail,
      total,
      foto_path,
      status_verifikasi
    } = req.body;

    const jsonDetail = diameter_detail !== undefined
      ? (typeof diameter_detail === 'object' ? JSON.stringify(diameter_detail) : diameter_detail)
      : existing.diameter_detail;

    const stmt = db.prepare(`
      UPDATE form_logs SET
        no_lapen = ?,
        no_kendaraan = ?,
        block = ?,
        nama_checker = ?,
        tanggal = ?,
        jumlah_batang = ?,
        diameter_detail = ?,
        total = ?,
        foto_path = COALESCE(?, foto_path),
        status_verifikasi = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      no_lapen !== undefined ? no_lapen : existing.no_lapen,
      no_kendaraan !== undefined ? no_kendaraan : existing.no_kendaraan,
      block !== undefined ? block : existing.block,
      nama_checker !== undefined ? nama_checker : existing.nama_checker,
      tanggal !== undefined ? tanggal : existing.tanggal,
      jumlah_batang !== undefined ? jumlah_batang : existing.jumlah_batang,
      jsonDetail,
      total !== undefined ? total : existing.total,
      foto_path || null,
      status_verifikasi || 'edited',
      id
    );

    res.json({
      success: true,
      message: 'Log berhasil diperbarui'
    });
  } catch (err) {
    console.error('[API] Error PUT /logs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/logs/:id - Delete log entry
router.delete('/logs/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM form_logs WHERE id = ?').run(req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
    }
    res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
