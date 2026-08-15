# ISS-005 — Frontend PWA: Upload & Struktur Dasar

**Status:** [ ] Open  
**Priority:** P1  
**Estimasi:** 5–8 jam  
**Phase:** 4  
**Depends on:** ISS-002

---

## Deskripsi
Buat Progressive Web App yang mobile-first untuk checker Android. 
Dua halaman utama: Upload Form dan Lihat Data (tabel).

## Struktur File
```
public/
├── index.html        <- Shell HTML + 2 tab view
├── style.css         <- Mobile-first CSS
├── app.js            <- Main JS (tab nav, upload logic)
├── manifest.json     <- PWA manifest
├── sw.js             <- Service Worker
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Desain UI
- **Warna:** Hijau tua (#2d6a4f) sebagai primary, putih, abu muda
- **Font:** Inter atau Poppins (Google Fonts)
- **Bottom navigation:** 2 tab — "Upload" (ikon kamera) | "Data" (ikon tabel)
- **Upload halaman:**
  - Area besar untuk tap foto / drag-drop
  - Preview foto sebelum upload
  - Progress bar saat upload & proses
  - Toast notification hasil

## Manifest PWA
```json
{
  "name": "LogScan",
  "short_name": "LogScan",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2d6a4f",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

## Alur Upload di Frontend
```
User tap area upload -> file picker terbuka
-> User pilih foto
-> Preview foto tampil
-> User tap "Upload & Proses"
-> Loading spinner + progress text ("Sedang membaca form...")
-> Jika response status 'auto':
     Toast hijau: "✅ Data tersimpan otomatis" + ringkasan data
-> Jika response status 'pending':
     Form pre-filled muncul untuk review
     User koreksi jika perlu
     User tap "Simpan" -> POST ke API
```

## Acceptance Criteria
- [ ] PWA bisa di-install di Chrome Android (Add to Home Screen)
- [ ] Upload foto dari kamera maupun galeri
- [ ] Preview foto sebelum dikirim
- [ ] Loading state yang jelas saat proses OCR/AI (bisa 5-15 detik)
- [ ] Responsive di layar 360px - 414px (ukuran HP umum)
- [ ] Tidak ada scroll horizontal di semua halaman
