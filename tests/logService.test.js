const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const LogService = require('../server/services/logService');

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE form_logs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      no_lapen          TEXT,
      no_kendaraan      TEXT,
      block             TEXT,
      nama_checker      TEXT,
      tanggal           DATE,
      jumlah_batang     INTEGER,
      diameter_detail   TEXT,
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

describe('LogService Unit Tests', () => {
  let db;
  let logService;

  beforeEach(() => {
    db = createTestDb();
    logService = new LogService(db);
  });

  test('createLog() inserts a new log record correctly', () => {
    const newLog = logService.createLog({
      no_lapen: '9393',
      no_kendaraan: 'AA 8979 IB',
      block: 'B.16',
      nama_checker: 'Zain',
      jumlah_batang: 32,
      diameter_detail: [{ d: 30, qty: 5 }, { d: 32, qty: 10 }],
      total: 32,
      confidence_score: 0.95,
      status_verifikasi: 'auto'
    });

    assert.equal(newLog.id, 1);
    assert.equal(newLog.no_lapen, '9393');
    assert.equal(newLog.no_kendaraan, 'AA 8979 IB');
    assert.equal(newLog.block, 'B.16');
    assert.equal(newLog.nama_checker, 'Zain');
    assert.equal(newLog.jumlah_batang, 32);
    assert.equal(newLog.confidence_score, 0.95);
    assert.equal(newLog.status_verifikasi, 'auto');
    assert.deepEqual(newLog.diameter_detail, [{ d: 30, qty: 5 }, { d: 32, qty: 10 }]);
  });

  test('getLogs() supports pagination and search queries', () => {
    logService.createLog({ no_lapen: '9393', no_kendaraan: 'AA 8979 IB', block: 'B.16', nama_checker: 'Zain' });
    logService.createLog({ no_lapen: '4455', no_kendaraan: 'B 1234 CD', block: 'A.01', nama_checker: 'Budi' });
    logService.createLog({ no_lapen: '9900', no_kendaraan: 'AA 1122 EF', block: 'B.16', nama_checker: 'Andi' });

    // Search query 'AA'
    const resultSearch = logService.getLogs({ q: 'AA', page: 1, limit: 10 });
    assert.equal(resultSearch.data.length, 2);
    assert.equal(resultSearch.pagination.total, 2);

    // Search query 'Zain'
    const resultChecker = logService.getLogs({ q: 'Zain' });
    assert.equal(resultChecker.data.length, 1);
    assert.equal(resultChecker.data[0].nama_checker, 'Zain');

    // Pagination limit test
    const pageResult = logService.getLogs({ page: 1, limit: 2 });
    assert.equal(pageResult.data.length, 2);
    assert.equal(pageResult.pagination.totalPages, 2);
  });

  test('getLogById() returns record or null', () => {
    const created = logService.createLog({ no_lapen: '1001', no_kendaraan: 'H 5566 KK' });
    const fetched = logService.getLogById(created.id);
    assert.equal(fetched.no_lapen, '1001');

    const notFound = logService.getLogById(999);
    assert.equal(notFound, null);
  });

  test('updateLog() performs partial inline updates', () => {
    const initial = logService.createLog({
      no_lapen: '1001',
      no_kendaraan: 'H 5566 KK',
      jumlah_batang: 10,
      status_verifikasi: 'auto'
    });

    const updated = logService.updateLog(initial.id, {
      jumlah_batang: 15,
      nama_checker: 'Kukuh'
    });

    assert.equal(updated.no_lapen, '1001'); // unchanged
    assert.equal(updated.jumlah_batang, 15); // updated
    assert.equal(updated.nama_checker, 'Kukuh'); // updated
    assert.equal(updated.status_verifikasi, 'edited'); // default update status
  });

  test('deleteLog() removes the record', () => {
    const created = logService.createLog({ no_lapen: '9999' });
    const isDeleted = logService.deleteLog(created.id);
    assert.equal(isDeleted, true);

    const fetched = logService.getLogById(created.id);
    assert.equal(fetched, null);

    const deleteNonExisting = logService.deleteLog(999);
    assert.equal(deleteNonExisting, false);
  });
});
