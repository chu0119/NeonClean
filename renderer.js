(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const els = {
    status: $('#status'),
    btnScan: $('#btnScan'),
    btnCancel: $('#btnCancel'),
    btnClean: $('#btnClean'),
    btnSelectRecommended: $('#btnSelectRecommended'),
    checkAll: $('#checkAll'),

    progressRing: $('#progressRing'),
    progressLabel: $('#progressLabel'),
    progressSub: $('#progressSub'),

    totalSize: $('#totalSize'),
    safeCount: $('#safeCount'),
    optionalCount: $('#optionalCount'),

    results: $('#results'),
    resultsBody: $('#resultsBody'),

    cleanSummary: $('#cleanSummary'),
    freedSize: $('#freedSize'),
  };

  let state = {
    items: [],
    selected: new Set(),
    scanning: false,
    cleaning: false,
    offScanProgress: null,
    offScanComplete: null,
    offCleanProgress: null,
    offCleanComplete: null,
  };

  function formatBytes(n) {
    n = Number(n || 0);
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) {
      n /= 1024;
      i++;
    }
    const v = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
    return `${v} ${u[i]}`;
  }

  function setStatus(mode, text) {
    // mode: idle | scan | clean | cancel
    els.status.classList.remove('pill-idle', 'pill-scan', 'pill-clean');
    if (mode === 'scan') {
      els.status.textContent = text || '扫描中';
      els.status.classList.add('pill', 'pill-scan');
    } else if (mode === 'clean') {
      els.status.textContent = text || '清理中';
      els.status.classList.add('pill', 'pill-clean');
    } else if (mode === 'cancel') {
      els.status.textContent = text || '已取消';
      els.status.classList.add('pill', 'pill-idle');
    } else {
      els.status.textContent = text || '空闲';
      els.status.classList.add('pill', 'pill-idle');
    }
  }

  function setProgress(percent, sub) {
    const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
    els.progressRing.style.setProperty('--p', String(p));
    els.progressLabel.textContent = `${p}%`;
    if (sub) els.progressSub.textContent = sub;
  }

  function updateButtons() {
    els.btnScan.disabled = state.scanning || state.cleaning;
    els.btnCancel.disabled = !(state.scanning || state.cleaning);
    els.btnClean.disabled = state.scanning || state.cleaning || state.selected.size === 0;
    els.btnSelectRecommended.disabled = state.scanning || state.cleaning || state.items.length === 0;
    els.checkAll.disabled = state.scanning || state.cleaning || state.items.length === 0;
  }

  function updateStats() {
    const safeTotal = state.items.filter((x) => x.type === 'safe').length;
    const optTotal = state.items.filter((x) => x.type !== 'safe').length;
    els.safeCount.textContent = `${safeTotal} 项`;
    els.optionalCount.textContent = `${optTotal} 项`;

    let selectedSum = 0;
    for (const id of state.selected) {
      const it = state.items.find((x) => x.id === id);
      if (it) selectedSum += it.size || 0;
    }
    els.totalSize.textContent = formatBytes(selectedSum);
  }

  function renderRows() {
    const rowsHtml = state.items
      .map((it) => {
        const checked = state.selected.has(it.id) ? 'checked' : '';
        const badge = it.type === 'safe'
          ? '<span class="badge">推荐</span>'
          : '<span class="badge opt">可选</span>';
        const size = formatBytes(it.size || 0);
        return `
          <div class="row" data-id="${it.id}">
            <div class="col-check">
              <input type="checkbox" class="row-check" ${checked} />
            </div>
            <div class="cell col-name">${escapeHtml(it.label)}</div>
            <div class="cell col-type">${badge}</div>
            <div class="cell cell-size col-size">${size}</div>
            <div class="cell col-hint">${escapeHtml(it.hint || '')}</div>
          </div>
        `;
      })
      .join('');

    els.resultsBody.innerHTML = rowsHtml;

    // Show/Hide placeholder
    const placeholder = els.results.querySelector('.placeholder');
    if (placeholder) {
      placeholder.style.display = state.items.length ? 'none' : 'flex';
    }

    // Bind row checkbox change
    els.resultsBody.querySelectorAll('.row').forEach((row) => {
      const id = row.getAttribute('data-id');
      const cb = row.querySelector('.row-check');
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(id);
        else state.selected.delete(id);
        updateStats();
        updateButtons();
        syncHeaderCheckAll();
      });
    });

    syncHeaderCheckAll();
  }

  function syncHeaderCheckAll() {
    if (!state.items.length) {
      els.checkAll.indeterminate = false;
      els.checkAll.checked = false;
      return;
    }
    let selectedCount = 0;
    for (const it of state.items) {
      if (state.selected.has(it.id)) selectedCount++;
    }
    if (selectedCount === 0) {
      els.checkAll.indeterminate = false;
      els.checkAll.checked = false;
    } else if (selectedCount === state.items.length) {
      els.checkAll.indeterminate = false;
      els.checkAll.checked = true;
    } else {
      els.checkAll.indeterminate = true;
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&')
      .replaceAll('<', '<')
      .replaceAll('>', '>')
      .replaceAll('"', '"')
      .replaceAll("'", '&#39;');
  }

  function resetForScan() {
    state.items = [];
    state.selected.clear();
    els.cleanSummary.classList.add('hidden');
    els.freedSize.textContent = '0 B';
    setProgress(0, '等待扫描');
    renderRows();
    updateStats();
    updateButtons();
    setStatus('scan');
  }

  function attachScanListeners() {
    detachScanListeners();
    state.offScanProgress = window.smartCleaner.onScanProgress((data) => {
      setProgress(data?.percent ?? 0, '正在扫描...');
    });
    state.offScanComplete = window.smartCleaner.onScanComplete((data) => {
      state.scanning = false;
      detachScanListeners();
      if (data?.aborted) {
        setStatus('cancel', '已取消');
        setProgress(0, '已取消');
      } else {
        setStatus('idle', '空闲');
        setProgress(100, '扫描完成');
        state.items = Array.isArray(data?.items) ? data.items : [];
        // 默认不勾选，等待用户点击“全选推荐”或手动选择
        state.selected.clear();
        renderRows();
        updateStats();
      }
      updateButtons();
    });
  }

  function detachScanListeners() {
    if (typeof state.offScanProgress === 'function') {
      state.offScanProgress();
      state.offScanProgress = null;
    }
    if (typeof state.offScanComplete === 'function') {
      state.offScanComplete();
      state.offScanComplete = null;
    }
  }

  function attachCleanListeners() {
    detachCleanListeners();
    state.offCleanProgress = window.smartCleaner.onCleanProgress((data) => {
      setProgress(data?.percent ?? 0, '正在清理...');
    });
    state.offCleanComplete = window.smartCleaner.onCleanComplete((data) => {
      state.cleaning = false;
      detachCleanListeners();
      if (data?.aborted) {
        setStatus('cancel', '已取消');
        setProgress(0, '已取消');
      } else {
        setStatus('idle', '空闲');
        setProgress(100, '清理完成');
        const freed = Number(data?.freed || 0);
        els.freedSize.textContent = formatBytes(freed);
        els.cleanSummary.classList.remove('hidden');

        // 就地更新各项大小
        const details = Array.isArray(data?.details) ? data.details : [];
        const map = new Map(details.map((d) => [d.id, d]));
        state.items = state.items.map((it) => {
          const d = map.get(it.id);
          if (d && typeof d.reclaimed === 'number') {
            const next = Math.max(0, (it.size || 0) - d.reclaimed);
            return { ...it, size: next };
          }
          return it;
        });

        // 清理后可保留勾选，便于二次清理，但更新显示
        renderRows();
        updateStats();
      }
      updateButtons();
    });
  }

  function detachCleanListeners() {
    if (typeof state.offCleanProgress === 'function') {
      state.offCleanProgress();
      state.offCleanProgress = null;
    }
    if (typeof state.offCleanComplete === 'function') {
      state.offCleanComplete();
      state.offCleanComplete = null;
    }
  }

  // Events
  els.btnScan.addEventListener('click', () => {
    if (state.scanning || state.cleaning) return;
    resetForScan();
    state.scanning = true;
    updateButtons();
    attachScanListeners();
    try {
      window.smartCleaner.startScan();
    } catch {
      state.scanning = false;
      setStatus('idle', '空闲');
      updateButtons();
    }
  });

  els.btnCancel.addEventListener('click', () => {
    if (state.scanning) {
      try { window.smartCleaner.cancelScan(); } catch {}
    }
    if (state.cleaning) {
      try { window.smartCleaner.cancelClean(); } catch {}
    }
  });

  els.btnSelectRecommended.addEventListener('click', () => {
    if (state.scanning || state.cleaning) return;
    state.selected.clear();
    for (const it of state.items) {
      if (it.type === 'safe' && (it.size || 0) > 0) {
        state.selected.add(it.id);
      }
    }
    renderRows();
    updateStats();
    updateButtons();
  });

  els.checkAll.addEventListener('change', () => {
    if (state.scanning || state.cleaning) return;
    if (!state.items.length) return;
    state.selected.clear();
    if (els.checkAll.checked) {
      for (const it of state.items) {
        if ((it.size || 0) > 0) state.selected.add(it.id);
      }
    }
    renderRows();
    updateStats();
    updateButtons();
  });

  els.btnClean.addEventListener('click', () => {
    if (state.scanning || state.cleaning) return;
    if (state.selected.size === 0) return;
    setStatus('clean');
    setProgress(0, '准备清理...');
    const ids = Array.from(state.selected);
    state.cleaning = true;
    updateButtons();
    attachCleanListeners();
    try {
      window.smartCleaner.startClean(ids);
    } catch {
      state.cleaning = false;
      setStatus('idle', '空闲');
      updateButtons();
    }
  });

  // Initial
  setStatus('idle', '空闲');
  setProgress(0, '等待扫描');
  updateButtons();
  updateStats();
  renderRows();
})();