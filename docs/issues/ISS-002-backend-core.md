# ISS-002 — Backend Core: Database & REST API

**Status:** [x] Closed  
**Priority:** P0 — Blocker  
**Estimasi:** 4–6 jam (Actual: 20 menit)  
**Phase:** 1  
**Depends on:** ISS-001

---

## Deskripsi
Buat layer database (SQLite) dan semua REST API endpoint yang dibutuhkan frontend.

## Schema Database

```sql
CREATE TABLE IF NOT EXISTS form_logs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  no_lapen         TEXT,
  no_kendaraan     TEXT,
  block            TEXT,
  nama_checker     TEXT,
  tanggal          DATE,
  jumlah_batang    INTEGER,
  diameter_detail  TEXT,  -- JSON string
  total            INTEGER,
  foto_path        TEXT,
  confidence_score REAL,
  status_verifikasi TEXT DEFAULT 'manual',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_no_lapen ON form_logs(no_lapen);
CREATE INDEX IF NOT EXISTS idx_no_kendaraan ON form_logs(no_kendaraan);
CREATE INDEX IF NOT EXISTS idx_tanggal ON form_logs(tanggal);
```

## Endpoints

| Method | Path | Deskripsi |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/logs | List logs, param: q, page, limit |
| POST | /api/logs | Simpan data baru |
| PUT | /api/logs/:id | Update data (edit inline) |
| DELETE | /api/logs/:id | Hapus data |
| GET | /api/logs/:id/foto | Serve file foto |

## Query Pencarian
```
GET /api/logs?q=AA8975&page=1&limit=25
```
SQL: `WHERE no_lapen LIKE ? OR no_kendaraan LIKE ? OR nama_checker LIKE ?`

## Acceptance Criteria
- [ ] Tabel `form_logs` terbuat otomatis saat server start
- [ ] Semua endpoint merespons dengan format JSON `{success, data, message}`
- [ ] Pagination berjalan benar
- [ ] Pencarian case-insensitive
- [ ] Foto bisa diakses via URL langsung
