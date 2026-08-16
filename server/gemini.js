/**
 * Gemini Vision AI module — Uses Google Gemini Flash for high-accuracy form extraction.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Gets a fresh instance of GoogleGenerativeAI using current process.env.GEMINI_API_KEY
 */
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }
  return new GoogleGenerativeAI(apiKey.trim());
}

/**
 * Detects MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Converts local file to GoogleGenerativeAI Part object
 */
function fileToGenerativePart(filePath) {
  const mimeType = getMimeType(filePath);
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType
    },
  };
}

/**
 * Extracts structured form data using Gemini Vision model
 * @param {string} imagePath 
 * @returns {Promise<{ fields: object, confidence: number, rawText: string }>}
 */
async function extractWithGemini(imagePath) {
  const genAI = getGenAI();

  const fullPath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(__dirname, '../', imagePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File foto tidak ditemukan: ${imagePath}`);
  }

  const imagePart = fileToGenerativePart(fullPath);

  const prompt = `
Kamu adalah sistem Visi AI presisi tinggi untuk pabrik kayu lapis PT SUMBER GRAHA SEJAHTERA (Sampoerna Kayoe).
Analisis foto dokumen fisik "FORM CHECKING ULANG PANJANG LOG" ini dan ekstrak data ke dalam format JSON murni TANPA markdown/backticks/teks tambahan:

{
  "no_lapen": "9393",
  "no_kendaraan": "AA 8979 IB",
  "panjang_log": "260 CM",
  "block": "D.16",
  "nama_checker": "Aris Zain",
  "tanggal": "2026-08-15",
  "diameter_detail": [
    {"d": 25, "qty": 5},
    {"d": 26, "qty": 4},
    {"d": 27, "qty": 10},
    {"d": 28, "qty": 5},
    {"d": 29, "qty": 1},
    {"d": 30, "qty": 5},
    {"d": 31, "qty": 2},
    {"d": 32, "qty": 1},
    {"d": 33, "qty": 3}
  ],
  "marking_s": {
    "pecah": 1,
    "lapuk": 2,
    "bengkok": 1,
    "bontos_ganda": 1,
    "mata_kayu": 1,
    "total_s": 6
  },
  "total": 36
}

PETUNJUK ANALISIS VISUAL PRESISI:
1. "no_lapen": Ambil angka di kotak "NO SAP" / "NO LAPEN" (contoh: 9393).
2. "no_kendaraan": Ambil nomor polisi mobil di kotak "NO MOBIL" (contoh: AA 8979 IB).
3. "panjang_log": Cek judul form di kanan atas, apakah "PANJANG LOG 260 CM" atau "PANJANG LOG 130 CM" (default: "260 CM").
4. "block": Ambil kode block jika ada (contoh: D.16 atau B.16).
5. "nama_checker": Ambil nama checker jika ada (contoh: Aris Zain).
6. "diameter_detail" (TABEL GRADE A / KIRI):
   - Periksa tabel kolom GRADE A di sebelah kiri.
   - Baca turus (tally marks ||||) ATAU angka jumlah di kolom "JML" di sebelah kanan baris diameter Ø.
   - Masukkan ke array "diameter_detail" hanya untuk diameter yang qty-nya > 0.
7. "marking_s" (TABEL ACTUAL / MARKING "S" / KANAN):
   - Perhatikan tabel di bagian kanan berjudul "ACTUAL MARKING S".
   - Tabel ini terdiri dari sub-kolom cacat kayu: PECAH, LAPUK, BENGKOK, BONTOS GANDA, MATA KAYU.
   - Cek setiap tulisan turus ||| atau angka jumlah batang di bawah masing-masing kolom cacat kayu tersebut (misalnya ada 1 turus di PECAH -> pecah: 1, ada 2 turus di LAPUK -> lapuk: 2, dst).
   - "total_s" adalah penjumlahan dari pecah + lapuk + bengkok + bontos_ganda + mata_kayu.
8. "total": Total keseluruhan jumlah batang log kayu Grade A. Ambil angka di bagian TOTAL atau hitung total dari diameter_detail.
9. HANYA kembalikan JSON murni.
`;

  // Try available Gemini Flash model candidates
  const modelCandidates = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.6-flash'];
  let lastError = null;
  let responseText = null;

  for (const modelName of modelCandidates) {
    try {
      console.log(`[Gemini AI] Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, imagePart]);
      responseText = result.response.text().trim();
      if (responseText) {
        console.log(`[Gemini AI] Success with model: ${modelName}`);
        break;
      }
    } catch (err) {
      console.warn(`[Gemini AI] Model ${modelName} failed:`, err.message);
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError || new Error('Semua model Gemini Flash gagal merespons');
  }

  // Clean potential markdown quotes or formatting
  const cleanedJson = responseText
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  const parsedData = JSON.parse(cleanedJson);

  // Normalize diameter detail array
  let diameterDetail = [];
  if (Array.isArray(parsedData.diameter_detail)) {
    diameterDetail = parsedData.diameter_detail
      .map(item => ({
        d: parseInt(item.d || item.diameter, 10),
        qty: parseInt(item.qty || item.jumlah || item.jumlah_batang, 10) || 0
      }))
      .filter(item => !isNaN(item.d) && item.qty > 0);
  }

  // Normalize marking_s object
  const msRaw = parsedData.marking_s || {};
  const marking_s = {
    pecah: parseInt(msRaw.pecah, 10) || 0,
    lapuk: parseInt(msRaw.lapuk, 10) || 0,
    bengkok: parseInt(msRaw.bengkok, 10) || 0,
    bontos_ganda: parseInt(msRaw.bontos_ganda || msRaw.bontos, 10) || 0,
    mata_kayu: parseInt(msRaw.mata_kayu, 10) || 0,
    total_s: parseInt(msRaw.total_s || msRaw.total, 10) || 0
  };

  if (marking_s.total_s === 0) {
    marking_s.total_s = marking_s.pecah + marking_s.lapuk + marking_s.bengkok + marking_s.bontos_ganda + marking_s.mata_kayu;
  }

  const calculatedTotal = diameterDetail.reduce((sum, item) => sum + item.qty, 0);
  const finalTotal = typeof parsedData.total === 'number' && parsedData.total > 0
    ? parsedData.total
    : calculatedTotal;

  const fields = {
    no_lapen: parsedData.no_lapen ? String(parsedData.no_lapen).trim() : null,
    no_kendaraan: parsedData.no_kendaraan ? String(parsedData.no_kendaraan).trim() : null,
    panjang_log: parsedData.panjang_log ? String(parsedData.panjang_log).trim() : '260 CM',
    block: parsedData.block ? String(parsedData.block).trim() : null,
    nama_checker: parsedData.nama_checker ? String(parsedData.nama_checker).trim() : null,
    tanggal: parsedData.tanggal ? String(parsedData.tanggal).trim() : new Date().toISOString().split('T')[0],
    diameter_detail: diameterDetail,
    marking_s: marking_s,
    jumlah_batang: finalTotal,
    total: finalTotal
  };

  return {
    fields,
    confidence: 0.95,
    rawText: responseText
  };
}

module.exports = {
  extractWithGemini
};
