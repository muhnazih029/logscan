const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const LogService = require('../server/services/logService');

async function createTestDb() {
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE form_logs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      no_lapen          TEXT,
      no_kendaraan      TEXT,
      panjang_log       TEXT DEFAULT '260 CM',
      block             TEXT,
      nama_checker      TEXT,
      tanggal           DATE,
      jumlah_batang     INTEGER,
      diameter_detail   TEXT,
      marking_s         TEXT,
      total             INTEGER,
      foto_path         TEXT,
      confidence_score  REAL,
      status_verifikasi TEXT DEFAULT 'manual',
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

describe('LogService Async Unit Tests', () => {
  let db;
  let logService;

  beforeEach(async () => {
    db = await createTestDb();
    logService = new LogService(db);
  });

  test('createLog() inserts a new log record correctly', async () => {
    const newLog = await logService.createLog({
      no_lapen: '9393',
      no_kendaraan: 'AA 8979 IB',
      panjang_log: '260 CM',
      block: 'B.16',
      jumlah_batang: 15,
      diameter_detail: [{ d: 30, qty: 5 }, { d: 32, qty: 10 }]
    });

    assert.ok(newLog.id);
    assert.equal(newLog.no_lapen, '9393');
    assert.equal(newLog.no_kendaraan, 'AA 8979 IB');
    assert.equal(newLog.panjang_log, '260 CM');
    assert.equal(newLog.jumlah_batang, 15);
    assert.deepEqual(newLog.diameter_detail, [{ d: 30, qty: 5 }, { d: 32, qty: 10 }]);
  });

  test('getLogs() supports pagination and search queries', async () => {
    await logService.createLog({ no_lapen: '9393', no_kendaraan: 'AA 8979 IB', block: 'B.16', nama_checker: 'Zain' });
    await logService.createLog({ no_lapen: '4455', no_kendaraan: 'B 1234 CD', block: 'A.01', nama_checker: 'Budi' });
    await logService.createLog({ no_lapen: '9900', no_kendaraan: 'AA 1122 EF', block: 'B.16', nama_checker: 'Andi' });

    // Search query 'AA'
    const resultSearch = await logService.getLogs({ q: 'AA', page: 1, limit: 10 });
    assert.equal(resultSearch.data.length, 2);
    assert.equal(resultSearch.pagination.total, 2);

    // Search query '9393'
    const resultSearchNo = await logService.getLogs({ q: '9393' });
    assert.equal(resultSearchNo.data.length, 1);
    assert.equal(resultSearchNo.data[0].no_lapen, '9393');

    // Pagination limit test
    const pageResult = await logService.getLogs({ page: 1, limit: 2 });
    assert.equal(pageResult.data.length, 2);
  });

  test('getLogById() returns record or null', async () => {
    const created = await logService.createLog({ no_lapen: '8811' });
    const fetched = await logService.getLogById(created.id);
    assert.equal(fetched.no_lapen, '8811');

    const notFound = await logService.getLogById(99999);
    assert.equal(notFound, null);
  });

  test('updateLog() performs partial inline updates', async () => {
    const created = await logService.createLog({ no_lapen: '1000', jumlah_batang: 5 });
    const updated = await logService.updateLog(created.id, { jumlah_batang: 12, status_verifikasi: 'edited' });

    assert.equal(updated.no_lapen, '1000');
    assert.equal(updated.jumlah_batang, 12);
    assert.equal(updated.status_verifikasi, 'edited');
  });

  test('deleteLog() removes the record', async () => {
    const created = await logService.createLog({ no_lapen: '5555' });
    const isDeleted = await logService.deleteLog(created.id);
    assert.equal(isDeleted, true);

    const fetched = await logService.getLogById(created.id);
    assert.equal(fetched, null);
  });

  test('getLogs() detects duplicate no_lapen and flags is_duplicate_lapen = true', async () => {
    const log1 = await logService.createLog({ no_lapen: '9999', no_kendaraan: 'AA 1' });
    const log2 = await logService.createLog({ no_lapen: '9999', no_kendaraan: 'AA 2' });
    const log3 = await logService.createLog({ no_lapen: '7777', no_kendaraan: 'AA 3' });

    const feed = await logService.getLogs({ page: 1, limit: 10 });
    const item1 = feed.data.find(d => d.id === log1.id);
    const item2 = feed.data.find(d => d.id === log2.id);
    const item3 = feed.data.find(d => d.id === log3.id);

    assert.equal(item1.is_duplicate_lapen, true);
    assert.equal(item2.is_duplicate_lapen, true);
    assert.equal(item3.is_duplicate_lapen, false);

    const singleFetch = await logService.getLogById(log1.id);
    assert.equal(singleFetch.is_duplicate_lapen, true);
  });
});
