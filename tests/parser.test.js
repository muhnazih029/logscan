const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseOCROutput, calculateConfidence } = require('../server/parser');

describe('Parser Unit Tests', () => {
  test('parseOCROutput() correctly extracts standard form fields', () => {
    const rawText = `
      PT SUMBER GRAHA SEJAHTERA
      FORM CHECKING ULANG PANJANG LOG 260 CM
      NO SAP: 9393
      NO MOBIL: AA 8979 IB
      TANGGAL MASUK: 12.08
      BLOCK: B.16
      CHECKER: Zain
      GRADE A: 35
      TOTAL: 32
    `;

    const result = parseOCROutput(rawText);

    assert.equal(result.no_lapen, '9393');
    assert.equal(result.no_kendaraan, 'AA 8979 IB');
    assert.equal(result.block, 'B.16');
    assert.equal(result.nama_checker, 'Zain');
    assert.equal(result.total, 32);
    assert.equal(result.jumlah_batang, 32);
  });

  test('parseOCROutput() handles varied formatting and lowercases', () => {
    const rawText = `
      No Lapen: 3205
      No. Kendaraan: B 1234 CD
      Blok: A-01
      Petugas: Budi
      Tgl: 15/08/2026
      Jumlah: 45
    `;

    const result = parseOCROutput(rawText);

    assert.equal(result.no_lapen, '3205');
    assert.equal(result.no_kendaraan, 'B 1234 CD');
    assert.equal(result.block, 'A-01');
    assert.equal(result.nama_checker, 'Budi');
    assert.equal(result.total, 45);
  });

  test('calculateConfidence() computes score accurately', () => {
    const fullFields = {
      no_lapen: '9393',
      no_kendaraan: 'AA 8979 IB',
      block: 'B.16',
      total: 32
    };

    const scoreFull = calculateConfidence(fullFields, 90);
    // completeness (1.0 * 0.7) + ocr (0.9 * 0.3) = 0.7 + 0.27 = 0.97
    assert.equal(scoreFull, 0.97);

    const partialFields = {
      no_lapen: '9393',
      no_kendaraan: null,
      block: null,
      total: null
    };

    const scorePartial = calculateConfidence(partialFields, 50);
    // completeness (0.25 * 0.7 = 0.175) + ocr (0.5 * 0.3 = 0.15) = 0.325 -> 0.32
    assert.equal(scorePartial, 0.32);
  });
});
