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
    // Deduplication check: prevent enqueuing duplicate tasks for the same record
    if (this.queue.some(t => t.logId === logId) || (this.currentTask && this.currentTask.logId === logId)) {
      console.warn(`[AI Queue] Duplicate task ignored for log #${logId}`);
      return;
    }
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
    this.currentTask = task;

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

      // 3. Save extracted fields to DB asynchronously with Smart Manual Edit Lock
      if (extractionResult && extractionResult.fields) {
        const currentRecord = await this.logService.getLogById(task.logId);

        const updateData = {
          diameter_detail: extractionResult.fields.diameter_detail,
          marking_s: extractionResult.fields.marking_s,
          jumlah_batang: extractionResult.fields.jumlah_batang,
          total: extractionResult.fields.total,
          confidence_score: extractionResult.confidence || 0.95,
          status_verifikasi: (currentRecord && currentRecord.status_verifikasi === 'edited') ? 'edited' : 'auto'
        };

        // Only fill header fields if Checker HAS NOT manually edited them yet
        if (!currentRecord || (currentRecord.no_lapen === 'Merekam SAP...' || currentRecord.no_lapen === 'MEMPROSES...')) {
          if (extractionResult.fields.no_lapen) updateData.no_lapen = extractionResult.fields.no_lapen;
        }
        if (!currentRecord || (currentRecord.no_kendaraan === 'Nopol...' || currentRecord.no_kendaraan === 'PROSES AI')) {
          if (extractionResult.fields.no_kendaraan) updateData.no_kendaraan = extractionResult.fields.no_kendaraan;
        }
        if (!currentRecord || currentRecord.status_verifikasi !== 'edited') {
          if (extractionResult.fields.panjang_log) updateData.panjang_log = extractionResult.fields.panjang_log;
        } else {
          console.log(`[AI Queue] Log #${task.logId} has manual header edits -> Preserving user SAP & Nopol!`);
        }

        await this.logService.updateLog(task.logId, updateData);
        const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const totalS = updateData.marking_s ? updateData.marking_s.total_s : 0;
        console.log(`[${timeStr}] 🤖 [GEMINI AI SUCCESS] Log #${task.logId} extracted via ${engineUsed} -> Total: ${updateData.total} btg, Cacat S: ${totalS} btg ✅`);
      } else {
        // Mark as failed but keep image for manual entry
        await this.logService.updateLog(task.logId, {
          status_verifikasi: 'failed'
        });
        const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        console.warn(`[${timeStr}] ⚠️ [AI EXTRACTION FAILED] Log #${task.logId}. Marked as 'failed' for manual entry.`);
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
      this.currentTask = null;
      // Continue next task in queue asynchronously
      setImmediate(() => this.processNext());
    }
  }

  getPendingCount() {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }
}

module.exports = AIProcessingQueue;
