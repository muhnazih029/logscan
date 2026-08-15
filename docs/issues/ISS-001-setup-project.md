# ISS-001 — Setup Project & Struktur Direktori

**Status:** [x] Closed  
**Priority:** P0 — Blocker (harus selesai sebelum issue lain)  
**Estimasi:** 2–4 jam (Actual: 15 menit)  
**Phase:** 1

---

## Deskripsi
Inisialisasi project LogScan dari nol: setup Node.js, install semua dependency utama, 
buat struktur folder, dan konfigurasi environment.

## Acceptance Criteria
- [x] `npm install` berjalan tanpa error
- [x] Folder `server/`, `public/`, `uploads/` tersedia
- [x] File `.env.example` berisi semua env variable yang dibutuhkan
- [x] `node server/index.js` bisa dijalankan tanpa crash
- [x] `GET /api/health` mengembalikan `{"status":"ok","timestamp":"..."}`

## Dependencies Utama
```json
{
  "express": "^4.x",
  "better-sqlite3": "^9.x",
  "multer": "^1.x",
  "cors": "^2.x",
  "dotenv": "^16.x"
}
```

## Catatan
- Gunakan `better-sqlite3` (synchronous) bukan `sqlite3` (async) — lebih mudah di Express
- Multer untuk handle multipart upload foto
- Port default: 3000, bisa di-override via env PORT
