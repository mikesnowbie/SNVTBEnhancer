/*
  ServiceNow Visual Task Board Enhancer - Work Item Age
  Version 1.0.0 (Safari)
  - Uses browser.* namespace (WebExtensions API) for Safari compatibility.
  - Waits until the board has fully loaded all cards (using a MutationObserver with a debounce)
    before processing any cards or displaying a status message.
  - Processes each card to calculate and display an "Age" badge. It prefers the card's "Actual start date", which teams can manage independently of when the record was opened, and treats "Start date" as the same starting point before finally falling back to "Opened" when no start date exists.
  - Badge background color is determined by configurable age bands loaded from browser.storage.sync.
  - Continues watching the DOM for new card elements and applies the badge automatically.
*/
(function () {
  if (!window.location.href.includes('vtb.do')) return;

  const DEFAULT_UPDATE_THRESHOLD_DAYS = 6;
  const DEFAULT_UPDATE_INDICATOR = {
    freshEmoji: '✅',
    staleEmoji: '❌',
  };

  const defaultConfig = {
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

  const defaultStorage = { defaultConfig: defaultConfig, boards: {} };

  const boardIdMatch = window.location.href.match(/sysparm_board=([^&]+)/);
  const boardId = boardIdMatch ? boardIdMatch[1] : null;

  function getConfig(callback) {
    if (
      typeof browser !== 'undefined' &&
      browser.storage &&
      browser.storage.sync
    ) {
      browser.storage.sync.get(
        { vtbEnhancerConfig: defaultStorage }
      ).then(function (data) {
        let cfg = data.vtbEnhancerConfig;
        if (cfg && cfg.ageBands) {
          cfg = { defaultConfig: cfg, boards: {} };
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
          cfg.defaultConfig.updateIndicator = {
            freshEmoji:
              typeof cfg.defaultConfig.updateIndicator.freshEmoji === 'string' &&
              cfg.defaultConfig.updateIndicator.freshEmoji.trim()
                ? cfg.defaultConfig.updateIndicator.freshEmoji
                : DEFAULT_UPDATE_INDICATOR.freshEmoji,
            staleEmoji:
              typeof cfg.defaultConfig.updateIndicator.staleEmoji === 'string' &&
              cfg.defaultConfig.updateIndicator.staleEmoji.trim()
                ? cfg.defaultConfig.updateIndicator.staleEmoji
                : DEFAULT_UPDATE_INDICATOR.staleEmoji,
          };
        }

        if (typeof cfg.defaultConfig.enableAgeBadge !== 'boolean') {
          cfg.defaultConfig.enableAgeBadge = true;
        }
        if (typeof cfg.defaultConfig.enableUpdateIndicator !== 'boolean') {
          cfg.defaultConfig.enableUpdateIndicator = true;
        }

        if (!cfg.boards || typeof cfg.boards !== 'object') {
          cfg.boards = {};
        }

        Object.keys(cfg.boards).forEach((key) => {
          const boardCfg = cfg.boards[key];
          if (!boardCfg || typeof boardCfg !== 'object') return;
          if (typeof boardCfg.updateThresholdDays !== 'number') {
            boardCfg.updateThresholdDays = cfg.defaultConfig.updateThresholdDays;
          }

          if (typeof boardCfg.enableAgeBadge !== 'boolean') {
            boardCfg.enableAgeBadge = cfg.defaultConfig.enableAgeBadge;
          }

          if (typeof boardCfg.enableUpdateIndicator !== 'boolean') {
            boardCfg.enableUpdateIndicator = cfg.defaultConfig.enableUpdateIndicator;
          }

          if (!boardCfg.updateIndicator || typeof boardCfg.updateIndicator !== 'object') {
            boardCfg.updateIndicator = { ...cfg.defaultConfig.updateIndicator };
          } else {
            boardCfg.updateIndicator = {
              freshEmoji:
                typeof boardCfg.updateIndicator.freshEmoji === 'string' &&
                boardCfg.updateIndicator.freshEmoji.trim()
                  ? boardCfg.updateIndicator.freshEmoji
                  : cfg.defaultConfig.updateIndicator.freshEmoji,
              staleEmoji:
                typeof boardCfg.updateIndicator.staleEmoji === 'string' &&
                boardCfg.updateIndicator.staleEmoji.trim()
                  ? boardCfg.updateIndicator.staleEmoji
                  : cfg.defaultConfig.updateIndicator.staleEmoji,
            };
          }

          if (!Array.isArray(boardCfg.wipLanes)) {
            boardCfg.wipLanes = [];
          }
          if (!Array.isArray(boardCfg.lanes)) {
            boardCfg.lanes = [];
          }
          if (!boardCfg.sle || typeof boardCfg.sle !== 'object') {
            boardCfg.sle = { enabled: true, days: 0, approachingDays: 3, showSummary: true, showBadgeEscalation: true, approachingEmoji: '⚠️', breachedEmoji: '🔴' };
          } else {
            if (typeof boardCfg.sle.enabled !== 'boolean') boardCfg.sle.enabled = true;
            if (typeof boardCfg.sle.days !== 'number' || boardCfg.sle.days < 0) boardCfg.sle.days = 0;
            if (typeof boardCfg.sle.approachingDays !== 'number' || boardCfg.sle.approachingDays < 0) boardCfg.sle.approachingDays = 3;
            if (typeof boardCfg.sle.showSummary !== 'boolean') boardCfg.sle.showSummary = true;
            if (typeof boardCfg.sle.showBadgeEscalation !== 'boolean') boardCfg.sle.showBadgeEscalation = true;
            if (!boardCfg.sle.approachingEmoji || typeof boardCfg.sle.approachingEmoji !== 'string') boardCfg.sle.approachingEmoji = '⚠️';
            if (!boardCfg.sle.breachedEmoji || typeof boardCfg.sle.breachedEmoji !== 'string') boardCfg.sle.breachedEmoji = '🔴';
          }
        });
        callback(cfg);
      }).catch(function () {
        callback(defaultStorage);
      });
    } else {
      callback(defaultStorage);
    }
  }

  function saveConfig(cfg, callback) {
    if (
      typeof browser !== 'undefined' &&
      browser.storage &&
      browser.storage.sync
    ) {
      browser.storage.sync.set({ vtbEnhancerConfig: cfg }).then(() => {
        if (callback) callback();
      }).catch(() => {
        if (callback) callback();
      });
    } else {
      localStorage.setItem('vtbEnhancerConfig', JSON.stringify(cfg));
      if (callback) callback();
    }
  }

  // CSS selectors tried in order when searching for a lane/column title element.
  // ServiceNow VTB renders lanes as columns; the title is in a header child element.
  const LANE_TITLE_SELECTORS = [
    '.vtb-lane-header-title',
    '.sn-board-header-title',
    '.vtb-board-header-title',
    '[class*="lane-header"] [class*="title"]',
    '[class*="lane"] > [class*="header"] > [class*="title"]',
  ];

  // Extracts the lane name text from a lane-title container element.
  //
  // ServiceNow VTB uses an AngularJS form pattern inside .vtb-lane-header-title:
  //   <div class="vtb-lane-header-title">
  //     <form data-original-title="In Flight" class="vtb-lane-title ...">
  //       <label class="ng-binding ...">In Flight</label>
  //       <input value="In Flight">
  //     </form>
  //   </div>
  //
  // The card count lives in a separate sibling div (.vtb-lane-header-count) and
  // never appears inside the title element itself.
  //
  // However, AngularJS directives such as sn-tooltip-basic and sn-focus-input can
  // inject hidden helper spans/elements inside the form, which pollute textContent.
  // To get a clean, stable lane name we prefer these sources in order:
  //   1. The inner <label> textContent — AngularJS keeps this bound exactly to the
  //      lane name (ng-binding) with no extra injected text.
  //   2. data-original-title on the <form> — set by sn-tooltip-basic to the lane name.
  //   3. Normalized full textContent of the container as a last resort.
  function getLaneTitleText(el) {
    const label = el.querySelector('label');
    if (label) {
      const t = label.textContent.trim();
      if (t) return t;
    }
    const formEl = el.matches && el.matches('form') ? el : el.querySelector('form');
    if (formEl) {
      const attr = formEl.getAttribute('data-original-title');
      if (attr && attr.trim()) return attr.trim();
    }
    // Strip trailing "(N)" count patterns as a fallback safety measure
    return el.textContent.trim().replace(/\s*\(\d+\)\s*$/, '').trim();
  }

  // Returns the lane (column) name for a given card by walking up the DOM.
  //
  // Only the most specific selector (.vtb-lane-header-title) is used for the
  // walk-up uniqueness check. Broader selectors like [class*="title"] match
  // multiple elements per lane (the div, the form, the label, any input) so the
  // length===1 check would never succeed even when we're inside a single-lane
  // ancestor — causing false "multiple lanes" breaks and falling through to the
  // positional fallback for every card.
  //
  // The walk-up stops and returns the lane name as soon as exactly one
  // .vtb-lane-header-title is found under the current ancestor (i.e. we're
  // inside one lane's container). If that number exceeds one we've climbed above
  // the lane boundary and fall back to positional matching.
  function findCardLane(card) {
    const primarySel = LANE_TITLE_SELECTORS[0]; // '.vtb-lane-header-title'
    let el = card.parentElement;
    while (el && el !== document.body) {
      try {
        const matches = el.querySelectorAll(primarySel);
        if (matches.length === 1) {
          const text = getLaneTitleText(matches[0]);
          if (text) return text;
        } else if (matches.length > 1) {
          break; // climbed above lane boundary — multiple headers visible
        }
        // length === 0: header not in this subtree yet; keep walking up
      } catch (_) {}
      el = el.parentElement;
    }
    // Walk-up could not isolate a single-lane ancestor — fall back to positional
    // matching (works for boards where headers and card columns are in parallel
    // DOM branches, e.g. sticky-header layouts).
    return findCardLaneByPosition(card);
  }

  // Positional lane-name lookup: aligns card x-position with header x-position.
  function findCardLaneByPosition(card) {
    try {
      const cardRect = card.getBoundingClientRect();
      if (cardRect.width === 0 && cardRect.height === 0) return null;
      const cardCenterX = cardRect.left + cardRect.width / 2;
      let closestName = null;
      let minDist = Infinity;
      for (const sel of LANE_TITLE_SELECTORS) {
        document.querySelectorAll(sel).forEach((titleEl) => {
          const name = getLaneTitleText(titleEl);
          if (!name) return;
          const r = titleEl.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const dist = Math.abs((r.left + r.width / 2) - cardCenterX);
          if (dist < minDist) { minDist = dist; closestName = name; }
        });
        if (closestName !== null) break;
      }
      return closestName;
    } catch (_) {
      return null;
    }
  }

  // Returns all unique lane names currently visible on the board.
  function discoverLanes() {
    const lanes = [];
    for (const sel of LANE_TITLE_SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          const text = getLaneTitleText(el);
          if (text && !lanes.includes(text)) lanes.push(text);
        });
      } catch (_) {}
      // Use the first selector that finds anything to avoid duplicates from
      // broader selectors matching the same elements.
      if (lanes.length > 0) break;
    }
    // Fallback: derive from cards if no header elements were found
    if (lanes.length === 0) {
      document.querySelectorAll('.vtb-card-component-wrapper').forEach((card) => {
        const lane = findCardLane(card);
        if (lane && !lanes.includes(lane)) lanes.push(lane);
      });
    }
    return lanes;
  }

  function updateBoardInfo(cfg) {
    if (!boardId) return;
    // Prevent prototype pollution
    if (boardId === '__proto__' || boardId === 'constructor' || boardId === 'prototype') return;
    const label = document.querySelector('label.sn-navhub-title');
    if (!label) return;
    const name = label.textContent.trim();
    const discoveredLanes = discoverLanes();
    if (!cfg.boards[boardId]) {
      cfg.boards[boardId] = { name, lanes: discoveredLanes };
      saveConfig(cfg);
    } else {
      let changed = false;
      if (cfg.boards[boardId].name !== name) {
        cfg.boards[boardId].name = name;
        changed = true;
      }
      if (discoveredLanes.length > 0) {
        cfg.boards[boardId].lanes = discoveredLanes;
        changed = true;
      }
      if (changed) saveConfig(cfg);
    }
  }

  // Load config then run the main logic.
  getConfig(function (fullConfig) {
    const boardConfig = boardId ? fullConfig.boards[boardId] : null;
    const boardIndicator =
      (boardConfig && boardConfig.updateIndicator) ||
      fullConfig.defaultConfig.updateIndicator ||
      DEFAULT_UPDATE_INDICATOR;
    const normalizedIndicator = {
      freshEmoji:
        typeof boardIndicator.freshEmoji === 'string' &&
        boardIndicator.freshEmoji.trim()
          ? boardIndicator.freshEmoji
          : DEFAULT_UPDATE_INDICATOR.freshEmoji,
      staleEmoji:
        typeof boardIndicator.staleEmoji === 'string' &&
        boardIndicator.staleEmoji.trim()
          ? boardIndicator.staleEmoji
          : DEFAULT_UPDATE_INDICATOR.staleEmoji,
    };

    const enableAgeBadge =
      boardConfig && typeof boardConfig.enableAgeBadge === 'boolean'
        ? boardConfig.enableAgeBadge
        : fullConfig.defaultConfig.enableAgeBadge !== false;
    const enableUpdateIndicator =
      boardConfig && typeof boardConfig.enableUpdateIndicator === 'boolean'
        ? boardConfig.enableUpdateIndicator
        : fullConfig.defaultConfig.enableUpdateIndicator !== false;

    const config = {
      ageBands:
        boardConfig && boardConfig.ageBands
          ? boardConfig.ageBands
          : fullConfig.defaultConfig.ageBands,
      updateThresholdDays:
        boardConfig && typeof boardConfig.updateThresholdDays === 'number'
          ? boardConfig.updateThresholdDays
          : fullConfig.defaultConfig.updateThresholdDays || DEFAULT_UPDATE_THRESHOLD_DAYS,
      updateIndicator: normalizedIndicator,
      enableAgeBadge,
      enableUpdateIndicator,
      // wipLanes: empty array means show on all cards; non-empty restricts to named lanes only.
      wipLanes: boardConfig && Array.isArray(boardConfig.wipLanes) ? boardConfig.wipLanes : [],
      sle: boardConfig && boardConfig.sle
        ? boardConfig.sle
        : { enabled: true, days: 0, approachingDays: 3, showSummary: true, showBadgeEscalation: true, approachingEmoji: '⚠️', breachedEmoji: '🔴' },
    };
    // --- Utility Functions ---
    function showDebugMessage(msg) {
      const div = document.createElement('div');
      div.textContent = msg;
      Object.assign(div.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        padding: '5px 10px',
        borderRadius: '4px',
        zIndex: '9999',
        fontSize: '14px',
      });
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    }

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    function calculateDaysDiff(dateStr) {
      const d = parseDisplayedDate(dateStr);
      if (!d) return null;
      return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
    }

    // Determines whether the browser locale uses day-first ordering (DD/MM vs MM/DD).
    // ServiceNow respects user locale settings; browser language is the best proxy available.
    function isDayFirstLocale() {
      const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      // Only en-US and a handful of others use month-first; default to day-first for safety.
      return !/^en-us|^en-ca|^en-au/.test(lang) || lang === '';
    }

    // Parses a date string as displayed in a ServiceNow card field, which may be localized
    // (e.g. "15.03.2024" in German, "03/15/2024" in US English, "15/03/2024" in UK).
    // Falls through to parseServiceNowDateTime for ISO/internal format strings.
    function parseDisplayedDate(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const trimmed = dateStr.trim();

      // ISO / ServiceNow internal format first (locale-independent)
      const snParsed = parseServiceNowDateTime(trimmed);
      if (snParsed) return snParsed;

      // DD.MM.YYYY or DD.MM.YYYY HH:MM:SS (German, Austrian, Russian, etc.)
      const dotMatch = trimmed.match(
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
      );
      if (dotMatch) {
        const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = dotMatch;
        const d = new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
        if (!isNaN(d)) return d;
      }

      // DD-MM-YYYY or MM-DD-YYYY with time component (hyphens, locale-detected)
      // Note: YYYY-MM-DD is already handled by parseServiceNowDateTime above.
      const hyphenMatch = trimmed.match(
        /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
      );
      if (hyphenMatch) {
        const [, a, b, yyyy, hh = '0', mi = '0', ss = '0'] = hyphenMatch;
        const [dd, mm] = +a > 12 || isDayFirstLocale() ? [+a, +b] : [+b, +a];
        const d = new Date(+yyyy, mm - 1, dd, +hh, +mi, +ss);
        if (!isNaN(d)) return d;
      }

      // DD/MM/YYYY or MM/DD/YYYY with optional time (locale-detected for ambiguous cases)
      const slashMatch = trimmed.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
      );
      if (slashMatch) {
        const [, a, b, yyyy, hh = '0', mi = '0', ss = '0'] = slashMatch;
        const [dd, mm] = +a > 12 || isDayFirstLocale() ? [+a, +b] : [+b, +a];
        const d = new Date(+yyyy, mm - 1, dd, +hh, +mi, +ss);
        if (!isNaN(d)) return d;
      }

      // "15 Mar 2024" or "March 15, 2024" — let the engine handle these
      const fallback = new Date(trimmed);
      return isNaN(fallback) ? null : fallback;
    }

    function parseServiceNowDateTime(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const trimmed = dateStr.trim();
      const match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
      );
      if (match) {
        const [, year, month, day, hour, minute, second] = match.map((v, idx) =>
          idx === 0 ? v : parseInt(v, 10)
        );
        const parsedDate = new Date(
          year,
          month - 1,
          day,
          hour,
          minute,
          second
        );
        if (!isNaN(parsedDate)) return parsedDate;
      }

      if (/^\d{4}[-T]/.test(trimmed)) {
        const isoCandidate = trimmed.replace(' ', 'T');
        const isoDate = new Date(isoCandidate);
        if (!isNaN(isoDate)) return isoDate;
      }

      const baseMatch = trimmed.match(
        /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
      );
      if (baseMatch) {
        const base = new Date(baseMatch[1].replace(' ', 'T'));
        if (!isNaN(base)) return base;
      }

      // YYYY-MM-DD date-only (no time component)
      const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch.map(Number);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d)) return d;
      }

      return null;
    }

    function removeExistingUpdateIndicator(timeElement) {
      // The indicator lives on the card wrapper (not inside the time element) so
      // that it remains visible regardless of lane-specific CSS applied to the
      // sn-time-ago subtree.
      const card = timeElement.closest('.vtb-card-component-wrapper');
      if (card) {
        card.querySelectorAll(
          '.vtb-enhancer-update-indicator, .vtb-enhancer-update-indicator-text'
        ).forEach((el) => el.remove());
      }
    }

    function getIndicatorEmojis() {
      const indicator = config.updateIndicator || DEFAULT_UPDATE_INDICATOR;
      const freshEmoji =
        indicator && typeof indicator.freshEmoji === 'string' && indicator.freshEmoji
          ? indicator.freshEmoji
          : DEFAULT_UPDATE_INDICATOR.freshEmoji;
      const staleEmoji =
        indicator && typeof indicator.staleEmoji === 'string' && indicator.staleEmoji
          ? indicator.staleEmoji
          : DEFAULT_UPDATE_INDICATOR.staleEmoji;
      return { freshEmoji, staleEmoji };
    }

    function getTimestampString(timeElement) {
      if (!timeElement) return null;

      const ATTRIBUTES = [
        'data-original-title',
        'title',
        'aria-label',
        'datetime',
      ];

      const readFromElement = (el) => {
        for (const attr of ATTRIBUTES) {
          const value = el.getAttribute && el.getAttribute(attr);
          if (value) return value;
        }
        if (el.dataset) {
          if (el.dataset.originalTitle) return el.dataset.originalTitle;
          if (el.dataset.timeAgo) return el.dataset.timeAgo;
          if (el.dataset.timeago) return el.dataset.timeago;
        }
        return null;
      };

      let current = timeElement;
      while (current) {
        const value = readFromElement(current);
        if (value) return value;
        if (current.classList && current.classList.contains('sn-time-ago')) break;
        current = current.parentElement;
      }

      return null;
    }

    function computeUpdateIndicatorState(timeElement) {
      // When WIP lanes are configured, suppress the indicator on non-WIP cards.
      // Cards whose lane cannot be determined (null) are also suppressed — when
      // WIP mode is on we default to "not a WIP lane" rather than showing on all.
      if (config.wipLanes && config.wipLanes.length > 0) {
        const card = timeElement.closest('.vtb-card-component-wrapper');
        if (card) {
          const laneName = findCardLane(card);
          if (!config.wipLanes.includes(laneName)) return null;
        }
      }

      const timestampString = getTimestampString(timeElement);
      const lastUpdated = parseServiceNowDateTime(timestampString);
      if (!lastUpdated) return null;

      let elapsedMs = Date.now() - lastUpdated.getTime();
      if (!Number.isFinite(elapsedMs)) return null;
      if (elapsedMs < 0) elapsedMs = 0;

      const daysSinceUpdate = elapsedMs / MS_PER_DAY;
      const threshold =
        typeof config.updateThresholdDays === 'number'
          ? config.updateThresholdDays
          : DEFAULT_UPDATE_THRESHOLD_DAYS;
      const { freshEmoji, staleEmoji } = getIndicatorEmojis();
      const isStale = daysSinceUpdate > threshold;
      const emoji = isStale ? staleEmoji : freshEmoji;
      const srMessage = isStale
        ? `Card has not been updated within the configured threshold (${staleEmoji}).`
        : `Card updated within the configured threshold (${freshEmoji}).`;

      return {
        emoji,
        srMessage,
        isStale,
        threshold,
      };
    }

    function applyUpdateIndicator(timeElement) {
      const state = computeUpdateIndicatorState(timeElement);

      // Render the indicator directly on the card wrapper, not inside the
      // sn-time-ago subtree. Some lanes (e.g. those that hide their timestamp
      // footer until card hover) apply CSS to sn-time-ago that makes any
      // injected children invisible until the hover state activates. Placing
      // the indicator on the card wrapper — the same host element used by the
      // age badge — ensures it is always visible.
      const card = timeElement.closest('.vtb-card-component-wrapper');

      const existingIndicator = card && card.querySelector('.vtb-enhancer-update-indicator');
      const existingSrText = card && card.querySelector('.vtb-enhancer-update-indicator-text');

      if (!state) {
        if (existingIndicator) existingIndicator.remove();
        if (existingSrText) existingSrText.remove();
        return;
      }

      if (
        existingIndicator &&
        existingIndicator.textContent === state.emoji &&
        existingSrText &&
        existingSrText.textContent === state.srMessage
      ) {
        return;
      }

      if (existingIndicator) existingIndicator.remove();
      if (existingSrText) existingSrText.remove();

      if (!card) return;
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

      const indicatorSpan = document.createElement('span');
      indicatorSpan.className = 'vtb-enhancer-update-indicator';
      indicatorSpan.setAttribute('aria-hidden', 'true');
      indicatorSpan.textContent = state.emoji;
      Object.assign(indicatorSpan.style, {
        position: 'absolute',
        bottom: '2px',
        right: '6px',
        zIndex: '1001',
        fontSize: '13px',
        lineHeight: '1',
        pointerEvents: 'none',
      });

      const srSpan = document.createElement('span');
      srSpan.className = 'vtb-enhancer-update-indicator-text';
      // sr-only inline equivalent so Bootstrap's class isn't required
      srSpan.setAttribute('aria-label', state.srMessage);
      Object.assign(srSpan.style, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: '0',
      });

      card.appendChild(indicatorSpan);
      card.appendChild(srSpan);
    }

    function detachTimeObserver(timeElement) {
      if (
        timeElement &&
        timeElement._vtbEnhancerUpdateObserver &&
        typeof timeElement._vtbEnhancerUpdateObserver.disconnect === 'function'
      ) {
        timeElement._vtbEnhancerUpdateObserver.disconnect();
        delete timeElement._vtbEnhancerUpdateObserver;
      }
    }

    function ensureUpdateIndicator(snTimeAgoElement) {
      if (!snTimeAgoElement) return;

      const applyForTimeElement = (timeElement) => {
        if (!timeElement) return;
        applyUpdateIndicator(timeElement);

        if (timeElement._vtbEnhancerUpdateObserver) return;

        const observer = new MutationObserver(() => {
          if (!timeElement.isConnected) {
            observer.disconnect();
            delete timeElement._vtbEnhancerUpdateObserver;
            return;
          }
          applyUpdateIndicator(timeElement);
        });

        observer.observe(timeElement, {
          childList: true,
          characterData: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-original-title', 'title', 'aria-label', 'datetime'],
        });

        timeElement._vtbEnhancerUpdateObserver = observer;
      };

      const trackTimeElement = () => {
        const timeElement =
          snTimeAgoElement.querySelector('time[data-original-title]') ||
          snTimeAgoElement.querySelector('time[title]') ||
          snTimeAgoElement.querySelector('time');

        if (!timeElement) {
          if (snTimeAgoElement._vtbEnhancerTrackedTime) {
            detachTimeObserver(snTimeAgoElement._vtbEnhancerTrackedTime);
            delete snTimeAgoElement._vtbEnhancerTrackedTime;
          }
          return;
        }

        if (snTimeAgoElement._vtbEnhancerTrackedTime === timeElement) {
          applyUpdateIndicator(timeElement);
          return;
        }

        detachTimeObserver(snTimeAgoElement._vtbEnhancerTrackedTime);
        snTimeAgoElement._vtbEnhancerTrackedTime = timeElement;
        applyForTimeElement(timeElement);
      };

      trackTimeElement();

      if (snTimeAgoElement._vtbEnhancerContainerObserver) return;

      const containerObserver = new MutationObserver((mutations) => {
        if (!snTimeAgoElement.isConnected) {
          detachTimeObserver(snTimeAgoElement._vtbEnhancerTrackedTime);
          containerObserver.disconnect();
          delete snTimeAgoElement._vtbEnhancerTrackedTime;
          delete snTimeAgoElement._vtbEnhancerContainerObserver;
          return;
        }

        let shouldRetrack = false;
        for (const mutation of mutations) {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            shouldRetrack = true;
            break;
          }
        }

        if (shouldRetrack) {
          trackTimeElement();
        }
      });

      containerObserver.observe(snTimeAgoElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-original-title', 'title', 'aria-label'],
      });

      snTimeAgoElement._vtbEnhancerContainerObserver = containerObserver;
    }

    function scanForTimeAgo(root = document) {
      if (!config.enableUpdateIndicator) return;
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll('.vtb-card-component-wrapper sn-time-ago').forEach(ensureUpdateIndicator);
    }

    function annotateLastUpdated(card) {
      if (!config.enableUpdateIndicator) return;
      let timeAgoElement = card.querySelector(
        'sn-time-ago[timestamp="sysUpdatedOn"]'
      );
      if (!timeAgoElement) {
        timeAgoElement = card.querySelector('sn-time-ago');
      }
      if (!timeAgoElement) return;

      ensureUpdateIndicator(timeAgoElement);
    }

    function normalizeDateLabel(text) {
      return text.trim().replace(/\s*:\s*$/, '').toLocaleLowerCase();
    }

    const DATE_LABELS = {
      ACTUAL_START: 'actual start date',
      START: 'start date',
      OPENED: 'opened',
    };

    const DATE_PRIORITY = [
      DATE_LABELS.ACTUAL_START,
      DATE_LABELS.START,
      DATE_LABELS.OPENED,
    ];

    // Return the card's starting point for calculating age.
    // Both "Actual start date" and "Start date" mark when work begins, so treat them as
    // interchangeable with "Actual start date" preferred when both exist. If neither
    // start date is provided, fall back to "Opened" as a backup that represents when
    // the record was created.
    function findStartDate(card) {
      const liList = card.querySelectorAll('li.ng-scope');
      const detectedDates = {};

      for (const li of liList) {
        const spans = li.querySelectorAll(
          'span.sn-widget-list-table-cell.ng-binding'
        );
        if (spans.length < 2) continue;

        const valueSpan = spans[1];
        // Prefer raw ISO value from data attributes when available — avoids locale-format issues.
        const value =
          valueSpan.getAttribute('data-value') ||
          valueSpan.getAttribute('data-raw-value') ||
          valueSpan.textContent.trim();
        if (!value) continue;

        const normalizedLabel = normalizeDateLabel(spans[0].textContent);
        if (DATE_PRIORITY.includes(normalizedLabel) && !detectedDates[normalizedLabel]) {
          detectedDates[normalizedLabel] = value;
        }
      }

      for (const label of DATE_PRIORITY) {
        if (detectedDates[label]) {
          return detectedDates[label];
        }
      }

      return null;
    }

    function findState(card) {
      const liList = card.querySelectorAll('li.ng-scope');
      for (const li of liList) {
        const spans = li.querySelectorAll(
          'span.sn-widget-list-table-cell.ng-binding'
        );
        if (spans.length >= 2 && spans[0].textContent.trim() === 'State') {
          return spans[1].textContent.trim();
        }
      }
      return null;
    }

    function getBadgeColor(age) {
      for (const band of config.ageBands) {
        if (age < band.maxDays) return band.color;
      }
      return '#000000';
    }

    // Returns black or white depending on background brightness.
    function getContrastColor(hexColor) {
      try {
        if (hexColor[0] === '#') hexColor = hexColor.substring(1);
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#ffffff';
      } catch (e) {
        return '#000000';
      }
    }

    // Applies an SLE escalation outline and emoji prefix to a badge based on age vs SLE target.
    function applySleEscalationToBadge(badge, age, sle) {
      if (!sle || sle.enabled === false || sle.days <= 0 || !sle.showBadgeEscalation) return;
      const approachingEmoji = sle.approachingEmoji || '⚠️';
      const breachedEmoji = sle.breachedEmoji || '🔴';
      if (age >= sle.days) {
        badge.textContent = `${breachedEmoji} ${badge.textContent}`;
        badge.style.outline = '2px solid #c0392b';
        badge.style.outlineOffset = '2px';
      } else if (sle.approachingDays > 0 && age >= sle.days - sle.approachingDays) {
        badge.textContent = `${approachingEmoji} ${badge.textContent}`;
        badge.style.outline = '2px dashed #e67e22';
        badge.style.outlineOffset = '2px';
      }
    }

    // Reads ages stored on cards and updates (or removes) the SLE summary bar near the board title.
    function renderSleSummaryBar() {
      const existing = document.getElementById('vtb-enhancer-sle-bar');
      const sle = config.sle;
      if (!sle || sle.enabled === false || sle.days <= 0 || !sle.showSummary) {
        if (existing) existing.remove();
        return;
      }

      let over = 0, approaching = 0;
      document.querySelectorAll('.vtb-card-component-wrapper').forEach((card) => {
        const ageStr = card.getAttribute('data-task-age-days');
        if (ageStr === null) return;
        const age = parseInt(ageStr, 10);
        if (isNaN(age) || age < 0) return;
        if (age >= sle.days) over++;
        else if (sle.approachingDays > 0 && age >= sle.days - sle.approachingDays) approaching++;
      });

      const bar = existing || document.createElement('div');
      bar.id = 'vtb-enhancer-sle-bar';
      Object.assign(bar.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '3px 10px',
        backgroundColor: over > 0 ? '#fdecea' : '#fff8e1',
        border: `1px solid ${over > 0 ? '#c0392b' : '#f39c12'}`,
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        marginLeft: '12px',
        verticalAlign: 'middle',
        lineHeight: '1.4',
      });
      bar.innerHTML =
        `<span>SLE: ${sle.days}d</span>` +
        `<span style="color:#c0392b;">▲ ${over} over</span>` +
        `<span style="color:#e67e22;">⚠ ${approaching} approaching</span>`;

      if (!existing) {
        const label = document.querySelector('label.sn-navhub-title');
        if (label && label.parentNode) {
          label.parentNode.insertBefore(bar, label.nextSibling);
        }
      }
    }

    function createBadge(text, bgColor) {
      const badge = document.createElement('div');
      badge.textContent = text;
      const textColor = getContrastColor(bgColor);
      Object.assign(badge.style, {
        backgroundColor: bgColor,
        color: textColor,
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        position: 'absolute',
        bottom: '0px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '1000',
      });
      return badge;
    }

    let updatedCount = 0;

    const completionPatterns = [
      /\bresolved\b/,
      /\bclosed\b/,
      /\bcancel(?:ed|led)\b/,
      /^complete/,
      /\bdiscarded\b/,
      /\bdone\b/,
      /\bfulfilled\b/,
      /\bfinished\b/,
      /\bfinali[sz]ed\b/,
      /\baccomplished\b/,
    ];

    function isCompletionState(text) {
      const normalizedText = text.trim().toLowerCase();
      return completionPatterns.some((pattern) => pattern.test(normalizedText));
    }

    function processCard(card) {
      if (card.hasAttribute('data-task-age-enhanced')) return;
      try {
        annotateLastUpdated(card);
        const state = findState(card);
        if (state && isCompletionState(state)) {
          if (config.enableAgeBadge) {
            const badge = createBadge('Done', '#28a745');
            if (getComputedStyle(card).position === 'static') {
              card.style.position = 'relative';
            }
            card.appendChild(badge);
            card.setAttribute('data-task-age-enhanced', 'true');
            updatedCount++;
          }
          return;
        }
        const startDate = findStartDate(card);
        if (!startDate) return;
        const age = calculateDaysDiff(startDate);
        if (age === null) return;
        card.setAttribute('data-task-age-days', age); // Always set for SLE tracking (renderSleSummaryBar skips negative ages)
        if (!config.enableAgeBadge) return;
        if (age < 0) {
          // Work hasn't started yet — show how many days until the start date.
          const badge = createBadge(`Starts in ${Math.abs(age)}d`, '#95a5a6');
          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
          card.appendChild(badge);
          card.setAttribute('data-task-age-enhanced', 'true');
          updatedCount++;
          return;
        }
        const badgeColor = getBadgeColor(age);
        const badge = createBadge(`${age}d`, badgeColor);
        applySleEscalationToBadge(badge, age, config.sle);
        if (getComputedStyle(card).position === 'static') {
          card.style.position = 'relative';
        }
        card.appendChild(badge);
        card.setAttribute('data-task-age-enhanced', 'true');
        updatedCount++;
      } catch (err) {
        console.error('Work Item Age Error:', err);
      }
    }

    function processExistingCards() {
      if (!config.enableAgeBadge && !config.enableUpdateIndicator) return;
      const cards = document.querySelectorAll('.vtb-card-component-wrapper');
      cards.forEach((card) => processCard(card));
      if (config.enableUpdateIndicator) {
        scanForTimeAgo();
      }
    }

    function observeCards() {
      if (!config.enableAgeBadge && !config.enableUpdateIndicator) return;
      let sleBarTimer = null;
      const debouncedSleUpdate = () => {
        if (sleBarTimer) clearTimeout(sleBarTimer);
        sleBarTimer = setTimeout(renderSleSummaryBar, 500);
      };
      const observer = new MutationObserver((mutations) => {
        let cardChanged = false;
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (config.enableUpdateIndicator && node.matches && node.matches('sn-time-ago')) {
                if (node.closest('.vtb-card-component-wrapper')) {
                  ensureUpdateIndicator(node);
                }
              }
              if (config.enableUpdateIndicator) {
                node.querySelectorAll?.('sn-time-ago').forEach((el) => {
                  if (el.closest('.vtb-card-component-wrapper')) {
                    ensureUpdateIndicator(el);
                  }
                });
              }
              if (node.classList.contains('vtb-card-component-wrapper')) {
                processCard(node);
                cardChanged = true;
              }
              node
                .querySelectorAll?.('.vtb-card-component-wrapper')
                .forEach((card) => { processCard(card); cardChanged = true; });
            }
          });
        });
        if (cardChanged && config.sle && config.sle.enabled !== false && config.sle.days > 0) debouncedSleUpdate();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Wait until the board appears to be fully loaded (using a 1-second debounce)
    function waitForBoardLoad(callback) {
      let timer = null;
      const observer = new MutationObserver(() => {
        const cards = document.querySelectorAll('.vtb-card-component-wrapper');
        if (cards.length > 0) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            callback();
          }, 1000);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const initialCards = document.querySelectorAll(
        '.vtb-card-component-wrapper'
      );
      if (initialCards.length > 0) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          callback();
        }, 1000);
      }
    }

    function init() {
      waitForBoardLoad(() => {
        updateBoardInfo(fullConfig);
        if (!config.enableAgeBadge && !config.enableUpdateIndicator) {
          showDebugMessage('VTB Enhancer disabled for this board (all toggles off)');
          return;
        }
        processExistingCards();
        renderSleSummaryBar();
        const ageMessage = config.enableAgeBadge
          ? `Updated ${updatedCount} cards with Work Item Age`
          : 'Work Item Age badge disabled';
        const indicatorMessage = config.enableUpdateIndicator
          ? 'Freshness indicator on'
          : 'Freshness indicator off';
        showDebugMessage(`${ageMessage}; ${indicatorMessage}`);
        observeCards();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });
})();
