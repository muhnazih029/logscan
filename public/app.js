/**
 * LogScan — High-End Ergonomic Mobile PWA Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentPage = 1;
  let totalPages = 1;
  let searchDebounceTimer = null;
  let activeLogData = null; // currently selected log record for matrix editing
  let currentDiameterDetail = []; // array of { d: number, qty: number }

  // DOM Elements
  const scanCameraBtn = document.getElementById('scanCameraBtn');
  const cameraFileInput = document.getElementById('cameraFileInput');
  const uploadProgressCard = document.getElementById('uploadProgressCard');
  const progressTitle = document.getElementById('progressTitle');
  const progressSub = document.getElementById('progressSub');
  const progressBarFill = document.getElementById('progressBarFill');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const logFeedContainer = document.getElementById('logFeedContainer');
  const feedCountBadge = document.getElementById('feedCountBadge');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');

  const matrixModal = document.getElementById('matrixModal');
  const closeMatrixModalBtn = document.getElementById('closeMatrixModalBtn');
  const matrixModalSap = document.getElementById('matrixModalSap');
  const matrixModalNopol = document.getElementById('matrixModalNopol');
  const editSapInput = document.getElementById('editSapInput');
  const editNopolInput = document.getElementById('editNopolInput');
  const matrixTotalDisplay = document.getElementById('matrixTotalDisplay');
  const diameterMatrixGrid = document.getElementById('diameterMatrixGrid');
  const saveMatrixBtn = document.getElementById('saveMatrixBtn');
  const deleteLogBtn = document.getElementById('deleteLogBtn');

  const photoModal = document.getElementById('photoModal');
  const modalPhotoImage = document.getElementById('modalPhotoImage');
  const photoModalTitle = document.getElementById('photoModalTitle');
  const closePhotoModalBtn = document.getElementById('closePhotoModalBtn');

  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  // --- 1. Service Worker & PWA Install ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('[PWA] SW error:', err));
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaInstallBtn.style.display = 'inline-block';
  });

  pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Outcome:', outcome);
    deferredPrompt = null;
    pwaInstallBtn.style.display = 'none';
  });

  // Online / Offline Status
  function updateOnlineStatus() {
    const statusText = document.getElementById('networkStatusText');
    const dot = document.querySelector('.status-dot');
    if (navigator.onLine) {
      statusText.textContent = 'Online';
      dot.style.backgroundColor = '#10b981';
    } else {
      statusText.textContent = 'Offline';
      dot.style.backgroundColor = '#ef4444';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // --- 2. Scan & File Upload Handling ---
  scanCameraBtn.addEventListener('click', () => {
    cameraFileInput.click();
  });

  cameraFileInput.addEventListener('change', async () => {
    const file = cameraFileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Hanya file foto yang diperbolehkan', 'error');
      return;
    }

    uploadProgressCard.style.display = 'block';
    updateProgress(25, 'Mengunggah Foto Form...', 'Mengirim foto ke server...');

    const formData = new FormData();
    formData.append('foto', file);

    try {
      updateProgress(50, 'Menganalisis Form via Vision AI...', 'Membaca No. SAP & matriks diameter log...');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      updateProgress(85, 'Memproses Hasil Extraksi...', 'Menyiapkan rincian diameter log...');

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal mengekstrak foto');

      updateProgress(100, 'Selesai!', 'Data berhasil diekstrak.');

      if (result.status === 'auto') {
        showToast('✅ Form berhasil dibaca dan disimpan otomatis!', 'success');
        loadLogFeed();
      } else {
        showToast('ℹ️ Form dibaca, buka modal untuk verifikasi diameter', 'warning');
        openMatrixModal(result.data);
      }
    } catch (err) {
      console.error('[Upload Error]', err);
      showToast(err.message || 'Gagal memproses foto form', 'error');
    } finally {
      setTimeout(() => {
        uploadProgressCard.style.display = 'none';
        cameraFileInput.value = '';
      }, 1000);
    }
  });

  function updateProgress(percent, title, sub) {
    progressBarFill.style.width = `${percent}%`;
    progressTitle.textContent = title;
    progressSub.textContent = sub;
  }

  // --- 3. Log Feed Loading & Search ---
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentPage = 1;
      loadLogFeed();
    }, 300);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    currentPage = 1;
    loadLogFeed();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadLogFeed();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadLogFeed();
    }
  });

  async function loadLogFeed() {
    logFeedContainer.innerHTML = '<div class="empty-feed"><span class="spinner-lg"></span><p style="margin-top:12px">Memuat data log...</p></div>';

    const query = encodeURIComponent(searchInput.value.trim());
    try {
      const response = await fetch(`/api/logs?q=${query}&page=${currentPage}&limit=25`);
      const result = await response.json();

      if (!result.success) throw new Error(result.error);

      const logs = result.data || [];
      const pagination = result.pagination;

      totalPages = pagination.totalPages || 1;
      currentPage = pagination.page || 1;

      feedCountBadge.textContent = `${pagination.total} Form`;
      paginationInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= totalPages;

      if (logs.length === 0) {
        logFeedContainer.innerHTML = `
          <div class="empty-feed">
            <div class="empty-icon">🪵</div>
            <h3>${searchInput.value ? 'Tidak Ditemukan' : 'Belum Ada Data Log'}</h3>
            <p>${searchInput.value ? 'Coba kata kunci pencarian lain.' : 'Ketuk "Ambil Foto Form Baru" di atas untuk mulai mendigitalisasi form.'}</p>
          </div>
        `;
        return;
      }

      logFeedContainer.innerHTML = logs.map(row => renderLogCard(row)).join('');
      attachCardEvents();
    } catch (err) {
      console.error('[Feed Error]', err);
      logFeedContainer.innerHTML = `<div class="empty-feed"><p style="color:#dc2626">Gagal memuat data: ${err.message}</p></div>`;
    }
  }

  function renderLogCard(row) {
    const diameterDetails = Array.isArray(row.diameter_detail) ? row.diameter_detail : [];
    
    // Generate diameter pill tags
    let pillsHtml = '';
    if (diameterDetails.length > 0) {
      const topPills = diameterDetails.slice(0, 4);
      pillsHtml = topPills.map(item => `
        <span class="dia-pill">Ø${item.d}: <strong>${item.qty} btg</strong></span>
      `).join('');
      if (diameterDetails.length > 4) {
        pillsHtml += `<span class="dia-pill">+${diameterDetails.length - 4} lagi</span>`;
      }
    } else {
      pillsHtml = '<span class="dia-pill" style="color:#94a3b8">Belum ada rincian diameter</span>';
    }

    const badgeClass = row.status_verifikasi === 'auto' ? 'badge-auto' : (row.status_verifikasi === 'edited' ? 'badge-edited' : 'badge-manual');

    return `
      <div class="form-card" data-id="${row.id}" data-json='${escapeHtml(JSON.stringify(row))}'>
        <div class="card-top-row">
          <div class="sap-number">No. SAP: ${escapeHtml(row.no_lapen || '-')}</div>
          <div class="nopol-tag">${escapeHtml(row.no_kendaraan || 'No Mobil -')}</div>
        </div>

        <div class="card-main-stat">
          <span class="stat-label">Total Batang Log</span>
          <div class="stat-number">${row.jumlah_batang || row.total || 0}<span class="stat-unit">btg</span></div>
        </div>

        <div class="diameter-pills-row">
          ${pillsHtml}
        </div>

        <div class="card-footer-row">
          <span class="badge-status ${badgeClass}">${row.status_verifikasi || 'manual'}</span>
          <div class="card-actions">
            ${row.foto_path ? `<button class="btn-card-action btn-view-photo" data-foto="${row.foto_path}">📷 Foto</button>` : ''}
            <button class="btn-card-action btn-edit-matrix">📊 Matriks Diameter</button>
          </div>
        </div>
      </div>
    `;
  }

  function attachCardEvents() {
    document.querySelectorAll('.form-card').forEach(card => {
      const rawJson = card.getAttribute('data-json');
      const logData = JSON.parse(rawJson);

      // Tap card or edit matrix button -> open Diameter Tally Matrix Editor
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-view-photo')) {
          e.stopPropagation();
          const fotoPath = e.target.getAttribute('data-foto');
          openPhotoModal(fotoPath, logData.no_lapen);
          return;
        }
        openMatrixModal(logData);
      });
    });
  }

  // --- 4. Diameter Tally Matrix Grid Editor ---
  function openMatrixModal(logData) {
    activeLogData = logData;
    currentDiameterDetail = Array.isArray(logData.diameter_detail) ? [...logData.diameter_detail] : [];

    matrixModalSap.textContent = logData.no_lapen || '-';
    matrixModalNopol.textContent = logData.no_kendaraan || '-';
    editSapInput.value = logData.no_lapen || '';
    editNopolInput.value = logData.no_kendaraan || '';

    renderMatrixGrid();
    matrixModal.style.display = 'flex';
  }

  function renderMatrixGrid() {
    // Generate Ø 20 cm to Ø 50 cm buttons
    const cells = [];
    const qtyMap = {};
    currentDiameterDetail.forEach(item => {
      qtyMap[item.d] = item.qty;
    });

    let calculatedTotal = 0;

    for (let d = 20; d <= 50; d++) {
      const qty = qtyMap[d] || 0;
      calculatedTotal += qty;

      cells.push(`
        <div class="matrix-cell" data-d="${d}">
          <div class="matrix-label">Ø ${d} cm</div>
          <div class="matrix-controls">
            <button class="btn-qty btn-minus" data-d="${d}">-</button>
            <input type="number" class="matrix-qty-input" data-d="${d}" value="${qty}" min="0">
            <button class="btn-qty btn-plus" data-d="${d}">+</button>
          </div>
        </div>
      `);
    }

    diameterMatrixGrid.innerHTML = cells.join('');
    matrixTotalDisplay.textContent = calculatedTotal;

    // Attach +/- buttons and input events
    diameterMatrixGrid.querySelectorAll('.btn-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = parseInt(btn.getAttribute('data-d'), 10);
        updateDiameterQty(d, -1);
      });
    });

    diameterMatrixGrid.querySelectorAll('.btn-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = parseInt(btn.getAttribute('data-d'), 10);
        updateDiameterQty(d, 1);
      });
    });

    diameterMatrixGrid.querySelectorAll('.matrix-qty-input').forEach(input => {
      input.addEventListener('change', () => {
        const d = parseInt(input.getAttribute('data-d'), 10);
        const val = parseInt(input.value, 10) || 0;
        setDiameterQty(d, val);
      });
    });
  }

  function updateDiameterQty(diameter, delta) {
    const existingIndex = currentDiameterDetail.findIndex(item => item.d === diameter);
    if (existingIndex >= 0) {
      const newQty = Math.max(0, currentDiameterDetail[existingIndex].qty + delta);
      if (newQty === 0) {
        currentDiameterDetail.splice(existingIndex, 1);
      } else {
        currentDiameterDetail[existingIndex].qty = newQty;
      }
    } else if (delta > 0) {
      currentDiameterDetail.push({ d: diameter, qty: delta });
    }
    renderMatrixGrid();
  }

  function setDiameterQty(diameter, qty) {
    const existingIndex = currentDiameterDetail.findIndex(item => item.d === diameter);
    if (qty <= 0) {
      if (existingIndex >= 0) currentDiameterDetail.splice(existingIndex, 1);
    } else {
      if (existingIndex >= 0) {
        currentDiameterDetail[existingIndex].qty = qty;
      } else {
        currentDiameterDetail.push({ d: diameter, qty: qty });
      }
    }
    renderMatrixGrid();
  }

  closeMatrixModalBtn.addEventListener('click', () => matrixModal.style.display = 'none');

  saveMatrixBtn.addEventListener('click', async () => {
    if (!activeLogData) return;

    // Filter out zero quantities and sort by diameter
    const validDetails = currentDiameterDetail
      .filter(item => item.qty > 0)
      .sort((a, b) => a.d - b.d);

    const calculatedTotal = validDetails.reduce((sum, item) => sum + item.qty, 0);

    const payload = {
      no_lapen: editSapInput.value.trim(),
      no_kendaraan: editNopolInput.value.trim(),
      diameter_detail: validDetails,
      jumlah_batang: calculatedTotal,
      total: calculatedTotal,
      status_verifikasi: 'edited'
    };

    try {
      let response;
      if (activeLogData.id) {
        // Existing record -> PUT update
        response = await fetch(`/api/logs/${activeLogData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Pending upload -> POST save
        response = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            foto_path: activeLogData.foto_path || '',
            confidence_score: activeLogData.confidence_score || 1.0,
            status_verifikasi: 'manual'
          })
        });
      }

      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error);

      showToast('✅ Perubahan berhasil disimpan ke database!', 'success');
      matrixModal.style.display = 'none';
      loadLogFeed();
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    }
  });

  deleteLogBtn.addEventListener('click', async () => {
    if (!activeLogData || !activeLogData.id) {
      matrixModal.style.display = 'none';
      return;
    }

    if (!confirm(`Hapus form log No. SAP: ${activeLogData.no_lapen || activeLogData.id}?`)) return;

    try {
      const response = await fetch(`/api/logs/${activeLogData.id}`, { method: 'DELETE' });
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error);

      showToast('🗑️ Data berhasil dihapus', 'success');
      matrixModal.style.display = 'none';
      loadLogFeed();
    } catch (err) {
      showToast('Gagal menghapus data: ' + err.message, 'error');
    }
  });

  // --- 5. Photo Modal Viewer ---
  function openPhotoModal(fotoPath, sapTitle) {
    if (!fotoPath) {
      showToast('Foto tidak tersedia', 'warning');
      return;
    }
    const fullSrc = fotoPath.startsWith('/') ? fotoPath : `/${fotoPath}`;
    modalPhotoImage.src = fullSrc;
    photoModalTitle.textContent = `Foto Form Fisik (SAP: ${sapTitle || '-'})`;
    photoModal.style.display = 'flex';
  }

  closePhotoModalBtn.addEventListener('click', () => photoModal.style.display = 'none');

  [matrixModal, photoModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // --- 6. Toast Notification Helper ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Helper
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Initial Load
  updateOnlineStatus();
  loadLogFeed();
});
