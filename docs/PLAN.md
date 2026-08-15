# Implementation Plan — LogScan
**Versi:** 0.1.0  
**Tanggal:** 2026-08-15  
**Berdasarkan:** PRD.md v0.1.0-draft

---

## Gambaran Umum

LogScan adalah PWA (Progressive Web App) berbasis Node.js + Express dengan SQLite sebagai database, 
Tesseract.js untuk OCR lokal, dan Gemini Flash API sebagai AI fallback. 
Berjalan di STB Armbian (RAM 1GB) dan diakses dari HP Android via browser.

---

## Phase 1 — Setup Project & Backend Core

**Tujuan:** Project siap jalan di server, database terbentuk, endpoint dasar tersedia.

### Langkah
1. Init project Node.js (`npm init`)
2. Install dependencies: `express`, `better-sqlite3`, `multer`, `cors`, `dotenv`
3. Buat struktur folder: `server/`, `public/`, `uploads/`
4. Buat `server/db.js` — inisialisasi SQLite, buat tabel `form_logs`
5. Buat `server/index.js` — Express app, middleware, serve static
6. Buat endpoint dasar:
   - `GET /api/health` — health check
   - `GET /api/logs` — list semua data (dengan search query param)
   - `POST /api/logs` — simpan data baru
   - `PUT /api/logs/:id` — update data (edit inline)
   - `GET /api/logs/:id/foto` — serve foto asli
7. Buat `.env.example` untuk konfigurasi (PORT, GEMINI_API_KEY, dll)

**Referensi issue:** ISS-001, ISS-002

---

## Phase 2 — Integrasi OCR Lokal (Tesseract)

**Tujuan:** Server bisa baca teks dari foto form dan parsing ke field yang dibutuhkan.

### Langkah
1. Install `tesseract.js`
2. Buat `server/ocr.js`:
   - Fungsi `extractFromImage(imagePath)` → return `{ fields, confidence }`
   - Pre-process gambar (grayscale, threshold) sebelum OCR via `sharp`
3. Buat `server/parser.js`:
   - Fungsi `parseOCROutput(rawText)` → return object sesuai data model
   - Regex pattern untuk tiap field (No. Lapen, No. Kendaraan, Block, dll)
4. Test dengan beberapa sampel foto form nyata
5. Buat endpoint `POST /api/upload`:
   - Terima foto via multer
   - Simpan ke `/uploads`
   - Jalankan OCR
   - Jika confidence >= 0.9 → simpan otomatis → return `{ status: 'auto', data }`
   - Jika confidence < 0.9 → return `{ status: 'pending', data, confidence }`

**Referensi issue:** ISS-003

---

## Phase 3 — Integrasi AI Fallback (Gemini Flash)

**Tujuan:** Foto yang OCR-nya kurang yakin dikirim ke Gemini untuk ekstraksi lebih akurat.

### Langkah
1. Install `@google/generative-ai`
2. Buat `server/gemini.js`:
   - Fungsi `extractWithGemini(imagePath)` → return `{ fields, confidence: 1.0 }`
   - Prompt engineering: instruksi ke Gemini untuk return JSON sesuai schema
   - Handle error: API limit, timeout, network error → fallback ke form manual
3. Integrate ke endpoint `POST /api/upload`:
   - Jika OCR confidence < 0.9 → panggil `extractWithGemini()`
   - Jika Gemini gagal → return data kosong (form manual)
4. Simpan log API usage untuk monitoring limit harian

**Referensi issue:** ISS-004

---

## Phase 4 — Frontend PWA

**Tujuan:** UI mobile-first yang bisa dipakai checker untuk upload dan lihat tabel.

### Langkah
1. Buat `public/index.html` — struktur 2 halaman: Upload & Tabel
2. Buat `public/style.css` — mobile-first, warna hijau/putih (tema kayu/alam)
3. Buat `public/app.js`:
   - Tab navigation (Upload | Data)
   - Upload page: drag-drop + tap-to-photo, preview sebelum upload, progress indicator
   - Jika response `status: 'pending'` → tampilkan form pre-filled untuk konfirmasi
   - Jika response `status: 'auto'` → tampilkan toast "Tersimpan otomatis ✅"
4. Buat `public/manifest.json` — PWA manifest (icon, nama, warna)
5. Buat `public/sw.js` — Service Worker (cache assets untuk PWA, bukan offline data)
6. Test install PWA di Android

**Referensi issue:** ISS-005

---

## Phase 5 — Tabel, Pencarian, Edit & Verifikasi

**Tujuan:** Checker bisa lihat semua data, cari, edit, dan verifikasi dengan foto asli.

### Langkah
1. Buat tabel data di `app.js`:
   - Load data dari `GET /api/logs`
   - Render tabel dengan kolom: No. Lapen, No. Kendaraan, Block, Jumlah Batang, Tanggal, Status, Aksi
   - Infinite scroll atau pagination (25 baris per halaman)
2. Kolom pencarian real-time:
   - Input search → debounce 300ms → panggil `GET /api/logs?q=...`
   - Filter di server-side (SQLite LIKE query)
3. Tombol "Lihat Foto":
   - Buka modal/overlay dengan foto asli
   - Ukuran foto bisa diperbesar (pinch-to-zoom via touch)
4. Edit inline:
   - Klik field di tabel → jadi input yang bisa diedit
   - Tekan Enter atau klik di luar → auto-save via `PUT /api/logs/:id`
   - Feedback visual: field berubah warna saat diedit dan saat tersimpan
5. Badge status verifikasi: `AUTO` (hijau) vs `MANUAL` (biru) vs `EDITED` (oranye)

**Referensi issue:** ISS-006, ISS-007

---

## Catatan Deployment

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env
# Edit .env: tambahkan GEMINI_API_KEY

# Jalankan server
node server/index.js
# atau pakai PM2 agar auto-restart:
pm2 start server/index.js --name logscan
pm2 save
pm2 startup
```

Server berjalan di port 3000 (default). Akses dari HP: `http://<IP-STB>:3000`

---

## Verification Plan

### Per Phase
- Phase 1: `curl http://localhost:3000/api/health` returns `{"status":"ok"}`
- Phase 2: Upload foto sample → data ter-parse dengan benar
- Phase 3: Upload foto buram → Gemini mengembalikan JSON valid
- Phase 4: PWA bisa diinstall di Chrome Android, upload berhasil
- Phase 5: Pencarian, edit, dan lihat foto berfungsi di HP Android

### Acceptance Criteria Final
- [ ] 50 foto bisa diproses dalam satu hari tanpa crash
- [ ] Foto tersimpan dan bisa dilihat kembali
- [ ] Data bisa dicari dalam < 1 detik
- [ ] Edit inline tersimpan permanen
- [ ] Berjalan di RAM <= 500MB (headroom di STB 1GB)
