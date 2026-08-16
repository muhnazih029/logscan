/**
 * LogScan — Sampoerna Kayoe High-End Ergonomic Mobile PWA Logic
 * Instant Upload + Async Background AI Processing Queue
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentPage = 1;
  let totalPages = 1;
  let searchDebounceTimer = null;
  let activeLogData = null; // currently selected log record
  let currentDiameterDetail = []; // array of { d: number, qty: number }
  let currentMarkingS = { pecah: 0, lapuk: 0, bengkok: 0, bontos_ganda: 0, mata_kayu: 0, total_s: 0 };
  let activePanjangFilter = 'all'; // 'all', '260 CM', '130 CM'
  let cropperInstance = null; // Cropper.js instance
  let showOnlyActiveFilter = false; // toggle zero filter
  let queuePollInterval = null;
  let lastProcessingCount = 0;

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

  // Crop Modal Elements
  const cropModal = document.getElementById('cropModal');
  const cropImageTarget = document.getElementById('cropImageTarget');
  const closeCropModalBtn = document.getElementById('closeCropModalBtn');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const confirmCropBtn = document.getElementById('confirmCropBtn');
  const rotateCropBtn = document.getElementById('rotateCropBtn');

  // Matrix & Marking S Modal Elements
  const matrixModal = document.getElementById('matrixModal');
  const closeMatrixModalBtn = document.getElementById('closeMatrixModalBtn');
  const matrixModalSap = document.getElementById('matrixModalSap');
  const matrixModalNopol = document.getElementById('matrixModalNopol');
  const editSapInput = document.getElementById('editSapInput');
  const editNopolInput = document.getElementById('editNopolInput');
  const editPanjangInput = document.getElementById('editPanjangInput');
  const matrixTotalDisplay = document.getElementById('matrixTotalDisplay');
  
  const tabDiameterBtn = document.getElementById('tabDiameterBtn');
  const tabMarkingSBtn = document.getElementById('tabMarkingSBtn');
  const tabContentDiameter = document.getElementById('tabContentDiameter');
  const tabContentMarkingS = document.getElementById('tabContentMarkingS');

  const diameterMatrixGrid = document.getElementById('diameterMatrixGrid');
  const toggleZeroFilterBtn = document.getElementById('toggleZeroFilterBtn');
  
  // Marking S Inputs
  const msPecah = document.getElementById('msPecah');
  const msLapuk = document.getElementById('msLapuk');
  const msBengkok = document.getElementById('msBengkok');
  const msBontos = document.getElementById('msBontos');
  const msMata = document.getElementById('msMata');
  const msTotalDisplay = document.getElementById('msTotalDisplay');

  const saveMatrixBtn = document.getElementById('saveMatrixBtn');
  const deleteLogBtn = document.getElementById('deleteLogBtn');
  const modalViewPhotoBtn = document.getElementById('modalViewPhotoBtn');

  // Photo Modal Elements
  const photoModal = document.getElementById('photoModal');
  const modalPhotoImage = document.getElementById('modalPhotoImage');
  const fullscreenPhotoTitle = document.getElementById('fullscreenPhotoTitle');
  const closePhotoModalBtn = document.getElementById('closePhotoModalBtn');
  const rotatePhotoBtn = document.getElementById('rotatePhotoBtn');

  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  // --- 1. Service Worker & PWA Install ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        reg.update();
      })
      .catch(err => console.log('[PWA] SW error:', err));
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
      dot.style.backgroundColor = '#d9a738';
    } else {
      statusText.textContent = 'Offline';
      dot.style.backgroundColor = '#78716c';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // --- 2. Camera & File Selection ---
  scanCameraBtn.addEventListener('click', () => {
    cameraFileInput.click();
  });

  cameraFileInput.addEventListener('change', () => {
    const file = cameraFileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Hanya file foto yang diperbolehkan', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      openCropModal(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  // --- 3. Interactive Cropper Modal ---
  function openCropModal(imageSrc) {
    cropImageTarget.src = imageSrc;
    cropModal.style.display = 'flex';

    if (cropperInstance) {
      cropperInstance.destroy();
    }

    cropperInstance = new Cropper(cropImageTarget, {
      viewMode: 1,
      autoCropArea: 0.9,
      responsive: true,
      restore: false,
      zoomable: true,
      rotatable: true,
      scalable: true
    });
  }

  rotateCropBtn.addEventListener('click', () => {
    if (cropperInstance) {
      cropperInstance.rotate(90);
    }
  });

  closeCropModalBtn.addEventListener('click', closeCropModal);
  cancelCropBtn.addEventListener('click', closeCropModal);

  function closeCropModal() {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    cropModal.style.display = 'none';
    cameraFileInput.value = '';
  }

  confirmCropBtn.addEventListener('click', () => {
    if (!cropperInstance) return;

    const canvas = cropperInstance.getCroppedCanvas({
      maxWidth: 2048,
      maxHeight: 2048,
      fillColor: '#ffffff'
    });

    if (!canvas) {
      showToast('Gagal memotong gambar', 'error');
      return;
    }

    canvas.toBlob(async (blob) => {
      closeCropModal();
      uploadCroppedBlob(blob);
    }, 'image/jpeg', 0.92);
  });

  async function uploadCroppedBlob(imageBlob) {
    uploadProgressCard.style.display = 'block';
    updateProgress(50, 'Mengunggah Foto Form...', 'Menyimpan foto ke server...');

    const formData = new FormData();
    formData.append('foto', imageBlob, `form_crop_${Date.now()}.jpg`);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal mengunggah foto');

      updateProgress(100, 'Tersimpan!', 'Foto tersimpan. AI sedang mengekstrak di latar belakang.');
      showToast('Foto tersimpan! AI sedang mengekstrak data di latar belakang.', 'info');
      
      loadLogFeed();
      startQueuePolling();

    } catch (err) {
      console.error('[Upload Error]', err);
      showToast(err.message || 'Gagal mengunggah foto form', 'error');
    } finally {
      setTimeout(() => {
        uploadProgressCard.style.display = 'none';
      }, 1000);
    }
  }

  function updateProgress(percent, title, sub) {
    progressBarFill.style.width = `${percent}%`;
    progressTitle.textContent = title;
    progressSub.textContent = sub;
  }

  // --- Background Queue Polling ---
  function startQueuePolling() {
    if (queuePollInterval) return;
    queuePollInterval = setInterval(checkQueueStatus, 3000);
    checkQueueStatus();
  }

  async function checkQueueStatus() {
    try {
      const res = await fetch('/api/processing-count');
      const data = await res.json();
      const count = data.processingCount || 0;

      if (count > 0) {
        lastProcessingCount = count;
        // Reload feed if count changed or processing
        loadLogFeed(true);
      } else if (lastProcessingCount > 0) {
        // Queue just finished!
        lastProcessingCount = 0;
        clearInterval(queuePollInterval);
        queuePollInterval = null;
        showToast('✅ Semua foto form selesai diproses AI!', 'success');
        loadLogFeed();
      } else {
        clearInterval(queuePollInterval);
        queuePollInterval = null;
      }
    } catch (err) {
      console.warn('[Queue Poll Error]', err);
    }
  }

  // --- 4. Length Filter Tabs & Search ---
  document.querySelectorAll('.tab-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePanjangFilter = btn.getAttribute('data-panjang');
      currentPage = 1;
      loadLogFeed();
    });
  });

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

  async function loadLogFeed(isBackgroundRefresh = false) {
    if (!isBackgroundRefresh) {
      logFeedContainer.innerHTML = '<div class="empty-feed"><span class="spinner-lg"></span><p style="margin-top:12px">Memuat data log...</p></div>';
    }

    const query = encodeURIComponent(searchInput.value.trim());
    const panjangParam = activePanjangFilter !== 'all' ? `&panjang=${encodeURIComponent(activePanjangFilter)}` : '';
    
    try {
      const response = await fetch(`/api/logs?q=${query}${panjangParam}&page=${currentPage}&limit=25`);
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
            <p>${searchInput.value ? 'Coba cari No. SAP atau No. Mobil lain.' : 'Ketuk "Ambil Foto Form Baru" di atas untuk mulai mendigitalisasi form.'}</p>
          </div>
        `;
        return;
      }

      logFeedContainer.innerHTML = logs.map(row => renderLogCard(row)).join('');
      attachCardEvents();
    } catch (err) {
      console.error('[Feed Error]', err);
      if (!isBackgroundRefresh) {
        logFeedContainer.innerHTML = `<div class="empty-feed"><p style="color:#dc2626">Gagal memuat data: ${err.message}</p></div>`;
      }
    }
  }

  function renderLogCard(row) {
    const diameterDetails = Array.isArray(row.diameter_detail) ? row.diameter_detail : [];
    const markingS = row.marking_s || {};
    
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
    } else if (row.status_verifikasi === 'processing') {
      pillsHtml = '<span class="dia-pill" style="color:#d97706">⚡ AI sedang mengekstrak matriks diameter...</span>';
    } else {
      pillsHtml = '<span class="dia-pill" style="color:#94a3b8">Belum ada rincian diameter</span>';
    }

    // Marking S Pill tag if total_s > 0
    let markingSPill = '';
    if (markingS.total_s > 0) {
      let detailSnippet = '';
      if (Array.isArray(markingS.details) && markingS.details.length > 0) {
        detailSnippet = ' (' + markingS.details.map(d => `Ø${d.d} ${d.jenis}: ${d.qty}`).join(', ') + ')';
      }
      markingSPill = `<div class="marking-s-pill-row"><span class="marking-s-pill">⚠️ Cacat S: ${markingS.total_s} btg${escapeHtml(detailSnippet)}</span></div>`;
    }

    let badgeClass = 'badge-manual';
    let badgeText = row.status_verifikasi || 'manual';

    if (row.status_verifikasi === 'processing') {
      badgeClass = 'badge-processing';
      badgeText = '⚡ EKSTRAKSI AI...';
    } else if (row.status_verifikasi === 'auto') {
      badgeClass = 'badge-auto';
      badgeText = '✅ AUTO AI';
    } else if (row.status_verifikasi === 'edited') {
      badgeClass = 'badge-edited';
      badgeText = '✏️ EDITED';
    } else if (row.status_verifikasi === 'failed') {
      badgeClass = 'badge-failed';
      badgeText = '⚠️ GAGAL AI (ISI MANUAL)';
    }

    const sapDisplay = (row.no_lapen && row.no_lapen !== 'MEMPROSES...') ? row.no_lapen : 'Scanning...';
    const nopolDisplay = (row.no_kendaraan && row.no_kendaraan !== 'PROSES AI') ? row.no_kendaraan : 'Mobil...';
    const panjangText = row.panjang_log || '260 CM';

    return `
      <div class="form-card" data-id="${row.id}" data-json='${escapeHtml(JSON.stringify(row))}'>
        <div class="card-top-row">
          <div class="sap-number">No. SAP: ${escapeHtml(sapDisplay)}</div>
          <div class="nopol-tag">${escapeHtml(nopolDisplay)}</div>
        </div>

        <div class="card-main-stat">
          <span class="stat-label">Total Batang Log <span class="panjang-badge">${escapeHtml(panjangText)}</span></span>
          <div class="stat-number">${row.jumlah_batang || row.total || 0}<span class="stat-unit">btg</span></div>
        </div>

        <div class="diameter-pills-row">
          ${pillsHtml}
        </div>

        ${markingSPill}

        <div class="card-footer-row">
          <span class="badge-status ${badgeClass}">${badgeText}</span>
          <div class="card-actions">
            ${row.foto_path ? `<button class="btn-card-action btn-view-photo" data-foto="${row.foto_path}">📷 Foto</button>` : ''}
            <button class="btn-card-action btn-edit-matrix">📊 Detail Form</button>
          </div>
        </div>
      </div>
    `;
  }

  function attachCardEvents() {
    document.querySelectorAll('.form-card').forEach(card => {
      const rawJson = card.getAttribute('data-json');
      const logData = JSON.parse(rawJson);

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

  // --- 5. Detail Modal (Diameter Matrix & Marking S Tabs) ---
  function openMatrixModal(logData) {
    activeLogData = logData;
    currentDiameterDetail = Array.isArray(logData.diameter_detail) ? [...logData.diameter_detail] : [];
    currentMarkingS = logData.marking_s || { pecah: 0, lapuk: 0, bengkok: 0, bontos_ganda: 0, mata_kayu: 0, total_s: 0 };

    matrixModalSap.textContent = logData.no_lapen || '-';
    matrixModalNopol.textContent = logData.no_kendaraan || '-';
    editSapInput.value = logData.no_lapen === 'MEMPROSES...' ? '' : (logData.no_lapen || '');
    editNopolInput.value = logData.no_kendaraan === 'PROSES AI' ? '' : (logData.no_kendaraan || '');
    editPanjangInput.value = logData.panjang_log || '260 CM';

    // Set Marking S inputs
    msPecah.value = currentMarkingS.pecah || 0;
    msLapuk.value = currentMarkingS.lapuk || 0;
    msBengkok.value = currentMarkingS.bengkok || 0;
    msBontos.value = currentMarkingS.bontos_ganda || 0;
    msMata.value = currentMarkingS.mata_kayu || 0;
    updateMarkingSTotalDisplay();

    if (logData.foto_path) {
      modalViewPhotoBtn.style.display = 'inline-flex';
    } else {
      modalViewPhotoBtn.style.display = 'none';
    }

    switchTab('diameter');
    renderMatrixGrid();
    matrixModal.style.display = 'flex';
  }

  // Tab Switching
  tabDiameterBtn.addEventListener('click', () => switchTab('diameter'));
  tabMarkingSBtn.addEventListener('click', () => switchTab('markingS'));

  function switchTab(tabName) {
    if (tabName === 'diameter') {
      tabDiameterBtn.classList.add('active');
      tabMarkingSBtn.classList.remove('active');
      tabContentDiameter.style.display = 'block';
      tabContentMarkingS.style.display = 'none';
    } else {
      tabMarkingSBtn.classList.add('active');
      tabDiameterBtn.classList.remove('active');
      tabContentMarkingS.style.display = 'block';
      tabContentDiameter.style.display = 'none';
    }
  }

  // Marking S Input Change Listeners
  [msPecah, msLapuk, msBengkok, msBontos, msMata].forEach(input => {
    input.addEventListener('input', updateMarkingSTotalDisplay);
  });

  function updateMarkingSTotalDisplay() {
    const pecah = parseInt(msPecah.value, 10) || 0;
    const lapuk = parseInt(msLapuk.value, 10) || 0;
    const bengkok = parseInt(msBengkok.value, 10) || 0;
    const bontos = parseInt(msBontos.value, 10) || 0;
    const mata = parseInt(msMata.value, 10) || 0;
    const totalS = pecah + lapuk + bengkok + bontos + mata;
    msTotalDisplay.textContent = `${totalS} batang`;
    currentMarkingS = { pecah, lapuk, bengkok, bontos_ganda: bontos, mata_kayu: mata, total_s: totalS };
  }

  toggleZeroFilterBtn.addEventListener('click', () => {
    showOnlyActiveFilter = !showOnlyActiveFilter;
    toggleZeroFilterBtn.classList.toggle('active-filter', showOnlyActiveFilter);
    toggleZeroFilterBtn.querySelector('span').textContent = showOnlyActiveFilter
      ? 'Tampilkan Semua (10-60)'
      : 'Hanya Ada Batang (Qty > 0)';
    renderMatrixGrid();
  });

  function renderMatrixGrid() {
    const cells = [];
    const qtyMap = {};
    currentDiameterDetail.forEach(item => {
      qtyMap[item.d] = item.qty;
    });

    let calculatedTotal = 0;

    for (let d = 10; d <= 60; d++) {
      const qty = qtyMap[d] || 0;
      calculatedTotal += qty;

      if (showOnlyActiveFilter && qty === 0) {
        continue;
      }

      const isActive = qty > 0;
      const cellClass = isActive ? 'matrix-cell cell-active' : 'matrix-cell cell-zero';

      cells.push(`
        <div class="${cellClass}" data-d="${d}">
          <div class="matrix-label">Ø ${d} cm</div>
          <div class="matrix-controls">
            <button class="btn-qty btn-minus" data-d="${d}">-</button>
            <input type="number" class="matrix-qty-input" data-d="${d}" value="${qty}" min="0">
            <button class="btn-qty btn-plus" data-d="${d}">+</button>
          </div>
        </div>
      `);
    }

    if (cells.length === 0 && showOnlyActiveFilter) {
      diameterMatrixGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#78716c">Belum ada rincian batang kayu. Matikan filter untuk menambah diameter.</div>';
    } else {
      diameterMatrixGrid.innerHTML = cells.join('');
    }

    matrixTotalDisplay.textContent = calculatedTotal;

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

  modalViewPhotoBtn.addEventListener('click', () => {
    if (activeLogData && activeLogData.foto_path) {
      openPhotoModal(activeLogData.foto_path, activeLogData.no_lapen);
    }
  });

  saveMatrixBtn.addEventListener('click', async () => {
    if (!activeLogData) return;

    const validDetails = currentDiameterDetail
      .filter(item => item.qty > 0)
      .sort((a, b) => a.d - b.d);

    const calculatedTotal = validDetails.reduce((sum, item) => sum + item.qty, 0);
    updateMarkingSTotalDisplay();

    const payload = {
      no_lapen: editSapInput.value.trim(),
      no_kendaraan: editNopolInput.value.trim(),
      panjang_log: editPanjangInput.value.trim() || '260 CM',
      diameter_detail: validDetails,
      marking_s: currentMarkingS,
      jumlah_batang: calculatedTotal,
      total: calculatedTotal,
      status_verifikasi: 'edited'
    };

    try {
      let response;
      if (activeLogData.id) {
        response = await fetch(`/api/logs/${activeLogData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
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

  // --- 6. Fullscreen Landscape Photo Viewer (360 Rotation & Touch Zoom) ---
  let photoRotationAngle = 0;
  let photoZoomScale = 1.0;
  let initialPinchDistance = 0;
  let initialZoomScale = 1.0;

  function openPhotoModal(fotoPath, sapTitle) {
    if (!fotoPath) {
      showToast('Foto tidak tersedia', 'warning');
      return;
    }
    const fullSrc = fotoPath.startsWith('/') ? fotoPath : `/${fotoPath}`;
    modalPhotoImage.src = fullSrc;
    photoRotationAngle = 0;
    photoZoomScale = 1.0;
    applyPhotoTransform();
    fullscreenPhotoTitle.textContent = `Foto Form Fisik (SAP: ${sapTitle || '-'})`;
    photoModal.style.display = 'flex';
  }

  function applyPhotoTransform() {
    modalPhotoImage.style.transform = `rotate(${photoRotationAngle}deg) scale(${photoZoomScale})`;
    modalPhotoImage.style.transition = 'transform 0.25s ease';
  }

  rotatePhotoBtn.addEventListener('click', () => {
    photoRotationAngle = (photoRotationAngle + 90) % 360;
    applyPhotoTransform();
  });

  // Double tap / double click to toggle zoom (1.0x vs 2.2x)
  modalPhotoImage.addEventListener('dblclick', () => {
    photoZoomScale = photoZoomScale > 1.2 ? 1.0 : 2.2;
    applyPhotoTransform();
  });

  // 2-Finger Touch Pinch-to-Zoom
  const photoContainer = document.querySelector('.fullscreen-photo-container');
  
  photoContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      initialPinchDistance = getTouchDistance(e.touches);
      initialZoomScale = photoZoomScale;
    }
  });

  photoContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance > 0) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const zoomFactor = currentDistance / initialPinchDistance;
      photoZoomScale = Math.min(4.0, Math.max(0.8, initialZoomScale * zoomFactor));
      applyPhotoTransform();
    }
  });

  photoContainer.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = 0;
    }
  });

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  closePhotoModalBtn.addEventListener('click', () => {
    photoModal.style.display = 'none';
  });

  [cropModal, matrixModal, photoModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal !== cropModal && modal !== photoModal) {
        modal.style.display = 'none';
      }
    });
  });

  // --- 7. Toast Notification Helper ---
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
  startQueuePolling();
});
