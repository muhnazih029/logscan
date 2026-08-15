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
      block             TEXT,
      nama_checker      TEXT,
      tanggal           DATE,
      jumlah_batang     INTEGER,
      diameter_detail   TEXT,  -- JSON string
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
  `);
  console.log('[DB] SQLite database initialized at:', dbPath);
}

initDb();

module.exports = db;
