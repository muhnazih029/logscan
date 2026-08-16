/**
 * Parser module — Extracts structured fields from raw OCR/AI text with smart fallbacks.
 */

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
}

/**
 * Extracts fields from raw OCR text using pattern matching heuristics and smart fallbacks
 * @param {string} rawText 
 * @returns {object} Extracted fields object
 */
function parseOCROutput(rawText) {
  const text = cleanText(rawText);
  const fields = {
    no_lapen: null,
    no_kendaraan: null,
    panjang_log: '260 CM',
    block: null,
    nama_checker: null,
    tanggal: null,
    jumlah_batang: null,
    total: null
  };

  // 1. Match No. SAP / No. Lapen
  const sapMatch = text.match(/(?:NO\.?\s*SAP|NO\.?\s*LAPEN|LAPEN|SAP)[:\s]*([A-Z0-9\/-]+)/i);
  if (sapMatch && sapMatch[1]) {
    fields.no_lapen = sapMatch[1].trim();
  } else {
    // Fallback 1: Find 4 to 6 digit standalone number (e.g. 9393, 8811)
    const numMatch = text.match(/\b(\d{4,6})\b/);
    if (numMatch && numMatch[1]) {
      fields.no_lapen = numMatch[1].trim();
    }
  }

  // 2. Match No. Kendaraan / No. Mobil (Indonesian license plate pattern: e.g. AA 8979 IB, B 1234 CD, H 8888 XY)
  const nopolMatch = text.match(/(?:NO\.?\s*MOBIL|NO\.?\s*KENDARAAN|NO\.?\s*POL|MOBIL)[:\s]*([A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{1,3})/i) ||
                     text.match(/\b([A-Z]{1,2}\s+\d{1,4}\s+[A-Z]{1,3})\b/i);
  if (nopolMatch && nopolMatch[1]) {
    fields.no_kendaraan = nopolMatch[1].replace(/\s+/g, ' ').toUpperCase().trim();
  }

  // 3. Match Panjang Log
  if (/130\s*CM/i.test(text)) {
    fields.panjang_log = '130 CM';
  } else {
    fields.panjang_log = '260 CM';
  }

  // 4. Match Block
  const blockMatch = text.match(/(?:BLOCK|BLOK)[:\s]*([A-Z0-9\.\-]+)/i) ||
                     text.match(/\b([A-Z]\.\d{1,2})\b/i);
  if (blockMatch && blockMatch[1]) {
    fields.block = blockMatch[1].trim().toUpperCase();
  }

  // 5. Match Checker / Nama Checker
  const checkerMatch = text.match(/(?:CHECKER|CHECKER\s*1|PETUGAS)[:\s]*([^\r\n]+)/i);
  if (checkerMatch && checkerMatch[1]) {
    const candidate = checkerMatch[1].trim();
    if (!/FORM|CHECKING|ULANG|PANJANG|LOG/i.test(candidate)) {
      fields.nama_checker = candidate;
    }
  }

  // 6. Match Tanggal
  const dateMatch = text.match(/(?:TANGGAL|TGL)[:\s]*(\d{1,2}[\.\/-]\d{1,2}(?:[\.\/-]\d{2,4})?)/i) ||
                    text.match(/\b(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})\b/);
  if (dateMatch && dateMatch[1]) {
    fields.tanggal = dateMatch[1].trim();
  }

  // 7. Match Total / Jumlah Batang
  const totalMatch = text.match(/(?:TOTAL|JUMLAH|JML)[:\s]*(\d{1,4})\b/i);
  if (totalMatch && totalMatch[1]) {
    const totalVal = parseInt(totalMatch[1], 10);
    fields.total = totalVal;
    fields.jumlah_batang = totalVal;
  }

  return fields;
}

/**
 * Calculates confidence score based on field completeness and OCR score
 * @param {object} fields 
 * @param {number} tesseractConfidence (0 to 100)
 * @returns {number} Normalized confidence score (0.0 to 1.0)
 */
function calculateConfidence(fields, tesseractConfidence = 70) {
  const keys = ['no_lapen', 'no_kendaraan', 'block', 'total'];
  let filledCount = 0;

  keys.forEach(key => {
    if (fields[key] !== null && fields[key] !== undefined && fields[key] !== '') {
      filledCount += 1;
    }
  });

  const completenessScore = filledCount / keys.length;
  const ocrNormalized = Math.min(1.0, Math.max(0.0, tesseractConfidence / 100));
  const finalScore = (completenessScore * 0.7) + (ocrNormalized * 0.3);
  return Math.round(finalScore * 100) / 100;
}

module.exports = {
  parseOCROutput,
  calculateConfidence
};
