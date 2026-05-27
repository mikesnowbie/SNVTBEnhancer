/*
  ServiceNow Visual Task Board Enhancer - Work Item Age
  Version 0.10.0
  - Waits until the board has fully loaded all cards (using a MutationObserver with a debounce)
    before processing any cards or displaying a status message.
  - Processes each card to calculate and display an "Age" badge. It prefers the card’s "Actual start date", which teams can manage independently of when the record was opened, and treats "Start date" as the same starting point before finally falling back to "Opened" when no start date exists.
  - Badge background color is determined by configurable age bands loaded from chrome.storage.sync.
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
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      chrome.storage.sync.get(
        { vtbEnhancerConfig: defaultStorage },
        function (data) {
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

            // Normalize SLE config
            if (!boardCfg.sle || typeof boardCfg.sle !== 'object') {
              boardCfg.sle = { days: 0, approachingDays: 3, showSummary: true, showBadgeEscalation: true };
            } else {
              if (typeof boardCfg.sle.days !== 'number' || boardCfg.sle.days < 0) boardCfg.sle.days = 0;
              if (typeof boardCfg.sle.approachingDays !== 'number' || boardCfg.sle.approachingDays < 0) boardCfg.sle.approachingDays = 3;
              if (typeof boardCfg.sle.showSummary !== 'boolean') boardCfg.sle.showSummary = true;
              if (typeof boardCfg.sle.showBadgeEscalation !== 'boolean') boardCfg.sle.showBadgeEscalation = true;
            }
          });
          callback(cfg);
        }
      );
    } else {
      callback(defaultStorage);
    }
  }

  function saveConfig(cfg, callback) {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      chrome.storage.sync.set({ vtbEnhancerConfig: cfg }, () => {
        if (callback) callback();
      });
    } else {
      localStorage.setItem('vtbEnhancerConfig', JSON.stringify(cfg));
      if (callback) callback();
    }
  }

  function updateBoardInfo(cfg) {
    if (!boardId) return;
    // Prevent prototype pollution
    if (boardId === '__proto__' || boardId === 'constructor' || boardId === 'prototype') return;
    const label = document.querySelector('label.sn-navhub-title');
    if (!label) return;
    const name = label.textContent.trim();
    if (!cfg.boards[boardId]) {
      cfg.boards[boardId] = { name: name };
      saveConfig(cfg);
    } else if (cfg.boards[boardId].name !== name) {
      cfg.boards[boardId].name = name;
      saveConfig(cfg);
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
      sle: boardConfig && boardConfig.sle
        ? boardConfig.sle
        : { days: 0, approachingDays: 3, showSummary: true, showBadgeEscalation: true },
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
      const d = new Date(dateStr);
      if (isNaN(d)) return null;
      return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
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

      const isoCandidate = trimmed.replace(' ', 'T');
      const isoDate = new Date(isoCandidate);
      if (!isNaN(isoDate)) return isoDate;

      const baseMatch = trimmed.match(
        /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
      );
      if (baseMatch) {
        const base = new Date(baseMatch[1].replace(' ', 'T'));
        if (!isNaN(base)) return base;
      }

      const fallback = new Date(trimmed);
      return isNaN(fallback) ? null : fallback;
    }

    function removeExistingUpdateIndicator(timeElement) {
      const existingIndicator = timeElement.querySelector(
        '.vtb-enhancer-update-indicator'
      );
      if (existingIndicator) existingIndicator.remove();

      const existingSrText = timeElement.querySelector(
        '.vtb-enhancer-update-indicator-text'
      );
      if (existingSrText) existingSrText.remove();
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
      const existingIndicator = timeElement.querySelector(
        '.vtb-enhancer-update-indicator'
      );
      const existingSrText = timeElement.querySelector(
        '.vtb-enhancer-update-indicator-text'
      );

      if (!state) {
        if (existingIndicator || existingSrText) {
          removeExistingUpdateIndicator(timeElement);
        }
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

      removeExistingUpdateIndicator(timeElement);

      const indicatorSpan = document.createElement('span');
      indicatorSpan.className = 'vtb-enhancer-update-indicator';
      indicatorSpan.setAttribute('aria-hidden', 'true');
      indicatorSpan.style.marginLeft = '4px';
      indicatorSpan.textContent = state.emoji;

      const srSpan = document.createElement('span');
      srSpan.className = 'sr-only vtb-enhancer-update-indicator-text';
      srSpan.textContent = state.srMessage;

      const visibleSpan = Array.from(timeElement.children).find(
        (child) =>
          child.nodeType === Node.ELEMENT_NODE &&
          child.tagName === 'SPAN' &&
          !child.classList.contains('sr-only') &&
          !child.classList.contains('vtb-enhancer-update-indicator') &&
          !child.classList.contains('vtb-enhancer-update-indicator-text')
      );

      const srOnlyReference = Array.from(timeElement.children).find(
        (child) =>
          child.classList &&
          child.classList.contains('sr-only') &&
          !child.classList.contains('vtb-enhancer-update-indicator-text')
      );

      if (visibleSpan && typeof visibleSpan.after === 'function') {
        visibleSpan.after(indicatorSpan);
      } else if (srOnlyReference && srOnlyReference.parentNode) {
        srOnlyReference.parentNode.insertBefore(
          indicatorSpan,
          srOnlyReference
        );
      } else {
        timeElement.appendChild(indicatorSpan);
      }

      if (srOnlyReference && srOnlyReference.parentNode) {
        srOnlyReference.parentNode.insertBefore(srSpan, srOnlyReference);
      } else {
        indicatorSpan.after(srSpan);
      }
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

        const value = spans[1].textContent.trim();
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

    // Applies an SLE escalation outline to a badge element based on how close age is to the SLE.
    function applySleEscalationToBadge(badge, age, sle) {
      if (!sle || sle.days <= 0 || !sle.showBadgeEscalation) return;
      if (age >= sle.days) {
        badge.style.outline = '2px solid #c0392b';
        badge.style.outlineOffset = '2px';
      } else if (sle.approachingDays > 0 && age >= sle.days - sle.approachingDays) {
        badge.style.outline = '2px dashed #e67e22';
        badge.style.outlineOffset = '2px';
      }
    }

    // Reads ages stored on cards and updates (or removes) the SLE summary bar near the board title.
    function renderSleSummaryBar() {
      const existing = document.getElementById('vtb-enhancer-sle-bar');
      const sle = config.sle;
      if (!sle || sle.days <= 0 || !sle.showSummary) {
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
        `<span style="color:#c0392b;">▲ ${over} over</span>` +
        `<span style="color:#e67e22;">⚠ ${approaching} approaching</span>`;

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
        if (!config.enableAgeBadge) return;
        const state = findState(card);
        if (state) {
          if (isCompletionState(state)) {
            const badge = createBadge('Done', '#28a745');
            if (getComputedStyle(card).position === 'static') {
              card.style.position = 'relative';
            }
            card.appendChild(badge);
            card.setAttribute('data-task-age-enhanced', 'true');
            updatedCount++;
            return;
          }
        }
        const startDate = findStartDate(card);
        if (!startDate) return;
        const age = calculateDaysDiff(startDate);
        if (age === null) return;
        const badgeColor = getBadgeColor(age);
        const badge = createBadge(
          `Age: ${age} day${age !== 1 ? 's' : ''}`,
          badgeColor
        );
        applySleEscalationToBadge(badge, age, config.sle);
        if (getComputedStyle(card).position === 'static') {
          card.style.position = 'relative';
        }
        card.appendChild(badge);
        card.setAttribute('data-task-age-enhanced', 'true');
        card.setAttribute('data-task-age-days', age);
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
        if (cardChanged && config.sle && config.sle.days > 0) debouncedSleUpdate();
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
