/**
 * OCR module — Uses Sharp for image pre-processing and Tesseract.js for text extraction.
 */

const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { parseOCROutput, calculateConfidence } = require('./parser');

/**
 * Preprocesses an image to improve OCR accuracy for document forms
 * @param {string} inputPath 
 * @returns {Promise<string>} Path to temporary preprocessed image
 */
async function preprocessImage(inputPath) {
  const tempFilename = `temp_${Date.now()}_${path.basename(inputPath)}`;
  const tempPath = path.join(path.dirname(inputPath), tempFilename);

  await sharp(inputPath)
    .rotate() // Auto-orient based on EXIF
    .grayscale() // Convert to grayscale
    .linear(1.2, -10) // Increase contrast slightly
    .threshold(140) // Binarization / thresholding for crisp text
    .toFile(tempPath);

  return tempPath;
}

/**
 * Extracts text and structured fields from an image using Tesseract.js
 * @param {string} imagePath Absolute or relative path to image
 * @returns {Promise<{ fields: object, rawText: string, confidence: number, tesseractConfidence: number }>}
 */
async function extractFromImage(imagePath) {
  let tempPath = null;
  let worker = null;

  try {
    const fullPath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(__dirname, '../', imagePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File foto tidak ditemukan: ${imagePath}`);
    }

    // Step 1: Preprocess image with Sharp
    tempPath = await preprocessImage(fullPath);

    // Step 2: Initialize Tesseract worker
    worker = await createWorker('ind+eng'); // Indonesian & English languages

    // Step 3: Recognize text
    const { data: { text, confidence: rawConfidence } } = await worker.recognize(tempPath);

    // Step 4: Parse structured fields
    const fields = parseOCROutput(text);

    // Step 5: Calculate overall confidence score
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
    // Cleanup worker
    if (worker) {
      await worker.terminate();
    }
    // Cleanup temporary preprocessed image
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {
        // ignore cleanup error
      }
    }
  }
}

module.exports = {
  preprocessImage,
  extractFromImage
};
