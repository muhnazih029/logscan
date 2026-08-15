# PRD — LogScan
**Versi:** 0.1.0-draft  
**Tanggal:** 2026-08-15  
**Author:** Muhnazih  
**Status:** Draft — menunggu review

---

## 1. Latar Belakang

PT Sumber Graha Sejahtera Unit Semarang menggunakan **Form Checking Ulang Panjang Log 260 CM** sebagai dokumen fisik pencatatan log kayu yang masuk. Setiap hari terdapat ≥ 50 form yang diisi oleh checker lapangan. Proses pencatatan saat ini dilakukan secara manual sehingga:

- Data rawan hilang atau rusak (kertas basah, robek)
- Rekap data lambat dan memerlukan re-entry manual ke sistem
- Tidak ada cara cepat untuk mencari data berdasarkan No. Kendaraan atau No. Lapen tertentu
- Sulit melakukan verifikasi ulang karena foto/form fisik tidak terorganisir

**LogScan** hadir sebagai solusi digitalisasi ringan: checker cukup foto form, sistem otomatis baca data via OCR + AI, dan data langsung masuk ke tabel yang bisa dicari, diedit, dan diverifikasi dengan melihat foto aslinya.

---

## 2. Tujuan Produk

| Tujuan | Indikator Keberhasilan |
|---|---|
| Eliminasi re-entry manual | 0 data yang harus diketik ulang dari awal jika foto jelas |
| Akurasi data tinggi | ≥ 90% field terisi benar tanpa koreksi manual |
| Mudah dipakai checker | Checker bisa upload & cek data dalam < 30 detik |
| Ringan di infrastruktur | Berjalan di STB Armbian RAM 1GB, storage 8GB SD |
| Bisa dicari cepat | Hasil pencarian tampil < 1 detik |

---

## 3. Pengguna Target

- **Primary:** Checker lapangan (2–5 orang), mengakses via HP Android, browser PWA
- **Secondary (masa depan):** Supervisor/atasan yang butuh laporan ringkasan

---

## 4. Ruang Lingkup (MVP)

### Termasuk MVP
- Upload foto form dari HP Android
- Ekstraksi data otomatis via Tesseract OCR (lokal) + Gemini Flash API (fallback)
- Confidence-based save: auto-save jika >= 90%, minta konfirmasi jika < 90%
- Tabel data dengan kolom pencarian
- Edit inline data di tabel
- Tombol lihat foto asli per baris data
- Penyimpanan data di SQLite
- Penyimpanan foto di filesystem lokal
- PWA (bisa "Add to Home Screen" di Android)

### Tidak termasuk MVP
- Login / autentikasi
- Export Excel/CSV
- Laporan statistik / dashboard
- Notifikasi
- Multi-pabrik / multi-lokasi

---

## 5. Data Model

### Tabel: `form_logs`

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Auto increment |
| `no_lapen` | TEXT | No. SAP / No. Lapen dari form |
| `no_kendaraan` | TEXT | Nomor polisi kendaraan pengangkut |
| `block` | TEXT | Kode block asal kayu |
| `nama_checker` | TEXT | Nama checker dari form atau input |
| `tanggal` | DATE | Tanggal form atau tanggal upload |
| `jumlah_batang` | INTEGER | Total jumlah batang dalam form |
| `diameter_detail` | TEXT (JSON) | Array diameter dan jumlahnya, e.g. [{"d":30,"qty":5}] |
| `total` | INTEGER | Total batang (kalkulasi dari diameter_detail) |
| `foto_path` | TEXT | Path relatif file foto di server |
| `confidence_score` | REAL | Skor kepercayaan OCR/AI (0.0-1.0) |
| `status_verifikasi` | TEXT | 'auto' atau 'manual' |
| `created_at` | DATETIME | Timestamp insert |
| `updated_at` | DATETIME | Timestamp update terakhir |

---

## 6. Alur Kerja Utama

### 6.1 Upload & Ekstraksi
```
Checker buka PWA -> tap "Upload Form"
-> Pilih foto dari kamera / galeri
-> Foto dikirim ke server (multipart/form-data)
-> Server simpan foto ke /uploads/<timestamp>_<filename>
-> Tesseract OCR baca foto
  >= 90% confidence  -> Simpan ke SQLite (status: 'auto') -> Notif "Tersimpan otomatis"
  < 90%  confidence  -> Kirim ke Gemini Flash API -> Form pre-filled -> Checker review -> Simpan
```

### 6.2 Lihat & Cari Data
```
Checker buka tab "Data" -> tabel muncul (50 baris terbaru)
-> Ketik di kolom pencarian (No. Lapen / No. Kendaraan / Tanggal)
-> Tabel filter real-time
-> Klik baris -> lihat detail + foto asli
-> Edit inline jika ada kesalahan -> save
```

---

## 7. Arsitektur Teknis

### Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Vanilla HTML + CSS + JS (PWA) |
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 |
| OCR Lokal | tesseract.js v5 |
| AI Fallback | Google Gemini Flash 1.5 API |
| Runtime Server | STB Armbian (ARM64), RAM 1GB |

### Struktur Direktori Project
```
logscan/
├── docs/           <- PRD, PLAN, TASKS
├── issues/         <- Issue tracker per fitur
├── server/         <- Express backend
├── public/         <- Frontend PWA
├── uploads/        <- Foto form tersimpan
└── package.json
```

---

## 8. Constraint & Asumsi

| Item | Detail |
|---|---|
| Server | STB Armbian ARM64, RAM 1GB, Storage 8GB SD Card |
| Jaringan | Intranet pabrik + 4G, tidak perlu offline |
| Volume | >= 50 foto/hari; estimasi 1 foto ~2-4 MB -> ~100-200 MB/hari |
| API Limit | Gemini Flash: 1.500 req/hari di free tier |
| Bahasa UI | Indonesia |
| Keamanan | Tanpa autentikasi untuk MVP |

---

## 9. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Foto buram / miring | OCR confidence rendah | Panduan foto di UI (overlay frame) |
| Gemini API limit habis | Data tidak bisa diekstrak otomatis | Fallback ke form input manual |
| SD Card penuh | Server tidak bisa simpan foto baru | Alert storage monitor |
| Tulisan tangan tidak konsisten | Akurasi turun | Edit inline selalu tersedia |

---

## 10. Timeline Estimasi (Prototype)

| Phase | Scope | Estimasi |
|---|---|---|
| Phase 1 | Setup project + backend core + database | 1-2 hari |
| Phase 2 | Integrasi OCR lokal (Tesseract) | 1-2 hari |
| Phase 3 | Integrasi AI fallback (Gemini) | 1 hari |
| Phase 4 | Frontend PWA — upload & tabel | 2-3 hari |
| Phase 5 | Edit inline + lihat foto + polish | 1-2 hari |
| **Total** | **MVP prototype siap uji** | **~7-10 hari kerja** |

---

## 11. Open Questions

- [ ] Apakah field Grade dan Jenis Log (Albasia/Jabon/HTR) perlu disimpan juga?
- [ ] Perlukah fitur arsip otomatis foto lama (> 30 hari) untuk jaga storage?
- [ ] Apakah nama project "LogScan" cocok atau ada preferensi lain?
