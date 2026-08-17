/**
 * OCR module — Uses Sharp for image pre-processing and Tesseract.js for text extraction.
 * Includes Warm Worker Singleton for ultra-fast <150ms Header ROI OCR.
 */

const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { parseOCROutput, calculateConfidence } = require('./parser');

let globalWorkerPromise = null;

/**
 * Returns a warm singleton instance of Tesseract Worker kept in RAM
 */
async function getTesseractWorker() {
  if (!globalWorkerPromise) {
    globalWorkerPromise = (async () => {
      console.log('[Tesseract Singleton] Initializing warm worker instance in RAM...');
      const worker = await createWorker('ind+eng');
      console.log('[Tesseract Singleton] Warm worker ready in RAM ✅');
      return worker;
    })();
  }
  return await globalWorkerPromise;
}

/**
 * Preprocesses an image with Sharp to enhance text contrast without destructive thresholding
 * @param {string} inputPath 
 * @returns {Promise<string>} Path to temporary preprocessed image
 */
async function preprocessImage(inputPath) {
  const tempFilename = `temp_${Date.now()}_${path.basename(inputPath)}`;
  const tempPath = path.join(path.dirname(inputPath), tempFilename);

  await sharp(inputPath)
    .rotate()
    .grayscale()
    .normalize() // Adjusts contrast dynamically
    .sharpen()
    .toFile(tempPath);

  return tempPath;
}

/**
 * Fast Header ROI (Region of Interest) local OCR extraction.
 * Uses warm worker singleton for <150ms instant SAP & Nopol detection.
 * @param {string} imagePath 
 * @returns {Promise<{ no_lapen: string|null, no_kendaraan: string|null, total: number|null, panjang_log: string }>}
 */
async function extractHeaderROI(imagePath) {
  let tempPath = null;
  const startMs = Date.now();

  try {
    const fullPath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(__dirname, '../', imagePath);

    if (!fs.existsSync(fullPath)) {
      return { no_lapen: null, no_kendaraan: null, total: null, panjang_log: '260 CM' };
    }

    const metadata = await sharp(fullPath).metadata();
    const cropWidth = metadata.width || 1000;
    const cropHeight = Math.round((metadata.height || 1000) * 0.40); // Top 40% of form

    tempPath = path.join(path.dirname(fullPath), `header_${Date.now()}_${path.basename(fullPath)}`);

    await sharp(fullPath)
      .rotate()
      .extract({ left: 0, top: 0, width: cropWidth, height: cropHeight })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(tempPath);

    const worker = await getTesseractWorker();
    const { data: { text } } = await worker.recognize(tempPath);
    const fields = parseOCROutput(text);

    const duration = Date.now() - startMs;
    console.log(`[Header ROI OCR] Extracted in ${duration}ms:`, fields);

    return {
      no_lapen: fields.no_lapen || null,
      no_kendaraan: fields.no_kendaraan || null,
      total: fields.total || null,
      panjang_log: fields.panjang_log || '260 CM'
    };
  } catch (err) {
    console.warn('[Header ROI OCR Error]', err.message);
    return { no_lapen: null, no_kendaraan: null, total: null, panjang_log: '260 CM' };
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  }
}

/**
 * Extracts text and structured fields from an image using Tesseract.js
 * @param {string} imagePath Absolute or relative path to image
 * @returns {Promise<{ fields: object, rawText: string, confidence: number, tesseractConfidence: number }>}
 */
async function extractFromImage(imagePath) {
  let tempPath = null;

  try {
    const fullPath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(__dirname, '../', imagePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File foto tidak ditemukan: ${imagePath}`);
    }

    tempPath = await preprocessImage(fullPath);
    const worker = await getTesseractWorker();

    const { data: { text, confidence: rawConfidence } } = await worker.recognize(tempPath);
    const fields = parseOCROutput(text);
    const finalConfidence = calculateConfidence(fields, rawConfidence);

    return {
      fields,
      rawText: text,
      tesseractConfidence: rawConfidence,
      confidence: finalConfidence
    };
  } catch (err) {
    console.error('[OCR Error]', err.message);
    throw err;
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {}
    }
  }
}

module.exports = {
  preprocessImage,
  extractHeaderROI,
  extractFromImage,
  getTesseractWorker
};
