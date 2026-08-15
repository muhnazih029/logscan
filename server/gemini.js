/**
 * Gemini Vision AI module — Uses Google Gemini 1.5 Flash for high-accuracy form extraction.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Converts local file to GoogleGenerativeAI Part object
 */
function fileToGenerativePart(filePath, mimeType = 'image/jpeg') {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType
    },
  };
}

/**
 * Extracts structured form data using Gemini 1.5 Flash Vision model
 * @param {string} imagePath 
 * @returns {Promise<{ fields: object, confidence: number, rawText: string }>}
 */
async function extractWithGemini(imagePath) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di .env');
  }

  const fullPath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(__dirname, '../', imagePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File foto tidak ditemukan: ${imagePath}`);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const imagePart = fileToGenerativePart(fullPath, 'image/jpeg');

  const prompt = `
Kamu adalah sistem AI visi komputer tingkat tinggi untuk industri perkayuan. 
Analisis foto dokumen "FORM CHECKING ULANG PANJANG LOG 260 CM" ini dan ekstrak data berikut ke dalam JSON murni TANPA markdown/backticks/teks lain:

{
  "no_lapen": "nomor SAP atau Lapen, contoh: 9393",
  "no_kendaraan": "nomor mobil / nopol plat kendaraan, contoh: AA 8979 IB",
  "block": "kode block jika ada, contoh: B.16",
  "nama_checker": "nama checker jika ada",
  "tanggal": "tanggal masuk form jika ada",
  "diameter_detail": [
    {"d": 25, "qty": 5},
    {"d": 27, "qty": 10}
  ],
  "total": 32
}

PETUNJUK PENTING:
1. "no_lapen" adalah angka/kode di kolom "NO SAP" / "NO LAPEN".
2. "no_kendaraan" adalah nomor polisi mobil (contoh: AA 8979 IB).
3. "diameter_detail" adalah tabel rincian diameter (range 20 sampai 50). Hitung turus (tally marks ||||) atau angka jumlah batang di setiap baris diameter Ø.
4. "total" adalah total keseluruhan jumlah batang log kayu. Jika total tercantum di bagian bawah form, ambil angka tersebut. Jika tidak, jumlahkan qty dari diameter_detail.
5. Kembalikan JSON persis sesuai schema di atas.
`;

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();
    
    // Clean potential markdown quotes
    const cleanedJson = responseText
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsedData = JSON.parse(cleanedJson);

    // Validate structure
    const fields = {
      no_lapen: parsedData.no_lapen || null,
      no_kendaraan: parsedData.no_kendaraan || null,
      block: parsedData.block || null,
      nama_checker: parsedData.nama_checker || null,
      tanggal: parsedData.tanggal || new Date().toISOString().split('T')[0],
      diameter_detail: Array.isArray(parsedData.diameter_detail) ? parsedData.diameter_detail : [],
      jumlah_batang: typeof parsedData.total === 'number' ? parsedData.total : 0,
      total: typeof parsedData.total === 'number' ? parsedData.total : 0
    };

    // Calculate total from diameter_detail if total was 0
    if (fields.total === 0 && fields.diameter_detail.length > 0) {
      fields.total = fields.diameter_detail.reduce((sum, item) => sum + (item.qty || 0), 0);
      fields.jumlah_batang = fields.total;
    }

    return {
      fields,
      confidence: 0.95, // Gemini Vision AI high confidence
      rawText: responseText
    };
  } catch (err) {
    console.error('[Gemini AI Error]', err.message);
    throw err;
  }
}

module.exports = {
  extractWithGemini
};
