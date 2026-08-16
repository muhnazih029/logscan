/**
 * LogService — Handles data layer and domain logic for form logs.
 */

function parseJSON(str, fallback = null) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function stringifyJSON(obj) {
  if (typeof obj === 'string') return obj;
  return JSON.stringify(obj || {});
}

function formatRecord(row) {
  if (!row) return null;
  return {
    ...row,
    diameter_detail: parseJSON(row.diameter_detail, []),
    marking_s: parseJSON(row.marking_s, { pecah: 0, lapuk: 0, bengkok: 0, bontos_ganda: 0, mata_kayu: 0, total_s: 0 })
  };
}

class LogService {
  constructor(db) {
    this.db = db;
  }

  getLogs({ q = '', panjang = '', page = 1, limit = 25 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 25);
    const offset = (pageNum - 1) * limitNum;

    let countSql = 'SELECT COUNT(*) as total FROM form_logs';
    let dataSql = 'SELECT * FROM form_logs';
    const whereConditions = [];
    const params = [];

    if (q && q.trim() !== '') {
      // Search strictly on No. SAP / Lapen and No. Mobil / Kendaraan
      whereConditions.push('(no_lapen LIKE ? OR no_kendaraan LIKE ?)');
      const searchPattern = `%${q.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    if (panjang && panjang.trim() !== '' && panjang !== 'all') {
      whereConditions.push('panjang_log LIKE ?');
      params.push(`%${panjang.trim()}%`);
    }

    if (whereConditions.length > 0) {
      const searchWhere = ' WHERE ' + whereConditions.join(' AND ');
      countSql += searchWhere;
      dataSql += searchWhere;
    }

    dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const totalRow = this.db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;
    const rows = this.db.prepare(dataSql).all(...params, limitNum, offset);

    return {
      data: rows.map(formatRecord),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  getLogById(id) {
    const row = this.db.prepare('SELECT * FROM form_logs WHERE id = ?').get(id);
    return formatRecord(row);
  }

  createLog(logData = {}) {
    const {
      no_lapen = '',
      no_kendaraan = '',
      panjang_log = '260 CM',
      block = '',
      nama_checker = '',
      tanggal = new Date().toISOString().split('T')[0],
      jumlah_batang = 0,
      diameter_detail = [],
      marking_s = { pecah: 0, lapuk: 0, bengkok: 0, bontos_ganda: 0, mata_kayu: 0, total_s: 0 },
      total = 0,
      foto_path = '',
      confidence_score = 1.0,
      status_verifikasi = 'manual'
    } = logData;

    const stmt = this.db.prepare(`
      INSERT INTO form_logs (
        no_lapen, no_kendaraan, panjang_log, block, nama_checker, tanggal,
        jumlah_batang, diameter_detail, marking_s, total, foto_path,
        confidence_score, status_verifikasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const jsonDetail = stringifyJSON(diameter_detail);
    const jsonMarking = stringifyJSON(marking_s);

    const info = stmt.run(
      no_lapen,
      no_kendaraan,
      panjang_log || '260 CM',
      block,
      nama_checker,
      tanggal,
      jumlah_batang,
      jsonDetail,
      jsonMarking,
      total,
      foto_path,
      confidence_score,
      status_verifikasi
    );

    return this.getLogById(info.lastInsertRowid);
  }

  updateLog(id, updateData = {}) {
    const existing = this.db.prepare('SELECT * FROM form_logs WHERE id = ?').get(id);
    if (!existing) return null;

    const jsonDetail = updateData.diameter_detail !== undefined
      ? stringifyJSON(updateData.diameter_detail)
      : existing.diameter_detail;

    const jsonMarking = updateData.marking_s !== undefined
      ? stringifyJSON(updateData.marking_s)
      : existing.marking_s;

    const stmt = this.db.prepare(`
      UPDATE form_logs SET
        no_lapen = ?,
        no_kendaraan = ?,
        panjang_log = ?,
        block = ?,
        nama_checker = ?,
        tanggal = ?,
        jumlah_batang = ?,
        diameter_detail = ?,
        marking_s = ?,
        total = ?,
        foto_path = COALESCE(?, foto_path),
        status_verifikasi = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      updateData.no_lapen !== undefined ? updateData.no_lapen : existing.no_lapen,
      updateData.no_kendaraan !== undefined ? updateData.no_kendaraan : existing.no_kendaraan,
      updateData.panjang_log !== undefined ? updateData.panjang_log : (existing.panjang_log || '260 CM'),
      updateData.block !== undefined ? updateData.block : existing.block,
      updateData.nama_checker !== undefined ? updateData.nama_checker : existing.nama_checker,
      updateData.tanggal !== undefined ? updateData.tanggal : existing.tanggal,
      updateData.jumlah_batang !== undefined ? updateData.jumlah_batang : existing.jumlah_batang,
      jsonDetail,
      jsonMarking,
      updateData.total !== undefined ? updateData.total : existing.total,
      updateData.foto_path || null,
      updateData.status_verifikasi || 'edited',
      id
    );

    return this.getLogById(id);
  }

  deleteLog(id) {
    const info = this.db.prepare('DELETE FROM form_logs WHERE id = ?').run(id);
    return info.changes > 0;
  }
}

module.exports = LogService;
