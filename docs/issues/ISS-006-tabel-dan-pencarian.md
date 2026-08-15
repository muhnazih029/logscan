# ISS-006 — Tabel Data & Kolom Pencarian

**Status:** [ ] Open  
**Priority:** P1  
**Estimasi:** 4–6 jam  
**Phase:** 5  
**Depends on:** ISS-005, ISS-002

---

## Deskripsi
Halaman Data menampilkan semua record dalam tabel yang bisa dicari secara real-time.
Tabel harus responsive di HP Android dan ringan (tidak load semua data sekaligus).

## Kolom Tabel

| Kolom | Lebar | Keterangan |
|---|---|---|
| No. Lapen | 100px | Bisa diklik untuk sort |
| No. Kendaraan | 110px | - |
| Block | 70px | - |
| Jumlah Batang | 80px | Right-align |
| Tanggal | 90px | Format: DD/MM/YYYY |
| Status | 70px | Badge: AUTO/MANUAL/EDITED |
| Aksi | 60px | Ikon foto + ikon edit |

## Pencarian
- Input search di atas tabel
- Debounce 300ms sebelum kirim request
- Cari di: no_lapen, no_kendaraan, nama_checker
- Tampilkan "X hasil ditemukan" atau "Tidak ada data"
- Clear button (X) di ujung input

## Pagination
- 25 baris per halaman
- Tombol Prev / Next + info "Halaman 1 dari 4"
- Scroll ke atas otomatis saat pindah halaman

## Mobile Optimization
- Tabel bisa di-scroll horizontal jika layar sempit
- Sticky header saat scroll
- Tap baris -> expand detail (accordion) untuk data lengkap
  - Karena layar sempit, tidak semua kolom muat

## Acceptance Criteria
- [x] Tabel load data pertama kali dalam < 2 detik
- [x] Pencarian menampilkan hasil dalam < 500ms (real-time debounce)
- [x] Pagination berfungsi benar
- [x] Sticky header saat scroll vertikal
- [x] Tabel readable di layar 360px
