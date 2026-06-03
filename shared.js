/*
  ServiceNow Visual Task Board Enhancer — shared.js
  Shared config constants, normalization, storage, and import/export utilities.
  Consumed by content.js (via manifest content_scripts) and options.html (via <script> tag).
  Exposed as a single top-level namespace: VTBShared.
*/

const VTBShared = (function () {
  const DEFAULT_UPDATE_THRESHOLD_DAYS = 6;
  const DEFAULT_UPDATE_INDICATOR = { freshEmoji: '✅', staleEmoji: '❌' };
  const DEFAULT_AGE_BANDS = [
    { maxDays: 7,    color: '#f9e79f' },
    { maxDays: 30,   color: '#f0ad4e' },
    { maxDays: 90,   color: '#e67e22' },
    { maxDays: 9999, color: '#d9534f' },
  ];

  function cloneDefaultConfig() {
    return {
      enableAgeBadge: true,
      enableUpdateIndicator: true,
      enableAgeBadgePrefix: false,
      ageBadgePrefix: '',
      ageBands: DEFAULT_AGE_BANDS.map((b) => ({ ...b })),
      updateThresholdDays: DEFAULT_UPDATE_THRESHOLD_DAYS,
      updateIndicator: { ...DEFAULT_UPDATE_INDICATOR },
    };
  }

  // Resolves freshEmoji / staleEmoji from a source object, falling back to a
  // provided fallback (or the global default). Pure — no side effects.
  function normalizeIndicator(source, fallback) {
    const base = fallback || DEFAULT_UPDATE_INDICATOR;
    if (!source || typeof source !== 'object') return { ...base };
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

  // Ensures every field in a raw config object (read from storage) is present
  // and valid, filling gaps with defaults. Mutates and returns the config.
  function normalizeConfigStructure(config) {
    let cfg = config;
    if (!cfg || typeof cfg !== 'object') {
      cfg = { defaultConfig: cloneDefaultConfig(), boards: {} };
    }

    if (!cfg.defaultConfig || typeof cfg.defaultConfig !== 'object') {
      cfg.defaultConfig = cloneDefaultConfig();
    }

    if (!Array.isArray(cfg.defaultConfig.ageBands)) {
      cfg.defaultConfig.ageBands = DEFAULT_AGE_BANDS.map((b) => ({ ...b }));
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
    cfg.defaultConfig.enableAgeBadgePrefix =
      typeof cfg.defaultConfig.enableAgeBadgePrefix === 'boolean'
        ? cfg.defaultConfig.enableAgeBadgePrefix
        : false;
    cfg.defaultConfig.ageBadgePrefix =
      typeof cfg.defaultConfig.ageBadgePrefix === 'string'
        ? cfg.defaultConfig.ageBadgePrefix
        : '';

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
      boardCfg.enableAgeBadgePrefix =
        typeof boardCfg.enableAgeBadgePrefix === 'boolean'
          ? boardCfg.enableAgeBadgePrefix
          : cfg.defaultConfig.enableAgeBadgePrefix;
      boardCfg.ageBadgePrefix =
        typeof boardCfg.ageBadgePrefix === 'string'
          ? boardCfg.ageBadgePrefix
          : cfg.defaultConfig.ageBadgePrefix;

      boardCfg.enableWipLanes =
        typeof boardCfg.enableWipLanes === 'boolean'
          ? boardCfg.enableWipLanes
          : Array.isArray(boardCfg.wipLanes) && boardCfg.wipLanes.length > 0;

      if (!Array.isArray(boardCfg.wipLanes)) boardCfg.wipLanes = [];
      if (!Array.isArray(boardCfg.lanes)) boardCfg.lanes = [];

      if (!boardCfg.totalWip || typeof boardCfg.totalWip !== 'object') {
        boardCfg.totalWip = { enabled: false, lanes: [] };
      } else {
        if (typeof boardCfg.totalWip.enabled !== 'boolean') boardCfg.totalWip.enabled = false;
        if (!Array.isArray(boardCfg.totalWip.lanes)) boardCfg.totalWip.lanes = [];
      }

      if (!boardCfg.sle || typeof boardCfg.sle !== 'object') {
        boardCfg.sle = {
          enabled: true, days: 0, approachingDays: 3,
          showSummary: true, showBadgeEmojis: true, showBadgeBorder: true,
          approachingEmoji: '⚠️', breachedEmoji: '🔴',
        };
      } else {
        if (typeof boardCfg.sle.enabled !== 'boolean') boardCfg.sle.enabled = true;
        if (typeof boardCfg.sle.days !== 'number' || boardCfg.sle.days < 0) boardCfg.sle.days = 0;
        if (typeof boardCfg.sle.approachingDays !== 'number' || boardCfg.sle.approachingDays < 0) boardCfg.sle.approachingDays = 3;
        if (typeof boardCfg.sle.showSummary !== 'boolean') boardCfg.sle.showSummary = true;
        const legacyEscalation = typeof boardCfg.sle.showBadgeEscalation === 'boolean' ? boardCfg.sle.showBadgeEscalation : true;
        if (typeof boardCfg.sle.showBadgeEmojis !== 'boolean') boardCfg.sle.showBadgeEmojis = legacyEscalation;
        if (typeof boardCfg.sle.showBadgeBorder !== 'boolean') boardCfg.sle.showBadgeBorder = legacyEscalation;
        if (!boardCfg.sle.approachingEmoji || typeof boardCfg.sle.approachingEmoji !== 'string') boardCfg.sle.approachingEmoji = '⚠️';
        if (!boardCfg.sle.breachedEmoji || typeof boardCfg.sle.breachedEmoji !== 'string') boardCfg.sle.breachedEmoji = '🔴';
      }
    });

    return cfg;
  }

  // Returns the fully merged effective config for a given boardId (or the
  // default config when boardId is null/undefined). All fields are resolved:
  // board overrides take precedence over defaults, and wipLanes is pre-resolved
  // (empty array when enableWipLanes is false, so callers need not check the flag).
  function resolveEffectiveConfig(fullConfig, boardId) {
    const def = fullConfig.defaultConfig;
    const board = boardId ? (fullConfig.boards[boardId] || null) : null;

    return {
      enableAgeBadge:
        board && typeof board.enableAgeBadge === 'boolean'
          ? board.enableAgeBadge
          : def.enableAgeBadge !== false,
      enableUpdateIndicator:
        board && typeof board.enableUpdateIndicator === 'boolean'
          ? board.enableUpdateIndicator
          : def.enableUpdateIndicator !== false,
      enableAgeBadgePrefix:
        board && typeof board.enableAgeBadgePrefix === 'boolean'
          ? board.enableAgeBadgePrefix
          : def.enableAgeBadgePrefix === true,
      ageBadgePrefix:
        board && typeof board.ageBadgePrefix === 'string'
          ? board.ageBadgePrefix
          : def.ageBadgePrefix || '',
      ageBands:
        board && board.ageBands
          ? board.ageBands.map((b) => ({ ...b }))
          : def.ageBands.map((b) => ({ ...b })),
      updateThresholdDays:
        board && typeof board.updateThresholdDays === 'number'
          ? board.updateThresholdDays
          : def.updateThresholdDays || DEFAULT_UPDATE_THRESHOLD_DAYS,
      updateIndicator: normalizeIndicator(
        board ? board.updateIndicator : null,
        def.updateIndicator
      ),
      // wipLanes is pre-resolved: only populated when enableWipLanes is true.
      wipLanes:
        board && board.enableWipLanes === true && Array.isArray(board.wipLanes)
          ? board.wipLanes
          : [],
      sle:
        board && board.sle
          ? board.sle
          : { enabled: true, days: 0, approachingDays: 3, showSummary: true, showBadgeEmojis: true, showBadgeBorder: true, approachingEmoji: '⚠️', breachedEmoji: '🔴' },
      totalWip:
        board && board.totalWip
          ? board.totalWip
          : { enabled: false, lanes: [] },
    };
  }

  // Reads vtbEnhancerConfig from chrome.storage.sync, migrates old flat format,
  // normalizes the structure, then calls callback(cfg). Uses defensive error
  // handling (try/catch + chrome.runtime.lastError) to survive an invalidated
  // extension context (e.g. extension reloaded during development). Falls back
  // to localStorage in non-extension environments.
  function loadConfig(callback) {
    const fallback = { defaultConfig: cloneDefaultConfig(), boards: {} };
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      try {
        chrome.storage.sync.get({ vtbEnhancerConfig: fallback }, function (data) {
          if (chrome.runtime.lastError) {
            callback(normalizeConfigStructure(fallback));
            return;
          }
          let cfg = data.vtbEnhancerConfig;
          // Migrate old flat format { ageBands: [...] } → { defaultConfig: {...}, boards: {} }
          if (cfg && cfg.ageBands) {
            cfg = { defaultConfig: cfg, boards: {} };
          }
          callback(normalizeConfigStructure(cfg));
        });
      } catch (_) {
        callback(normalizeConfigStructure(fallback));
      }
    } else {
      try {
        const stored = localStorage.getItem('vtbEnhancerConfig');
        const cfg = stored ? JSON.parse(stored) : fallback;
        callback(normalizeConfigStructure(cfg));
      } catch (_) {
        callback(normalizeConfigStructure(fallback));
      }
    }
  }

  // Writes cfg to chrome.storage.sync. Uses defensive error handling to survive
  // an invalidated extension context. Falls back to localStorage.
  function saveConfig(cfg, callback) {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      try {
        chrome.storage.sync.set({ vtbEnhancerConfig: cfg }, () => {
          if (chrome.runtime.lastError) return;
          if (callback) callback();
        });
      } catch (_) {
        // Extension context invalidated (e.g. reloaded during development) — ignore.
      }
    } else {
      localStorage.setItem('vtbEnhancerConfig', JSON.stringify(cfg));
      if (callback) callback();
    }
  }

  // Builds the full board config export payload and triggers a JSON file download.
  function exportBoardConfig(fullConfig, boardId) {
    if (!boardId) return;
    const board = fullConfig.boards[boardId] || {};
    const def = fullConfig.defaultConfig;
    const payload = {
      vtbEnhancerBoardConfig: {
        enableAgeBadge: typeof board.enableAgeBadge === 'boolean' ? board.enableAgeBadge : def.enableAgeBadge,
        enableUpdateIndicator: typeof board.enableUpdateIndicator === 'boolean' ? board.enableUpdateIndicator : def.enableUpdateIndicator,
        enableAgeBadgePrefix: typeof board.enableAgeBadgePrefix === 'boolean' ? board.enableAgeBadgePrefix : def.enableAgeBadgePrefix,
        ageBadgePrefix: typeof board.ageBadgePrefix === 'string' ? board.ageBadgePrefix : def.ageBadgePrefix,
        ageBands: (board.ageBands || def.ageBands).map((b) => ({ ...b })),
        updateThresholdDays: typeof board.updateThresholdDays === 'number' ? board.updateThresholdDays : def.updateThresholdDays,
        updateIndicator: { ...normalizeIndicator(board.updateIndicator, def.updateIndicator) },
        enableWipLanes: typeof board.enableWipLanes === 'boolean' ? board.enableWipLanes : false,
        wipLanes: Array.isArray(board.wipLanes) ? [...board.wipLanes] : [],
        sle: board.sle && typeof board.sle === 'object'
          ? { ...board.sle }
          : { enabled: true, days: 0, approachingDays: 3, showSummary: true, showBadgeEmojis: true, showBadgeBorder: true, approachingEmoji: '⚠️', breachedEmoji: '🔴' },
        totalWip: board.totalWip && typeof board.totalWip === 'object'
          ? { enabled: board.totalWip.enabled === true, lanes: Array.isArray(board.totalWip.lanes) ? [...board.totalWip.lanes] : [] }
          : { enabled: false, lanes: [] },
      },
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const boardName = (board.name || boardId).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.href = url;
    a.download = `vtb-board-config-${boardName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Parses and validates an imported JSON string, merges it into the target
  // board's config within fullConfig, and returns { error, config }.
  // On success error is null and config is the updated fullConfig.
  // On failure error is a human-readable message string and config is unchanged.
  function importBoardConfig(jsonStr, fullConfig, boardId) {
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (_) {
      return { error: 'Invalid JSON — please check the file and try again.', config: fullConfig };
    }
    const incoming = parsed && parsed.vtbEnhancerBoardConfig;
    if (!incoming || typeof incoming !== 'object') {
      return { error: 'Unrecognised format — the JSON must contain a "vtbEnhancerBoardConfig" key.', config: fullConfig };
    }
    if (!boardId) {
      return { error: 'No board selected.', config: fullConfig };
    }

    if (!fullConfig.boards[boardId]) {
      fullConfig.boards[boardId] = { name: boardId };
    }
    const target = fullConfig.boards[boardId];
    const def = fullConfig.defaultConfig;

    if (typeof incoming.enableAgeBadge === 'boolean') target.enableAgeBadge = incoming.enableAgeBadge;
    if (typeof incoming.enableUpdateIndicator === 'boolean') target.enableUpdateIndicator = incoming.enableUpdateIndicator;
    if (typeof incoming.enableAgeBadgePrefix === 'boolean') target.enableAgeBadgePrefix = incoming.enableAgeBadgePrefix;
    if (typeof incoming.ageBadgePrefix === 'string') target.ageBadgePrefix = incoming.ageBadgePrefix;
    if (typeof incoming.updateThresholdDays === 'number' && incoming.updateThresholdDays >= 0) {
      target.updateThresholdDays = incoming.updateThresholdDays;
    }
    if (incoming.updateIndicator && typeof incoming.updateIndicator === 'object') {
      target.updateIndicator = normalizeIndicator(incoming.updateIndicator, def.updateIndicator);
    }
    if (Array.isArray(incoming.ageBands) && incoming.ageBands.length > 0) {
      const bands = incoming.ageBands.filter(
        (b) => b && typeof b.maxDays === 'number' && b.maxDays > 0 && typeof b.color === 'string'
      );
      if (bands.length > 0) target.ageBands = bands;
    }
    if (typeof incoming.enableWipLanes === 'boolean') target.enableWipLanes = incoming.enableWipLanes;
    if (Array.isArray(incoming.wipLanes)) {
      target.wipLanes = incoming.wipLanes.filter((l) => typeof l === 'string');
    }
    if (incoming.totalWip && typeof incoming.totalWip === 'object') {
      target.totalWip = {
        enabled: typeof incoming.totalWip.enabled === 'boolean' ? incoming.totalWip.enabled : false,
        lanes: Array.isArray(incoming.totalWip.lanes) ? incoming.totalWip.lanes.filter((l) => typeof l === 'string') : [],
      };
    }
    if (incoming.sle && typeof incoming.sle === 'object') {
      target.sle = {
        enabled: typeof incoming.sle.enabled === 'boolean' ? incoming.sle.enabled : true,
        days: typeof incoming.sle.days === 'number' && incoming.sle.days >= 0 ? incoming.sle.days : 0,
        approachingDays: typeof incoming.sle.approachingDays === 'number' && incoming.sle.approachingDays >= 0 ? incoming.sle.approachingDays : 3,
        showSummary: typeof incoming.sle.showSummary === 'boolean' ? incoming.sle.showSummary : true,
        showBadgeEmojis: typeof incoming.sle.showBadgeEmojis === 'boolean' ? incoming.sle.showBadgeEmojis : (typeof incoming.sle.showBadgeEscalation === 'boolean' ? incoming.sle.showBadgeEscalation : true),
        showBadgeBorder: typeof incoming.sle.showBadgeBorder === 'boolean' ? incoming.sle.showBadgeBorder : (typeof incoming.sle.showBadgeEscalation === 'boolean' ? incoming.sle.showBadgeEscalation : true),
        approachingEmoji: typeof incoming.sle.approachingEmoji === 'string' && incoming.sle.approachingEmoji.trim() ? incoming.sle.approachingEmoji : '⚠️',
        breachedEmoji: typeof incoming.sle.breachedEmoji === 'string' && incoming.sle.breachedEmoji.trim() ? incoming.sle.breachedEmoji : '🔴',
      };
    }

    return { error: null, config: fullConfig };
  }

  return {
    DEFAULT_UPDATE_THRESHOLD_DAYS,
    DEFAULT_UPDATE_INDICATOR,
    DEFAULT_AGE_BANDS,
    cloneDefaultConfig,
    normalizeIndicator,
    normalizeConfigStructure,
    resolveEffectiveConfig,
    loadConfig,
    saveConfig,
    exportBoardConfig,
    importBoardConfig,
  };
})();
