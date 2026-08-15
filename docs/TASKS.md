# Task Tracker — LogScan
**Terakhir diupdate:** 2026-08-15

Legend: `[ ]` belum | `[/]` sedang dikerjakan | `[x]` selesai | `[!]` blocked

---

## Phase 1 — Setup Project & Backend Core
- [x] Init project Node.js + install dependencies (ISS-001)
- [x] Buat struktur folder server/, public/, uploads/
- [x] Buat server/db.js — inisialisasi SQLite + create table
- [x] Buat server/index.js — Express app + middleware
- [x] Endpoint GET /api/health
- [x] Endpoint GET /api/logs (+ query param pencarian)
- [x] Endpoint POST /api/logs
- [x] Endpoint PUT /api/logs/:id
- [x] Endpoint GET /api/logs/:id/foto
- [x] Buat .env.example
- [x] Test semua endpoint dengan curl / Postman

## Phase 2 — OCR Lokal (Tesseract)
- [ ] Install tesseract.js + sharp (ISS-003)
- [ ] Buat server/ocr.js dengan fungsi extractFromImage()
- [ ] Buat server/parser.js dengan regex pattern per field
- [ ] Endpoint POST /api/upload (terima foto, simpan, jalankan OCR)
- [ ] Logic confidence check (>= 0.9 auto-save, < 0.9 pending)
- [ ] Test dengan 5 foto sampel form nyata
- [ ] Tuning regex parser sampai akurasi >= 70% (sebelum AI fallback)

## Phase 3 — AI Fallback (Gemini)
- [ ] Daftar / siapkan Gemini API key (ISS-004)
- [ ] Install @google/generative-ai
- [ ] Buat server/gemini.js dengan fungsi extractWithGemini()
- [ ] Buat prompt template untuk ekstraksi JSON dari foto form
- [ ] Integrate Gemini ke endpoint /api/upload
- [ ] Handle error: API limit, timeout, network error
- [ ] Buat simple log API usage harian
- [ ] Test dengan foto yang sengaja buram/miring

## Phase 4 — Frontend PWA
- [ ] Buat public/index.html struktur 2 tab (ISS-005)
- [ ] Buat public/style.css mobile-first
- [ ] Upload page: UI foto + preview + progress
- [ ] Logic: handle response status 'auto' vs 'pending'
- [ ] Form konfirmasi (pre-filled) jika status 'pending'
- [ ] Buat public/manifest.json
- [ ] Buat public/sw.js (service worker cache)
- [ ] Test install PWA di Chrome Android

## Phase 5 — Tabel, Pencarian & Edit
- [ ] Render tabel data dari API (ISS-006)
- [ ] Pagination 25 baris per halaman
- [ ] Kolom pencarian real-time dengan debounce (ISS-006)
- [ ] Tombol "Lihat Foto" per baris -> modal foto (ISS-007)
- [ ] Pinch-to-zoom di foto modal (ISS-007)
- [ ] Edit inline per field -> auto-save (ISS-007)
- [ ] Badge status: AUTO / MANUAL / EDITED
- [ ] Test end-to-end di HP Android

## Deployment & QA
- [ ] Deploy ke STB Armbian
- [ ] Setup PM2 untuk auto-restart
- [ ] Test upload 50 foto sekaligus (load test)
- [ ] Cek penggunaan RAM (target <= 500MB)
- [ ] User testing dengan checker lapangan

---

## Catatan & Blockers
_(Tulis di sini jika ada hambatan atau keputusan penting)_

