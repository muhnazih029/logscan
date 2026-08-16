const Database = require('better-sqlite3');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency performance
db.pragma('journal_mode = WAL');

// Initialize tables
function initDb() {
  db.exec(`
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

  // Migration check: add missing columns if needed
  try {
    const tableInfo = db.prepare("PRAGMA table_info(form_logs)").all();
    const cols = tableInfo.map(col => col.name);
    if (!cols.includes('panjang_log')) {
      db.exec("ALTER TABLE form_logs ADD COLUMN panjang_log TEXT DEFAULT '260 CM'");
    }
    if (!cols.includes('marking_s')) {
      db.exec("ALTER TABLE form_logs ADD COLUMN marking_s TEXT");
      console.log('[DB] Migrated: Added marking_s column to form_logs');
    }
  } catch (e) {
    console.warn('[DB Migration]', e.message);
  }

  console.log('[DB] SQLite database initialized at:', dbPath);
}

initDb();

module.exports = db;
