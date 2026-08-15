# ISS-003 — Integrasi OCR Lokal (Tesseract.js)

**Status:** [ ] Open  
**Priority:** P1  
**Estimasi:** 6–10 jam  
**Phase:** 2  
**Depends on:** ISS-002

---

## Deskripsi
Integrasikan Tesseract.js untuk baca teks dari foto form. Buat parser yang mengekstrak 
field-field spesifik dari raw OCR output. Implementasikan confidence-based routing.

## Dependencies
```json
{
  "tesseract.js": "^5.x",
  "sharp": "^0.x"
}
```

## Alur Proses
```
foto masuk -> sharp (grayscale + threshold) -> tesseract.js -> raw text + confidence
                                                                    |
                                              confidence >= 0.9 -> auto save
                                              confidence < 0.9  -> ke ISS-004 (Gemini)
```

## Field Patterns (Regex)
Form "Checking Ulang Panjang Log 260 CM" memiliki field:

| Field | Contoh Nilai | Strategi Parsing |
|---|---|---|
| No. SAP/Lapen | `3205` | Cari area "NO SAP" lalu ambil angka |
| No. Kendaraan | `AA 8975 IB` | Pola plat kendaraan |
| Block | `B 16` | Cari area "BLOCK" |
| Nama Checker | `Zain` | Area kanan atas form |
| Jumlah Batang | `32` | Cari area "TOTAL" bawah form |

## Pre-processing dengan Sharp
```js
await sharp(inputPath)
  .grayscale()
  .normalize()
  .threshold(128)
  .toFile(processedPath);
```

## Acceptance Criteria
- [ ] `extractFromImage(imagePath)` return `{fields, rawText, confidence}`
- [ ] Parser mengekstrak minimal 4 dari 7 field untuk foto yang jelas
- [ ] Confidence score dihitung dari: (field terisi / total field) * tesseract confidence
- [ ] Foto pre-processed tersimpan sementara lalu dihapus setelah OCR

## Catatan
- Foto tulisan tangan sulit untuk OCR — ekspektasi akurasi OCR murni ~50-70%
- Tesseract butuh waktu ~5-15 detik per foto di Armbian ARM64 — perlu async handling
- Test dengan minimal 10 foto sampel berbeda sebelum ke production
