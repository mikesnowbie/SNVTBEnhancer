document.addEventListener('DOMContentLoaded', function () {
  const DEFAULT_UPDATE_THRESHOLD_DAYS = 6;
  const DEFAULT_UPDATE_INDICATOR = {
    freshEmoji: '✅',
    staleEmoji: '❌',
  };

  const BASE_DEFAULT_CONFIG = {
    enableAgeBadge: true,
    enableUpdateIndicator: true,
    ageBands: [
      { maxDays: 7, color: '#f9e79f' },
      { maxDays: 30, color: '#f0ad4e' },
      { maxDays: 90, color: '#e67e22' },
      { maxDays: 9999, color: '#d9534f' },
    ],
    updateThresholdDays: DEFAULT_UPDATE_THRESHOLD_DAYS,
    updateIndicator: { ...DEFAULT_UPDATE_INDICATOR },
  };

  function cloneDefaultConfig() {
    return {
      enableAgeBadge: true,
      enableUpdateIndicator: true,
      ageBands: BASE_DEFAULT_CONFIG.ageBands.map((b) => ({ ...b })),
      updateThresholdDays: BASE_DEFAULT_CONFIG.updateThresholdDays,
      updateIndicator: { ...BASE_DEFAULT_CONFIG.updateIndicator },
    };
  }

  const defaultStorage = { defaultConfig: cloneDefaultConfig(), boards: {} };

  const statusDiv = document.getElementById('status');
  const tableBody = document.querySelector('#ageBandsTable tbody');
  const boardSelect = document.getElementById('boardSelect');
  const thresholdInput = document.getElementById('thresholdInput');
  const freshEmojiInput = document.getElementById('freshEmojiInput');
  const staleEmojiInput = document.getElementById('staleEmojiInput');
  const ageBadgeToggle = document.getElementById('ageBadgeToggle');
  const ageBadgeSettings = document.getElementById('ageBadgeSettings');
  const updateIndicatorToggle = document.getElementById('updateIndicatorToggle');
  const updateIndicatorSettings = document.getElementById('updateIndicatorSettings');
  const previewBadge = document.getElementById('previewBadge');
  const previewFresh = document.getElementById('previewFresh');
  const previewStale = document.getElementById('previewStale');
  const sleDaysInput = document.getElementById('sleDaysInput');
  const sleApproachingInput = document.getElementById('sleApproachingInput');
  const sleSummaryToggle = document.getElementById('sleSummaryToggle');
  const sleEscalationToggle = document.getElementById('sleEscalationToggle');
  const sleDefaultHint = document.getElementById('sleDefaultHint');
  const sleFields = document.getElementById('sleFields');

  let fullConfig = null;
  let currentBoardId = null; // null means default config

  // Load config from chrome.storage.sync or fallback to defaults.
  function loadConfig(callback) {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      chrome.storage.sync.get(
        { vtbEnhancerConfig: defaultStorage },
        function (data) {
          let cfg = data.vtbEnhancerConfig;
          // Migrate old format { ageBands: [...] }
          if (cfg && cfg.ageBands) {
            cfg = { defaultConfig: cfg, boards: {} };
          }
          callback(normalizeConfigStructure(cfg));
        }
      );
    } else {
      callback(normalizeConfigStructure(defaultStorage));
    }
  }

  // Save configuration using chrome.storage.sync.
  function saveConfig(config, callback) {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      chrome.storage.sync.set({ vtbEnhancerConfig: config }, function () {
        if (callback) callback();
      });
    } else {
      localStorage.setItem('vtbEnhancerConfig', JSON.stringify(config));
      if (callback) callback();
    }
  }

  function normalizeConfigStructure(config) {
    let cfg = config;
    if (!cfg || typeof cfg !== 'object') {
      cfg = { defaultConfig: cloneDefaultConfig(), boards: {} };
    }

    if (!cfg.defaultConfig || typeof cfg.defaultConfig !== 'object') {
      cfg.defaultConfig = cloneDefaultConfig();
    }

    if (!Array.isArray(cfg.defaultConfig.ageBands)) {
      cfg.defaultConfig.ageBands = BASE_DEFAULT_CONFIG.ageBands.map((b) => ({ ...b }));
    }

    if (
      typeof cfg.defaultConfig.updateThresholdDays !== 'number' ||
      cfg.defaultConfig.updateThresholdDays < 0
    ) {
      cfg.defaultConfig.updateThresholdDays = DEFAULT_UPDATE_THRESHOLD_DAYS;
    }

    if (
      !cfg.defaultConfig.updateIndicator ||
      typeof cfg.defaultConfig.updateIndicator !== 'object'
    ) {
      cfg.defaultConfig.updateIndicator = { ...DEFAULT_UPDATE_INDICATOR };
    } else {
      cfg.defaultConfig.updateIndicator = normalizeIndicator(
        cfg.defaultConfig.updateIndicator,
        DEFAULT_UPDATE_INDICATOR
      );
    }

    cfg.defaultConfig.enableAgeBadge =
      typeof cfg.defaultConfig.enableAgeBadge === 'boolean'
        ? cfg.defaultConfig.enableAgeBadge
        : true;
    cfg.defaultConfig.enableUpdateIndicator =
      typeof cfg.defaultConfig.enableUpdateIndicator === 'boolean'
        ? cfg.defaultConfig.enableUpdateIndicator
        : true;

    if (!cfg.boards || typeof cfg.boards !== 'object') {
      cfg.boards = {};
    }

    Object.keys(cfg.boards).forEach((boardId) => {
      let boardCfg = cfg.boards[boardId];
      if (!boardCfg || typeof boardCfg !== 'object') {
        cfg.boards[boardId] = { name: typeof boardCfg === 'string' ? boardCfg : boardId };
        boardCfg = cfg.boards[boardId];
      } else if (!boardCfg.name) {
        boardCfg.name = boardId;
      }
      boardCfg.updateIndicator = normalizeIndicator(
        boardCfg.updateIndicator,
        cfg.defaultConfig.updateIndicator
      );

      boardCfg.enableAgeBadge =
        typeof boardCfg.enableAgeBadge === 'boolean'
          ? boardCfg.enableAgeBadge
          : cfg.defaultConfig.enableAgeBadge;
      boardCfg.enableUpdateIndicator =
        typeof boardCfg.enableUpdateIndicator === 'boolean'
          ? boardCfg.enableUpdateIndicator
          : cfg.defaultConfig.enableUpdateIndicator;

      if (!boardCfg.sle || typeof boardCfg.sle !== 'object') {
        boardCfg.sle = { days: 0, approachingDays: 3, showSummary: true, showBadgeEscalation: true };
      } else {
        if (typeof boardCfg.sle.days !== 'number' || boardCfg.sle.days < 0) boardCfg.sle.days = 0;
        if (typeof boardCfg.sle.approachingDays !== 'number' || boardCfg.sle.approachingDays < 0) boardCfg.sle.approachingDays = 3;
        if (typeof boardCfg.sle.showSummary !== 'boolean') boardCfg.sle.showSummary = true;
        if (typeof boardCfg.sle.showBadgeEscalation !== 'boolean') boardCfg.sle.showBadgeEscalation = true;
      }
    });

    return cfg;
  }

  function normalizeIndicator(source, fallback) {
    const base = fallback || DEFAULT_UPDATE_INDICATOR;
    if (!source || typeof source !== 'object') {
      return { ...base };
    }
    const fresh =
      typeof source.freshEmoji === 'string' && source.freshEmoji.trim()
        ? source.freshEmoji
        : base.freshEmoji;
    const stale =
      typeof source.staleEmoji === 'string' && source.staleEmoji.trim()
        ? source.staleEmoji
        : base.staleEmoji;
    return { freshEmoji: fresh, staleEmoji: stale };
  }

  function updateSleVisibility() {
    if (currentBoardId) {
      sleDefaultHint.style.display = 'none';
      sleFields.style.display = '';
    } else {
      sleDefaultHint.style.display = '';
      sleFields.style.display = 'none';
    }
  }

  function renderSleToUI(sle) {
    const s = sle || { days: 0, approachingDays: 3, showSummary: true, showBadgeEscalation: true };
    sleDaysInput.value = s.days;
    sleApproachingInput.value = s.approachingDays;
    sleSummaryToggle.checked = s.showSummary !== false;
    sleEscalationToggle.checked = s.showBadgeEscalation !== false;
  }

  function getSleFromInputs() {
    const days = parseInt(sleDaysInput.value, 10);
    const approachingDays = parseInt(sleApproachingInput.value, 10);
    return {
      days: isNaN(days) || days < 0 ? 0 : days,
      approachingDays: isNaN(approachingDays) || approachingDays < 0 ? 3 : approachingDays,
      showSummary: sleSummaryToggle.checked,
      showBadgeEscalation: sleEscalationToggle.checked,
    };
  }

  function toggleSettingsVisibility() {
    const showAge = ageBadgeToggle.checked;
    const showUpdate = updateIndicatorToggle.checked;
    ageBadgeSettings.style.display = showAge ? '' : 'none';
    updateIndicatorSettings.style.display = showUpdate ? '' : 'none';
    updatePreview();
  }

  function isAgeBadgeEnabled() {
    return ageBadgeToggle.checked;
  }

  function isUpdateIndicatorEnabled() {
    return updateIndicatorToggle.checked;
  }

  function getPreviewBandColor() {
    const bands = getBandsFromTable();
    if (!bands || bands.length === 0) return '#d9534f';
    const sampleAge = 10;
    const band = bands.find((b) => sampleAge < b.maxDays) || bands[bands.length - 1];
    return band.color || '#d9534f';
  }

  function updatePreview() {
    const ageOn = ageBadgeToggle.checked;
    const updateOn = updateIndicatorToggle.checked;

    if (ageOn && previewBadge) {
      const color = getPreviewBandColor();
      previewBadge.style.backgroundColor = color;
      previewBadge.style.color = '#fff';
      previewBadge.textContent = 'Age: 10 days';
      previewBadge.style.display = '';
    } else if (previewBadge) {
      previewBadge.style.display = 'none';
    }

    if (updateOn && previewFresh && previewStale) {
      const threshold = getThresholdFromInput();
      const fresh = freshEmojiInput.value.trim() || BASE_DEFAULT_CONFIG.updateIndicator.freshEmoji;
      const stale = staleEmojiInput.value.trim() || BASE_DEFAULT_CONFIG.updateIndicator.staleEmoji;
      const freshDays = Math.max(0, Math.round(threshold - 1));
      const staleDays = Math.max(0, Math.round(threshold + 1));
      previewFresh.textContent = `${freshDays}d ago ${fresh}`;
      previewStale.textContent = `${staleDays}d ago ${stale}`;
      previewFresh.parentElement.parentElement.style.display = '';
    } else if (previewFresh && previewFresh.parentElement) {
      previewFresh.parentElement.parentElement.style.display = 'none';
    }
  }

  // Render the table and threshold inputs based directly on a provided configuration object.
  function renderConfigToUI(config) {
    const ageOn = config.enableAgeBadge !== false;
    const updateOn = config.enableUpdateIndicator !== false;
    ageBadgeToggle.checked = ageOn;
    updateIndicatorToggle.checked = updateOn;
    toggleSettingsVisibility();

    const thresholdValue =
      typeof config.updateThresholdDays === 'number' && config.updateThresholdDays >= 0
        ? config.updateThresholdDays
        : BASE_DEFAULT_CONFIG.updateThresholdDays;
    thresholdInput.value = thresholdValue;

    const indicator = normalizeIndicator(config.updateIndicator, BASE_DEFAULT_CONFIG.updateIndicator);
    freshEmojiInput.value = indicator.freshEmoji;
    staleEmojiInput.value = indicator.staleEmoji;

    tableBody.innerHTML = '';
    config.ageBands.forEach((band) => {
      const row = createRow(band);
      tableBody.appendChild(row);
    });

    updateSleVisibility();
    if (currentBoardId) {
      const boardSle = fullConfig.boards[currentBoardId] && fullConfig.boards[currentBoardId].sle;
      renderSleToUI(boardSle);
    }
  }

  function refreshTable() {
    let bands = getBandsFromTable();
    bands.sort((a, b) => a.maxDays - b.maxDays);
    if (bands.length === 0 || bands[bands.length - 1].maxDays !== 9999) {
      bands.push({ maxDays: 9999, color: '#d9534f' });
    }
    tableBody.innerHTML = '';
    bands.forEach((band) => {
      const row = createRow(band);
      tableBody.appendChild(row);
    });
    updatePreview();
  }

  function createRow(band) {
    const tr = document.createElement('tr');

    const tdDays = document.createElement('td');
    if (band.maxDays === 9999) {
      const span = document.createElement('span');
      span.textContent = '∞';
      tdDays.appendChild(span);
    } else {
      const inputDays = document.createElement('input');
      inputDays.type = 'number';
      inputDays.min = '0';
      inputDays.value = band.maxDays;
      tdDays.appendChild(inputDays);
    }
    tr.appendChild(tdDays);

    const tdColor = document.createElement('td');
    const inputColor = document.createElement('input');
    inputColor.type = 'color';
    inputColor.value = band.color;
    tdColor.appendChild(inputColor);
    tr.appendChild(tdColor);

    const tdAction = document.createElement('td');
    if (band.maxDays !== 9999) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Delete this age band';
      deleteBtn.addEventListener('click', () => {
        tr.remove();
        refreshTable();
      });
      tdAction.appendChild(deleteBtn);
    }
    tr.appendChild(tdAction);

    return tr;
  }

  function getBandsFromTable() {
    const newBands = [];
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const daysInput = row.querySelector('td:nth-child(1) input');
      let maxDays;
      if (daysInput) {
        maxDays = parseInt(daysInput.value, 10);
        if (isNaN(maxDays) || maxDays < 0 || maxDays === 0) return;
      } else {
        maxDays = 9999;
      }
      const colorInput = row.querySelector('td:nth-child(2) input');
      newBands.push({ maxDays: maxDays, color: colorInput.value });
    });
    return newBands;
  }

  function getThresholdFromInput() {
    let value = parseFloat(thresholdInput.value);
    if (isNaN(value) || value < 0) {
      value = BASE_DEFAULT_CONFIG.updateThresholdDays;
    }
    return value;
  }

  function getIndicatorFromInputs() {
    const fresh = freshEmojiInput.value.trim() || BASE_DEFAULT_CONFIG.updateIndicator.freshEmoji;
    const stale = staleEmojiInput.value.trim() || BASE_DEFAULT_CONFIG.updateIndicator.staleEmoji;
    return { freshEmoji: fresh, staleEmoji: stale };
  }

  function populateBoardSelect() {
    boardSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Default (All Boards)';
    boardSelect.appendChild(defaultOption);
    Object.keys(fullConfig.boards).forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = fullConfig.boards[id].name || id;
      boardSelect.appendChild(opt);
    });
    boardSelect.value = currentBoardId || '';
  }

  function getCurrentConfig() {
    if (!currentBoardId) return fullConfig.defaultConfig;
    const board = fullConfig.boards[currentBoardId];
    if (board) {
      const ageBands = board.ageBands
        ? board.ageBands.map((b) => ({ ...b }))
        : fullConfig.defaultConfig.ageBands.map((b) => ({ ...b }));
      const threshold =
        typeof board.updateThresholdDays === 'number' && board.updateThresholdDays >= 0
          ? board.updateThresholdDays
          : fullConfig.defaultConfig.updateThresholdDays;
      return {
        enableAgeBadge:
          typeof board.enableAgeBadge === 'boolean'
            ? board.enableAgeBadge
            : fullConfig.defaultConfig.enableAgeBadge,
        enableUpdateIndicator:
          typeof board.enableUpdateIndicator === 'boolean'
            ? board.enableUpdateIndicator
            : fullConfig.defaultConfig.enableUpdateIndicator,
        ageBands,
        updateThresholdDays: threshold,
        updateIndicator: normalizeIndicator(
          board.updateIndicator,
          fullConfig.defaultConfig.updateIndicator
        ),
      };
    }
    return {
      enableAgeBadge: fullConfig.defaultConfig.enableAgeBadge,
      enableUpdateIndicator: fullConfig.defaultConfig.enableUpdateIndicator,
      ageBands: fullConfig.defaultConfig.ageBands.map((b) => ({ ...b })),
      updateThresholdDays: fullConfig.defaultConfig.updateThresholdDays,
      updateIndicator: { ...fullConfig.defaultConfig.updateIndicator },
    };
  }

  boardSelect.addEventListener('change', () => {
    currentBoardId = boardSelect.value || null;
    updateSleVisibility();
    renderConfigToUI(getCurrentConfig());
  });

  ageBadgeToggle.addEventListener('change', toggleSettingsVisibility);
  updateIndicatorToggle.addEventListener('change', toggleSettingsVisibility);
  thresholdInput.addEventListener('input', updatePreview);
  freshEmojiInput.addEventListener('input', updatePreview);
  staleEmojiInput.addEventListener('input', updatePreview);
  tableBody.addEventListener('input', updatePreview);

  document.getElementById('addRowBtn').addEventListener('click', () => {
    let bands = getBandsFromTable();
    const infinityBand =
      bands.find((b) => b.maxDays === 9999) || { maxDays: 9999, color: '#d9534f' };
    bands.push({ maxDays: 1, color: '#ffffff' });
    bands = bands.filter((b) => b.maxDays !== 9999);
    bands.sort((a, b) => a.maxDays - b.maxDays);
    bands.push(infinityBand);
    tableBody.innerHTML = '';
    bands.forEach((band) => tableBody.appendChild(createRow(band)));
    updatePreview();
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const newBands = getBandsFromTable();
    const thresholdValue = getThresholdFromInput();
    const indicatorValue = getIndicatorFromInputs();
    const ageBadgeEnabled = ageBadgeToggle.checked;
    const updateIndicatorEnabled = updateIndicatorToggle.checked;
    if (currentBoardId) {
      if (!fullConfig.boards[currentBoardId]) {
        fullConfig.boards[currentBoardId] = {
          name: boardSelect.options[boardSelect.selectedIndex].text,
        };
      }
      fullConfig.boards[currentBoardId].enableAgeBadge = ageBadgeEnabled;
      fullConfig.boards[currentBoardId].enableUpdateIndicator = updateIndicatorEnabled;
      fullConfig.boards[currentBoardId].ageBands = newBands;
      fullConfig.boards[currentBoardId].updateThresholdDays = thresholdValue;
      fullConfig.boards[currentBoardId].updateIndicator = indicatorValue;
      fullConfig.boards[currentBoardId].sle = getSleFromInputs();
    } else {
      fullConfig.defaultConfig.enableAgeBadge = ageBadgeEnabled;
      fullConfig.defaultConfig.enableUpdateIndicator = updateIndicatorEnabled;
      fullConfig.defaultConfig.ageBands = newBands;
      fullConfig.defaultConfig.updateThresholdDays = thresholdValue;
      fullConfig.defaultConfig.updateIndicator = indicatorValue;
    }
    saveConfig(fullConfig, function () {
      statusDiv.textContent = 'Configuration saved.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (currentBoardId) {
      if (fullConfig.boards[currentBoardId]) {
        delete fullConfig.boards[currentBoardId].ageBands;
        delete fullConfig.boards[currentBoardId].updateThresholdDays;
        delete fullConfig.boards[currentBoardId].updateIndicator;
        delete fullConfig.boards[currentBoardId].enableAgeBadge;
        delete fullConfig.boards[currentBoardId].enableUpdateIndicator;
        delete fullConfig.boards[currentBoardId].sle;
      }
    } else {
      fullConfig.defaultConfig = cloneDefaultConfig();
    }
    renderConfigToUI(getCurrentConfig());
    saveConfig(fullConfig, function () {
      statusDiv.textContent = 'Configuration reset to default.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });

  loadConfig(function (config) {
    fullConfig = config;
    populateBoardSelect();
    renderConfigToUI(getCurrentConfig());
    updatePreview();
  });
});
