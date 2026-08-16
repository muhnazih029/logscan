/**
 * Async Task Queue for AI background extractions.
 * Processes background tasks sequentially (or limited concurrency) without database lock clashes or API rate limit overloads.
 */

const { extractWithGemini } = require('../gemini');
const { extractFromImage } = require('../ocr');

class AIProcessingQueue {
  constructor(logService) {
    this.logService = logService;
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(logId, filePath) {
    console.log(`[AI Queue] Enqueuing log #${logId} for background AI processing...`);
    this.queue.push({ logId, filePath });
    this.processNext();
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();

    try {
      console.log(`[AI Queue] Processing log #${task.logId} (${this.queue.length} items remaining in queue)...`);
      let extractionResult = null;
      let engineUsed = 'none';

      // 1. Try Gemini Vision AI first
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        try {
          console.log(`[AI Queue] Running Gemini AI for #${task.logId}...`);
          extractionResult = await extractWithGemini(task.filePath);
          engineUsed = 'gemini';
        } catch (geminiErr) {
          console.warn(`[AI Queue] Gemini AI failed for #${task.logId}:`, geminiErr.message);
        }
      }

      // 2. Fallback to Tesseract OCR if Gemini failed or unconfigured
      if (!extractionResult) {
        try {
          console.log(`[AI Queue] Running Tesseract OCR fallback for #${task.logId}...`);
          extractionResult = await extractFromImage(task.filePath);
          engineUsed = 'ocr';
        } catch (ocrErr) {
          console.warn(`[AI Queue] Tesseract OCR failed for #${task.logId}:`, ocrErr.message);
        }
      }

      // 3. Save extracted fields to DB asynchronously
      if (extractionResult && extractionResult.fields) {
        await this.logService.updateLog(task.logId, {
          ...extractionResult.fields,
          confidence_score: extractionResult.confidence || 0.95,
          status_verifikasi: 'auto'
        });
        console.log(`[AI Queue] Log #${task.logId} extracted via ${engineUsed} and updated to 'auto' ✅`);
      } else {
        // Mark as failed but keep image for manual entry
        await this.logService.updateLog(task.logId, {
          status_verifikasi: 'failed'
        });
        console.warn(`[AI Queue] Extraction failed for #${task.logId}. Saved as 'failed' for manual entry.`);
      }
    } catch (err) {
      console.error(`[AI Queue Exception] Log #${task.logId}:`, err.message);
      try {
        await this.logService.updateLog(task.logId, { status_verifikasi: 'failed' });
      } catch (dbErr) {
        console.error('[AI Queue DB Error]', dbErr.message);
      }
    } finally {
      this.isProcessing = false;
      // Continue next task in queue asynchronously
      setImmediate(() => this.processNext());
    }
  }

  getPendingCount() {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }
}

module.exports = AIProcessingQueue;
