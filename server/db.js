/**
 * Async SQLite Database Initialization Module (using sqlite & sqlite3).
 * Native Promise-based async interface preventing blocking or SQLite lock clashes.
 */

const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data.db');
    
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable WAL mode & busy timeout for optimal multi-connection handling
    await dbInstance.exec('PRAGMA journal_mode = WAL;');
    await dbInstance.exec('PRAGMA busy_timeout = 10000;');

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS form_logs (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        no_lapen          TEXT,
        no_kendaraan      TEXT,
        panjang_log       TEXT DEFAULT '260 CM',
        block             TEXT,
        nama_checker      TEXT,
        tanggal           DATE,
        jumlah_batang     INTEGER,
        diameter_detail   TEXT,  -- JSON string
        marking_s         TEXT,  -- JSON string { pecah, lapuk, bengkok, bontos_ganda, mata_kayu, total_s }
        total             INTEGER,
        foto_path         TEXT,
        confidence_score  REAL,
        status_verifikasi TEXT DEFAULT 'manual',
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_no_lapen ON form_logs(no_lapen);
      CREATE INDEX IF NOT EXISTS idx_no_kendaraan ON form_logs(no_kendaraan);
      CREATE INDEX IF NOT EXISTS idx_tanggal ON form_logs(tanggal);
      CREATE INDEX IF NOT EXISTS idx_status_verifikasi ON form_logs(status_verifikasi);
    `);

    // Migration checks: add missing columns if needed
    try {
      const tableInfo = await dbInstance.all("PRAGMA table_info(form_logs)");
      const cols = tableInfo.map(col => col.name);
      if (!cols.includes('panjang_log')) {
        await dbInstance.exec("ALTER TABLE form_logs ADD COLUMN panjang_log TEXT DEFAULT '260 CM'");
      }
      if (!cols.includes('marking_s')) {
        await dbInstance.exec("ALTER TABLE form_logs ADD COLUMN marking_s TEXT");
        console.log('[DB] Migrated: Added marking_s column to form_logs');
      }
    } catch (e) {
      console.warn('[DB Migration]', e.message);
    }

    console.log('[DB] Async SQLite (sqlite3) database initialized at:', dbPath);
  }
  return dbInstance;
}

module.exports = { getDb };
