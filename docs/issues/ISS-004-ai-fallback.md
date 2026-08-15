# ISS-004 — AI Fallback: Gemini Flash API

**Status:** [x] Closed  
**Priority:** P1  
**Estimasi:** 3–5 jam (Actual: 15 menit)  
**Phase:** 3  
**Depends on:** ISS-003

---

## Deskripsi
Integrasikan Google Gemini Flash API sebagai mesin pengenalan data utama/fallback saat OCR lokal 
menghasilkan confidence < 90%. Gemini membaca tulisan tangan dan rincian turus tabel diameter Ø secara presisi.

## Dependencies
```json
{
  "@google/generative-ai": "^0.x"
}
```

## Prompt Template
```
Kamu adalah sistem ekstraksi data dari foto form checking log kayu.
Analisis foto ini dan kembalikan data dalam format JSON berikut TANPA tambahan teks lain:

{
  "no_lapen": "...",
  "no_kendaraan": "...",
  "block": "...",
  "nama_checker": "...",
  "tanggal": "YYYY-MM-DD",
  "jumlah_batang": 0,
  "diameter_detail": [{"d": 30, "qty": 5}],
  "total": 0
}

Jika field tidak terbaca, isi dengan null. Jangan mengarang nilai.
```

## Error Handling

| Error | Handling |
|---|---|
| Rate limit (429) | Return `{status: 'manual', data: {}}` — form kosong untuk input manual |
| Network timeout | Retry 1x, lalu fallback ke manual |
| JSON parse error | Coba extract JSON dari response, fallback ke manual |
| API key invalid | Log error, fallback ke manual |

## Monitoring API Usage
```js
// Simpan di file json sederhana atau tabel SQLite
{
  "date": "2026-08-15",
  "count": 23,
  "limit": 1500
}
```

## Acceptance Criteria
- [ ] `extractWithGemini(imagePath)` return `{fields, confidence: 1.0}`
- [ ] Prompt menghasilkan JSON valid untuk > 80% foto
- [ ] Semua error ditangani tanpa crash server
- [ ] Usage log bisa dilihat via `GET /api/gemini-usage`
- [ ] Jika API limit habis, sistem fallback ke input manual dengan notif yang jelas

## Catatan
- Gemini Flash free tier: 1.500 request/hari — cukup untuk 50 foto/hari dengan margin
- Kirim foto sebagai base64 ke Gemini Vision API
- Model: `gemini-1.5-flash` (paling hemat token, cukup akurat untuk dokumen)
