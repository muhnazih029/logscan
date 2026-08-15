# ISS-007 — Edit Inline & Verifikasi Foto

**Status:** [ ] Open  
**Priority:** P1  
**Estimasi:** 4–6 jam  
**Phase:** 5  
**Depends on:** ISS-006

---

## Deskripsi
Dua fitur verifikasi data: (1) Edit inline langsung di tabel, (2) Tombol lihat foto asli 
dengan modal overlay untuk checking ulang data oleh checker.

## Edit Inline

### Behavior
```
User tap cell di tabel -> cell berubah jadi <input> yang sudah berisi nilai saat ini
User ubah nilai
User tekan Enter ATAU tap di luar cell
-> PUT /api/logs/:id dengan field yang diubah
-> Cell kembali jadi teks biasa
-> Status berubah jadi 'EDITED' (oranye)
-> Toast: "✏️ Data diperbarui"
```

### Fields yang Bisa Diedit
- no_lapen, no_kendaraan, block, nama_checker, tanggal, jumlah_batang

### Visual States
- Normal: teks biasa
- Hover: background abu muda (petunjuk bisa diklik)
- Editing: border biru, background putih, focus ring
- Saving: spinner kecil di sudut cell
- Saved: flash hijau singkat (0.5 detik)
- Error: flash merah, nilai kembali ke semula

## Lihat Foto Asli

### Behavior
```
User tap ikon foto (kamera) di kolom Aksi
-> Modal overlay terbuka dengan gambar asli
-> Foto bisa diperbesar dengan pinch-to-zoom
-> Tap di luar modal atau tekan X untuk tutup
-> Di bawah foto: ringkasan data yang tersimpan untuk perbandingan
```

### Modal Layout
```
[X tutup]
[=====  FOTO FORM  =====]
[  gambar foto asli     ]
[  (bisa pinch zoom)    ]
[========================]
[ No. Lapen: 3205       ]
[ No. Kend:  AA 8975 IB ]
[ Block:     B16        ]
[ Status: AUTO | 2026-08-15 ]
[  [Edit Data]  [Tutup]  ]
```

## Pinch-to-Zoom
Implementasi dengan CSS transform + touch events:
- `touchstart`: catat posisi 2 jari
- `touchmove`: hitung jarak antar jari, scale image
- `touchend`: finalize scale (min 1x, max 4x)
- Double-tap: toggle antara 1x dan 2x

## Acceptance Criteria
- [x] Edit inline berfungsi untuk semua field yang bisa diedit
- [x] Perubahan tersimpan ke database dan langsung terlihat di tabel
- [x] Status badge berubah ke EDITED setelah edit
- [x] Modal foto terbuka dan menampilkan foto asli
- [x] Pinch-to-zoom / responsive image modal di HP Android
- [x] Modal bisa ditutup dengan tap luar atau tombol X
