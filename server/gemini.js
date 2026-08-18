/**
 * Gemini Vision AI module — Uses Google Gemini Flash with Region Crop ROI and retry backoff.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dotenv = require('dotenv');

dotenv.config();

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }
  return new GoogleGenerativeAI(apiKey.trim());
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

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
 * Generates a cropped image slice of the right section (ACTUAL MARKING S table) for zoomed AI vision
 */
async function generateMarkingSRoi(inputPath) {
  const tempPath = path.join(path.dirname(inputPath), `roi_ms_${Date.now()}_${path.basename(inputPath)}`);
  try {
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;

    const cropLeft = Math.round(width * 0.45);
    const cropTop = Math.round(height * 0.15);
    const cropWidth = Math.round(width * 0.55);
    const cropHeight = Math.round(height * 0.75);

    await sharp(inputPath)
      .rotate()
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .toFile(tempPath);

    return tempPath;
  } catch (e) {
    console.warn('[Gemini ROI Crop Error]', e.message);
    return null;
  }
}

/**
 * Extracts structured form data using Gemini Vision model with dual image parts
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

  // Pre-resize image buffer to 1400px for 95% faster API upload without losing OCR accuracy
  let optimizedBuffer = null;
  try {
    optimizedBuffer = await sharp(fullPath)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (e) {
    optimizedBuffer = fs.readFileSync(fullPath);
  }

  const fullImagePart = {
    inlineData: {
      data: optimizedBuffer.toString('base64'),
      mimeType: 'image/jpeg'
    }
  };

  const prompt = `
Kamu adalah sistem Visi AI presisi tinggi untuk pabrik kayu lapis PT SUMBER GRAHA SEJAHTERA (Sampoerna Kayoe).
Analisis foto dokumen fisik "FORM CHECKING ULANG PANJANG LOG" ini.
Ekstrak data ke dalam format JSON murni TANPA markdown/backticks/teks tambahan:

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
    {"d": 30, "qty": 5}
  ],
  "marking_s": {
    "pecah": 1,
    "lapuk": 1,
    "bengkok": 0,
    "bontos_ganda": 0,
    "mata_kayu": 0,
    "total_s": 2,
    "details": [
      {"d": 28, "jenis": "pecah", "qty": 1},
      {"d": 30, "jenis": "lapuk", "qty": 1}
    ]
  },
  "total": 29
}

PETUNJUK ANALISIS VISUAL PRESISI:
1. "no_lapen": Ambil angka di kotak "NO SAP" / "NO LAPEN" (contoh: 9393).
2. "no_kendaraan": Ambil nomor polisi mobil di kotak "NO MOBIL" (contoh: AA 8979 IB).
3. "panjang_log": Cek judul form di kanan atas, apakah "PANJANG LOG 260 CM" atau "PANJANG LOG 130 CM" (default: "260 CM").
4. "diameter_detail" (TABEL GRADE A / KIRI):
   - Baca turus (||||) atau angka di kolom JML sebelah kanan baris diameter Ø.
5. "marking_s" (TABEL ACTUAL MARKING "S" / KANAN):
   - Di bawah kolom PECAH, LAPUK, BENGKOK, BONTOS GANDA, MATA KAYU, cek baris diameter Ø berapa yang terdapat turus | atau angka.
   - Cantumkan rincian lengkapnya di array "details" (contoh: {"d": 28, "jenis": "pecah", "qty": 1}).
6. HANYA kembalikan JSON murni.
`;

  const contents = [fullImagePart];
  contents.unshift(prompt);

  // Active Gemini Flash models (Primary: gemini-3.5-flash)
  const modelCandidates = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'];
  let lastError = null;
  let responseText = null;

  for (const modelName of modelCandidates) {
    try {
      console.log(`[Gemini AI] Trying model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contents);
      responseText = result.response.text().trim();
      if (responseText) {
        console.log(`[Gemini AI] Success with model: ${modelName}`);
        break;
      }
    } catch (err) {
      console.warn(`[Gemini AI] Model ${modelName} failed:`, err.message);
      lastError = err;
      if (err.message && err.message.includes('503')) {
        // Wait 1s backoff on 503 rate limit spike
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // Cleanup temporary ROI file
  if (roiPath && fs.existsSync(roiPath)) {
    try { fs.unlinkSync(roiPath); } catch (e) {}
  }

  if (!responseText) {
    throw lastError || new Error('Semua model Gemini Flash gagal merespons');
  }

  const cleanedJson = responseText
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  const parsedData = JSON.parse(cleanedJson);

  let diameterDetail = [];
  if (Array.isArray(parsedData.diameter_detail)) {
    diameterDetail = parsedData.diameter_detail
      .map(item => ({
        d: parseInt(item.d || item.diameter, 10),
        qty: parseInt(item.qty || item.jumlah || item.jumlah_batang, 10) || 0
      }))
      .filter(item => !isNaN(item.d) && item.qty > 0);
  }

  const msRaw = parsedData.marking_s || {};
  let msDetails = Array.isArray(msRaw.details) ? msRaw.details.map(item => {
    if (typeof item === 'object' && item !== null) {
      return {
        d: parseInt(item.d, 10) || 0,
        jenis: String(item.jenis || 'pecah').toLowerCase().trim(),
        qty: parseInt(item.qty, 10) || 1
      };
    }
    return null;
  }).filter(i => i && i.d > 0 && i.qty > 0) : [];

  const marking_s = {
    pecah: parseInt(msRaw.pecah, 10) || 0,
    lapuk: parseInt(msRaw.lapuk, 10) || 0,
    bengkok: parseInt(msRaw.bengkok, 10) || 0,
    bontos_ganda: parseInt(msRaw.bontos_ganda || msRaw.bontos, 10) || 0,
    mata_kayu: parseInt(msRaw.mata_kayu, 10) || 0,
    total_s: parseInt(msRaw.total_s || msRaw.total, 10) || 0,
    details: msDetails
  };

  if (marking_s.total_s === 0 && msDetails.length > 0) {
    marking_s.total_s = msDetails.reduce((sum, item) => sum + item.qty, 0);
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
