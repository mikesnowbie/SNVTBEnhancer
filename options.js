document.addEventListener('DOMContentLoaded', function () {
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
  const wipLanesSection = document.getElementById('wipLanesSection');
  const wipLanesToggle = document.getElementById('wipLanesToggle');
  const wipLanesCheckboxes = document.getElementById('wipLanesCheckboxes');
  const wipLanesList = document.getElementById('wipLanesList');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFileInput');
  const sleDaysInput = document.getElementById('sleDaysInput');
  const sleApproachingInput = document.getElementById('sleApproachingInput');
  const sleSummaryToggle = document.getElementById('sleSummaryToggle');
  const sleEmojiToggle = document.getElementById('sleEmojiToggle');
  const sleEmojiSettings = document.getElementById('sleEmojiSettings');
  const sleBorderToggle = document.getElementById('sleBorderToggle');
  const sleApproachingEmojiInput = document.getElementById('sleApproachingEmojiInput');
  const sleBreachedEmojiInput = document.getElementById('sleBreachedEmojiInput');
  const sleToggle = document.getElementById('sleToggle');
  const sleDefaultHint = document.getElementById('sleDefaultHint');
  const sleFields = document.getElementById('sleFields');
  const ageBadgePrefixToggle = document.getElementById('ageBadgePrefixToggle');
  const ageBadgePrefixInput = document.getElementById('ageBadgePrefixInput');
  const ageBadgePrefixSettings = document.getElementById('ageBadgePrefixSettings');
  const totalWipToggle = document.getElementById('totalWipToggle');
  const totalWipDefaultHint = document.getElementById('totalWipDefaultHint');
  const totalWipFields = document.getElementById('totalWipFields');
  const totalWipLanesList = document.getElementById('totalWipLanesList');

  let fullConfig = null;
  let currentBoardId = null; // null means default config

  function renderWipLanes(boardId) {
    if (!boardId) {
      wipLanesSection.style.display = 'none';
      return;
    }
    const boardCfg = fullConfig.boards[boardId];
    const lanes = (boardCfg && Array.isArray(boardCfg.lanes)) ? boardCfg.lanes : [];
    const wipLanes = (boardCfg && Array.isArray(boardCfg.wipLanes)) ? boardCfg.wipLanes : [];
    const enabled = boardCfg && boardCfg.enableWipLanes === true;

    wipLanesToggle.checked = enabled;
    wipLanesCheckboxes.style.display = enabled ? '' : 'none';

    wipLanesList.innerHTML = '';
    if (lanes.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'field-help';
      hint.textContent = 'No lanes discovered yet. Visit this board in ServiceNow, then return here to configure lane restrictions.';
      wipLanesList.appendChild(hint);
    } else {
      lanes.forEach((lane) => {
        const item = document.createElement('div');
        item.className = 'lane-checkbox-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const safeId = 'lane-' + lane.replace(/[^a-z0-9]/gi, '-');
        cb.id = safeId;
        cb.value = lane;
        cb.checked = wipLanes.includes(lane);
        const lbl = document.createElement('label');
        lbl.htmlFor = safeId;
        lbl.textContent = lane;
        item.appendChild(cb);
        item.appendChild(lbl);
        wipLanesList.appendChild(item);
      });
    }
    wipLanesSection.style.display = '';
  }

  function getWipLanesFromUI() {
    const checked = [];
    wipLanesList.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      checked.push(cb.value);
    });
    return checked;
  }

  function updateSleVisibility() {
    const sleToggleLabel = sleToggle.parentElement;
    if (currentBoardId) {
      sleToggleLabel.style.display = '';
      sleDefaultHint.style.display = 'none';
      sleFields.style.display = sleToggle.checked ? '' : 'none';
    } else {
      sleToggleLabel.style.display = 'none';
      sleDefaultHint.style.display = '';
      sleFields.style.display = 'none';
    }
  }

  function renderSleToUI(sle) {
    const s = sle || { enabled: true, days: 0, approachingDays: 3, showSummary: true, showBadgeEmojis: true, showBadgeBorder: true, approachingEmoji: '⚠️', breachedEmoji: '🔴' };
    sleToggle.checked = s.enabled !== false;
    sleDaysInput.value = s.days;
    sleApproachingInput.value = s.approachingDays;
    sleSummaryToggle.checked = s.showSummary !== false;
    sleEmojiToggle.checked = s.showBadgeEmojis !== false;
    sleEmojiSettings.style.display = sleEmojiToggle.checked ? '' : 'none';
    sleBorderToggle.checked = s.showBadgeBorder !== false;
    sleApproachingEmojiInput.value = s.approachingEmoji || '⚠️';
    sleBreachedEmojiInput.value = s.breachedEmoji || '🔴';
  }

  function getSleFromInputs() {
    const days = parseInt(sleDaysInput.value, 10);
    const approachingDays = parseInt(sleApproachingInput.value, 10);
    return {
      enabled: sleToggle.checked,
      days: isNaN(days) || days < 0 ? 0 : days,
      approachingDays: isNaN(approachingDays) || approachingDays < 0 ? 3 : approachingDays,
      showSummary: sleSummaryToggle.checked,
      showBadgeEmojis: sleEmojiToggle.checked,
      showBadgeBorder: sleBorderToggle.checked,
      approachingEmoji: sleApproachingEmojiInput.value.trim() || '⚠️',
      breachedEmoji: sleBreachedEmojiInput.value.trim() || '🔴',
    };
  }

  function updateSleEmojiVisibility() {
    sleEmojiSettings.style.display = sleEmojiToggle.checked ? '' : 'none';
  }

  function updateTotalWipVisibility() {
    const totalWipToggleLabel = totalWipToggle.parentElement;
    if (currentBoardId) {
      totalWipToggleLabel.style.display = '';
      totalWipDefaultHint.style.display = 'none';
      totalWipFields.style.display = totalWipToggle.checked ? '' : 'none';
    } else {
      totalWipToggleLabel.style.display = 'none';
      totalWipDefaultHint.style.display = '';
      totalWipFields.style.display = 'none';
    }
  }

  function createWipFlowDivider(label) {
    const div = document.createElement('div');
    div.className = 'wip-flow-divider';
    div.textContent = label;
    return div;
  }

  function getTotalWipFromUI() {
    const checked = [];
    totalWipLanesList.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      checked.push(cb.value);
    });
    return checked;
  }

  function rebuildTotalWipDividers() {
    if (!currentBoardId) return;
    const boardCfg = fullConfig.boards[currentBoardId];
    const lanes = (boardCfg && Array.isArray(boardCfg.lanes)) ? boardCfg.lanes : [];
    buildTotalWipList(lanes, getTotalWipFromUI());
  }

  function buildTotalWipList(lanes, selectedLanes) {
    totalWipLanesList.innerHTML = '';
    if (lanes.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'field-help';
      hint.textContent = 'No lanes discovered yet. Visit this board in ServiceNow, then return here to configure WIP lanes.';
      totalWipLanesList.appendChild(hint);
      return;
    }
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const isChecked = selectedLanes.includes(lane);
      const prevChecked = i > 0 ? selectedLanes.includes(lanes[i - 1]) : false;
      const nextChecked = i < lanes.length - 1 ? selectedLanes.includes(lanes[i + 1]) : false;

      if (isChecked && !prevChecked) {
        totalWipLanesList.appendChild(createWipFlowDivider('Start'));
      }

      const item = document.createElement('div');
      item.className = 'lane-checkbox-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const safeId = 'twip-' + lane.replace(/[^a-z0-9]/gi, '-');
      cb.id = safeId;
      cb.value = lane;
      cb.checked = isChecked;
      cb.addEventListener('change', rebuildTotalWipDividers);
      const lbl = document.createElement('label');
      lbl.htmlFor = safeId;
      lbl.textContent = lane;
      item.appendChild(cb);
      item.appendChild(lbl);
      totalWipLanesList.appendChild(item);

      if (isChecked && !nextChecked) {
        totalWipLanesList.appendChild(createWipFlowDivider('Finish'));
      }
    }
  }

  function renderTotalWipLanes(boardId) {
    totalWipLanesList.innerHTML = '';
    if (!boardId) return;
    const boardCfg = fullConfig.boards[boardId];
    const lanes = (boardCfg && Array.isArray(boardCfg.lanes)) ? boardCfg.lanes : [];
    const selectedLanes = (boardCfg && boardCfg.totalWip && Array.isArray(boardCfg.totalWip.lanes))
      ? boardCfg.totalWip.lanes
      : [];
    buildTotalWipList(lanes, selectedLanes);
  }

  function updateAgeBadgePrefixVisibility() {
    ageBadgePrefixSettings.style.display = ageBadgePrefixToggle.checked ? '' : 'none';
    updatePreview();
  }

  function toggleSettingsVisibility() {
    const showAge = ageBadgeToggle.checked;
    const showUpdate = updateIndicatorToggle.checked;
    ageBadgeSettings.style.display = showAge ? '' : 'none';
    updateIndicatorSettings.style.display = showUpdate ? '' : 'none';
    updatePreview();
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
      const prefix = ageBadgePrefixToggle.checked ? (ageBadgePrefixInput.value || '').trimEnd() : '';
      previewBadge.textContent = prefix ? `${prefix} 10d` : '10d';
      previewBadge.style.display = '';
    } else if (previewBadge) {
      previewBadge.style.display = 'none';
    }

    if (updateOn && previewFresh && previewStale) {
      const threshold = getThresholdFromInput();
      const fresh = freshEmojiInput.value.trim() || VTBShared.DEFAULT_UPDATE_INDICATOR.freshEmoji;
      const stale = staleEmojiInput.value.trim() || VTBShared.DEFAULT_UPDATE_INDICATOR.staleEmoji;
      const freshDays = Math.max(0, Math.round(threshold - 1));
      const staleDays = Math.max(0, Math.round(threshold + 1));
      previewFresh.textContent = `${freshDays}d ago ${fresh}`;
      previewStale.textContent = `${staleDays}d ago ${stale}`;
      previewFresh.parentElement.parentElement.style.display = '';
    } else if (previewFresh && previewFresh.parentElement) {
      previewFresh.parentElement.parentElement.style.display = 'none';
    }
  }

  // Render the form inputs from a provided effective config object.
  function renderConfigToUI(config) {
    const ageOn = config.enableAgeBadge !== false;
    const updateOn = config.enableUpdateIndicator !== false;
    ageBadgeToggle.checked = ageOn;
    updateIndicatorToggle.checked = updateOn;

    const thresholdValue =
      typeof config.updateThresholdDays === 'number' && config.updateThresholdDays >= 0
        ? config.updateThresholdDays
        : VTBShared.DEFAULT_UPDATE_THRESHOLD_DAYS;
    thresholdInput.value = thresholdValue;

    const indicator = VTBShared.normalizeIndicator(config.updateIndicator, VTBShared.DEFAULT_UPDATE_INDICATOR);
    freshEmojiInput.value = indicator.freshEmoji;
    staleEmojiInput.value = indicator.staleEmoji;

    tableBody.innerHTML = '';
    config.ageBands.forEach((band) => {
      const row = createRow(band);
      tableBody.appendChild(row);
    });

    ageBadgePrefixToggle.checked = config.enableAgeBadgePrefix === true;
    ageBadgePrefixInput.value = config.ageBadgePrefix || '';
    ageBadgePrefixSettings.style.display = config.enableAgeBadgePrefix ? '' : 'none';

    renderWipLanes(currentBoardId);
    updateExportImportVisibility();
    // Render SLE fields first so that sleToggle.checked is set before updateSleVisibility reads it.
    if (currentBoardId) {
      const boardSle = fullConfig.boards[currentBoardId] && fullConfig.boards[currentBoardId].sle;
      renderSleToUI(boardSle);
    } else {
      sleToggle.checked = true;
    }
    updateSleVisibility();
    if (currentBoardId) {
      const boardTotalWip = fullConfig.boards[currentBoardId] && fullConfig.boards[currentBoardId].totalWip;
      totalWipToggle.checked = boardTotalWip && boardTotalWip.enabled === true;
      renderTotalWipLanes(currentBoardId);
    } else {
      totalWipToggle.checked = false;
      totalWipLanesList.innerHTML = '';
    }
    updateTotalWipVisibility();
    // All inputs are now populated — call this last so updatePreview reads the correct values.
    toggleSettingsVisibility();
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
      value = VTBShared.DEFAULT_UPDATE_THRESHOLD_DAYS;
    }
    return value;
  }

  function getIndicatorFromInputs() {
    const fresh = freshEmojiInput.value.trim() || VTBShared.DEFAULT_UPDATE_INDICATOR.freshEmoji;
    const stale = staleEmojiInput.value.trim() || VTBShared.DEFAULT_UPDATE_INDICATOR.staleEmoji;
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

  // --- Export / Import ---

  function updateExportImportVisibility() {
    const show = !!currentBoardId;
    exportBtn.style.display = show ? '' : 'none';
    importBtn.style.display = show ? '' : 'none';
  }

  exportBtn.addEventListener('click', () => VTBShared.exportBoardConfig(fullConfig, currentBoardId));

  importBtn.addEventListener('click', () => {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { error, config } = VTBShared.importBoardConfig(e.target.result, fullConfig, currentBoardId);
      if (error) {
        statusDiv.textContent = error;
      } else {
        fullConfig = config;
        renderConfigToUI(VTBShared.resolveEffectiveConfig(fullConfig, currentBoardId));
        VTBShared.saveConfig(fullConfig, () => {
          statusDiv.textContent = 'Settings imported and saved.';
          setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        });
      }
    };
    reader.readAsText(file);
  });

  // --- End Export / Import ---

  boardSelect.addEventListener('change', () => {
    currentBoardId = boardSelect.value || null;
    updateExportImportVisibility();
    updateSleVisibility();
    renderConfigToUI(VTBShared.resolveEffectiveConfig(fullConfig, currentBoardId));
  });

  ageBadgeToggle.addEventListener('change', toggleSettingsVisibility);
  updateIndicatorToggle.addEventListener('change', toggleSettingsVisibility);
  ageBadgePrefixToggle.addEventListener('change', updateAgeBadgePrefixVisibility);
  ageBadgePrefixInput.addEventListener('input', updatePreview);
  wipLanesToggle.addEventListener('change', () => {
    wipLanesCheckboxes.style.display = wipLanesToggle.checked ? '' : 'none';
  });
  sleToggle.addEventListener('change', updateSleVisibility);
  sleEmojiToggle.addEventListener('change', updateSleEmojiVisibility);
  totalWipToggle.addEventListener('change', updateTotalWipVisibility);
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
    const enableAgeBadgePrefix = ageBadgePrefixToggle.checked;
    const ageBadgePrefix = (ageBadgePrefixInput.value || '').trimEnd();
    if (currentBoardId) {
      if (!fullConfig.boards[currentBoardId]) {
        fullConfig.boards[currentBoardId] = {
          name: boardSelect.options[boardSelect.selectedIndex].text,
        };
      }
      fullConfig.boards[currentBoardId].enableAgeBadge = ageBadgeEnabled;
      fullConfig.boards[currentBoardId].enableUpdateIndicator = updateIndicatorEnabled;
      fullConfig.boards[currentBoardId].enableAgeBadgePrefix = enableAgeBadgePrefix;
      fullConfig.boards[currentBoardId].ageBadgePrefix = ageBadgePrefix;
      fullConfig.boards[currentBoardId].ageBands = newBands;
      fullConfig.boards[currentBoardId].updateThresholdDays = thresholdValue;
      fullConfig.boards[currentBoardId].updateIndicator = indicatorValue;
      fullConfig.boards[currentBoardId].enableWipLanes = wipLanesToggle.checked;
      fullConfig.boards[currentBoardId].wipLanes = getWipLanesFromUI();
      fullConfig.boards[currentBoardId].sle = getSleFromInputs();
      fullConfig.boards[currentBoardId].totalWip = {
        enabled: totalWipToggle.checked,
        lanes: getTotalWipFromUI(),
      };
    } else {
      fullConfig.defaultConfig.enableAgeBadge = ageBadgeEnabled;
      fullConfig.defaultConfig.enableUpdateIndicator = updateIndicatorEnabled;
      fullConfig.defaultConfig.enableAgeBadgePrefix = enableAgeBadgePrefix;
      fullConfig.defaultConfig.ageBadgePrefix = ageBadgePrefix;
      fullConfig.defaultConfig.ageBands = newBands;
      fullConfig.defaultConfig.updateThresholdDays = thresholdValue;
      fullConfig.defaultConfig.updateIndicator = indicatorValue;
    }
    VTBShared.saveConfig(fullConfig, function () {
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
        delete fullConfig.boards[currentBoardId].enableAgeBadgePrefix;
        delete fullConfig.boards[currentBoardId].ageBadgePrefix;
        delete fullConfig.boards[currentBoardId].enableWipLanes;
        delete fullConfig.boards[currentBoardId].wipLanes;
        delete fullConfig.boards[currentBoardId].sle;
        delete fullConfig.boards[currentBoardId].totalWip;
      }
    } else {
      fullConfig.defaultConfig = VTBShared.cloneDefaultConfig();
    }
    renderConfigToUI(VTBShared.resolveEffectiveConfig(fullConfig, currentBoardId));
    VTBShared.saveConfig(fullConfig, function () {
      statusDiv.textContent = 'Configuration reset to default.';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });

  VTBShared.loadConfig(function (config) {
    fullConfig = config;
    populateBoardSelect();
    renderConfigToUI(VTBShared.resolveEffectiveConfig(fullConfig, currentBoardId));
    updatePreview();
  });
});
