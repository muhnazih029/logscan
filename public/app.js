/**
 * LogScan — Mobile-First PWA Main Frontend Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let selectedFile = null;
  let currentPage = 1;
  let totalPages = 1;
  let searchDebounceTimer = null;
  let deferredPrompt = null;

  // DOM Elements
  const tabButtons = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const previewWrapper = document.getElementById('previewWrapper');
  const imagePreview = document.getElementById('imagePreview');
  const clearImageBtn = document.getElementById('clearImageBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const tableBody = document.getElementById('tableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');

  const reviewModal = document.getElementById('reviewModal');
  const reviewForm = document.getElementById('reviewForm');
  const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');
  const cancelReviewBtn = document.getElementById('cancelReviewBtn');
  const confidenceBadge = document.getElementById('confidenceBadge');

  const photoModal = document.getElementById('photoModal');
  const modalPhotoImage = document.getElementById('modalPhotoImage');
  const photoModalTitle = document.getElementById('photoModalTitle');
  const photoModalDetail = document.getElementById('photoModalDetail');
  const closePhotoModalBtn = document.getElementById('closePhotoModalBtn');
  
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  // --- 1. Service Worker & PWA Install ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] ServiceWorker registered:', reg.scope))
      .catch(err => console.error('[PWA] ServiceWorker registration failed:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaInstallBtn.style.display = 'inline-block';
  });

  pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice outcome:', outcome);
    deferredPrompt = null;
    pwaInstallBtn.style.display = 'none';
  });

  // Online / Offline Status
  function updateOnlineStatus() {
    const statusText = document.getElementById('networkStatusText');
    const dot = document.querySelector('.status-dot');
    if (navigator.onLine) {
      statusText.textContent = 'Online';
      dot.style.backgroundColor = '#22c55e';
    } else {
      statusText.textContent = 'Offline';
      dot.style.backgroundColor = '#ef4444';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // --- 2. Tab Navigation ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (targetTab === 'tabData') {
        loadTableData();
      }
    });
  });

  // --- 3. Upload & Image Handling ---
  fileInput.addEventListener('change', handleFileSelect);

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  function handleFileSelect() {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Hanya file gambar yang diperbolehkan', 'error');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      uploadPlaceholder.style.display = 'none';
      previewWrapper.style.display = 'block';
      uploadBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  clearImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetUploadForm();
  });

  function resetUploadForm() {
    selectedFile = null;
    fileInput.value = '';
    imagePreview.src = '';
    uploadPlaceholder.style.display = 'block';
    previewWrapper.style.display = 'none';
    uploadBtn.disabled = true;
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
  }

  // --- 4. Upload & Process Form ---
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    uploadBtn.disabled = true;
    progressContainer.style.display = 'block';
    updateProgress(20, 'Mengunggah foto form...');

    const formData = new FormData();
    formData.append('foto', selectedFile);

    try {
      updateProgress(40, 'Membaca form via Tesseract OCR...');
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      updateProgress(80, 'Memproses hasil ekstraksi...');

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Gagal mengunggah foto');
      }

      updateProgress(100, 'Selesai!');

      if (result.status === 'auto') {
        showToast('✅ Data berhasil diekstrak dan disimpan otomatis!', 'success');
        resetUploadForm();
        // Switch to Data tab
        document.querySelector('[data-tab="tabData"]').click();
      } else {
        // Status pending (confidence < 90%) -> open review modal
        showToast('⚠️ Data dibaca tetapi perlu konfirmasi Anda', 'warning');
        openReviewModal(result.data, result.confidence);
      }
    } catch (err) {
      console.error('[App] Upload error:', err);
      showToast(err.message || 'Terjadi kesalahan saat memproses foto', 'error');
    } finally {
      setTimeout(() => {
        progressContainer.style.display = 'none';
        uploadBtn.disabled = false;
      }, 800);
    }
  });

  function updateProgress(percent, text) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = text;
  }

  // --- 5. Review Modal ---
  function openReviewModal(data, confidence) {
    document.getElementById('reviewNoLapen').value = data.no_lapen || '';
    document.getElementById('reviewNoKendaraan').value = data.no_kendaraan || '';
    document.getElementById('reviewBlock').value = data.block || '';
    document.getElementById('reviewNamaChecker').value = data.nama_checker || '';
    document.getElementById('reviewTotal').value = data.total || data.jumlah_batang || 0;
    document.getElementById('reviewFotoPath').value = data.foto_path || '';

    const confPct = Math.round((confidence || 0) * 100);
    confidenceBadge.querySelector('span').textContent = `${confPct}%`;

    reviewModal.style.display = 'flex';
  }

  closeReviewModalBtn.addEventListener('click', () => reviewModal.style.display = 'none');
  cancelReviewBtn.addEventListener('click', () => reviewModal.style.display = 'none');

  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      no_lapen: document.getElementById('reviewNoLapen').value,
      no_kendaraan: document.getElementById('reviewNoKendaraan').value,
      block: document.getElementById('reviewBlock').value,
      nama_checker: document.getElementById('reviewNamaChecker').value,
      jumlah_batang: parseInt(document.getElementById('reviewTotal').value, 10) || 0,
      total: parseInt(document.getElementById('reviewTotal').value, 10) || 0,
      foto_path: document.getElementById('reviewFotoPath').value,
      status_verifikasi: 'manual'
    };

    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();
      if (!resData.success) throw new Error(resData.error);

      showToast('✅ Data berhasil disimpan ke database!', 'success');
      reviewModal.style.display = 'none';
      resetUploadForm();
      document.querySelector('[data-tab="tabData"]').click();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan data', 'error');
    }
  });

  // --- 6. Data Table & Search ---
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentPage = 1;
      loadTableData();
    }, 300);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    currentPage = 1;
    loadTableData();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadTableData();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadTableData();
    }
  });

  async function loadTableData() {
    tableBody.innerHTML = '<tr><td colspan="7" class="empty-state"><span class="spinner-sm"></span> Memuat data...</td></tr>';
    
    const query = encodeURIComponent(searchInput.value.trim());
    try {
      const response = await fetch(`/api/logs?q=${query}&page=${currentPage}&limit=25`);
      const result = await response.json();

      if (!result.success) throw new Error(result.error);

      const logs = result.data || [];
      const pagination = result.pagination;

      totalPages = pagination.totalPages || 1;
      currentPage = pagination.page || 1;

      paginationInfo.textContent = `Halaman ${currentPage} dari ${totalPages} (${pagination.total} total data)`;
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= totalPages;

      if (logs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data log yang tersimpan.</td></tr>';
        return;
      }

      tableBody.innerHTML = logs.map(row => `
        <tr data-id="${row.id}">
          <td class="cell-editable" data-field="no_lapen">${escapeHtml(row.no_lapen || '-')}</td>
          <td class="cell-editable" data-field="no_kendaraan">${escapeHtml(row.no_kendaraan || '-')}</td>
          <td class="cell-editable" data-field="block">${escapeHtml(row.block || '-')}</td>
          <td class="cell-editable" data-field="nama_checker">${escapeHtml(row.nama_checker || '-')}</td>
          <td class="text-right cell-editable" data-field="jumlah_batang">${row.jumlah_batang || 0}</td>
          <td><span class="badge badge-${row.status_verifikasi}">${row.status_verifikasi}</span></td>
          <td class="text-center">
            <button class="btn-sm btn-secondary view-photo-btn" data-foto="${row.foto_path}" data-title="${row.no_lapen || 'Form'}">
              📷 Foto
            </button>
          </td>
        </tr>
      `).join('');

      attachTableEvents();
    } catch (err) {
      console.error('[Table] Error loading data:', err);
      tableBody.innerHTML = `<tr><td colspan="7" class="empty-state text-error">Gagal memuat data: ${err.message}</td></tr>`;
    }
  }

  // --- 7. Inline Editing ---
  function attachTableEvents() {
    // View photo button click
    document.querySelectorAll('.view-photo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fotoPath = btn.getAttribute('data-foto');
        const title = btn.getAttribute('data-title');
        openPhotoModal(fotoPath, title);
      });
    });

    // Double-click/click cell to edit
    document.querySelectorAll('.cell-editable').forEach(cell => {
      cell.addEventListener('click', function() {
        if (this.classList.contains('cell-editing')) return;

        const currentText = this.textContent === '-' ? '' : this.textContent.trim();
        const fieldName = this.getAttribute('data-field');
        const row = this.closest('tr');
        const logId = row.getAttribute('data-id');

        this.classList.add('cell-editing');
        const input = document.createElement('input');
        input.type = fieldName === 'jumlah_batang' ? 'number' : 'text';
        input.value = currentText;
        this.innerHTML = '';
        this.appendChild(input);
        input.focus();

        const saveEdit = async () => {
          const newValue = input.value.trim();
          this.classList.remove('cell-editing');
          this.textContent = newValue || '-';

          if (newValue !== currentText) {
            try {
              const payload = {};
              payload[fieldName] = fieldName === 'jumlah_batang' ? (parseInt(newValue, 10) || 0) : newValue;

              const response = await fetch(`/api/logs/${logId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });

              const resData = await response.json();
              if (!resData.success) throw new Error(resData.error);

              showToast('✏️ Field berhasil diperbarui', 'success');
              // Update badge to EDITED
              const badgeCell = row.querySelector('.badge');
              if (badgeCell) {
                badgeCell.className = 'badge badge-edited';
                badgeCell.textContent = 'edited';
              }
            } catch (err) {
              showToast('Gagal memperbarui field: ' + err.message, 'error');
              this.textContent = currentText || '-';
            }
          }
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          }
        });
      });
    });
  }

  // --- 8. Photo Modal ---
  function openPhotoModal(fotoPath, title) {
    if (!fotoPath) {
      showToast('Foto tidak tersedia untuk data ini', 'warning');
      return;
    }

    const fullSrc = fotoPath.startsWith('/') ? fotoPath : `/${fotoPath}`;
    modalPhotoImage.src = fullSrc;
    photoModalTitle.textContent = `Foto Form (No. SAP: ${title})`;
    photoModalDetail.textContent = `File: ${fotoPath}`;

    photoModal.style.display = 'flex';
  }

  closePhotoModalBtn.addEventListener('click', () => photoModal.style.display = 'none');

  // Close modals when clicking backdrop
  [reviewModal, photoModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // --- 9. Toast Helper ---
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

  // Initial setup
  updateOnlineStatus();
});
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
