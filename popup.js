(function () {
  const STORE_URL = 'https://microsoftedge.microsoft.com/addons/detail/servicenow-visual-task-bo/jmhhlihdkbdeemfdmehanpkbfkkahpdd';
  const AREA_IDS = ['wipArea', 'ageArea', 'freshnessArea', 'sleArea'];

  let currentTab = null;
  let currentBoardId = null;
  let fullConfig = null;

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeCssColor(color) {
    return /^#[0-9a-fA-F]{3,6}$/.test(String(color)) ? color : '#808080';
  }

  function getBoardIdFromUrl(url) {
    if (!url || !url.includes('vtb.do')) return null;
    // ServiceNow's navigation shell URL-encodes the inner URL, so sysparm_board=
    // may appear as sysparm_board%3D. Decode before parsing.
    let decoded = url;
    try { decoded = decodeURIComponent(url); } catch (_) {}
    const m = decoded.match(/sysparm_board=([^&]+)/);
    return m ? m[1] : null;
  }

  function openOptions(boardId) {
    const base = chrome.runtime.getURL('options.html');
    const url = boardId ? base + '?board=' + encodeURIComponent(boardId) : base;
    chrome.tabs.create({ url });
  }

  // bandRangeLabel labels match the strict `age < maxDays` bucketing used in
  // getBadgeColor and the message handler: first band is "< Nd", middle bands
  // are "${prev}–${curr-1}d", last band is "≥ ${prev}d".
  function bandRangeLabel(index, bands) {
    const prev = index > 0 ? bands[index - 1].maxDays : 0;
    const curr = bands[index].maxDays;
    if (curr >= 9999) return `≥ ${prev}d`;
    if (prev === 0) return `< ${curr}d`;
    return `${prev}–${curr - 1}d`;
  }

  function renderWipArea(data) {
    const el = document.getElementById('wipArea');
    el.className = '';
    const label = data.wipAllLanes ? 'All lanes' : 'in configured WIP lanes';
    let html =
      `<div class="wip-row">` +
      `<span class="wip-number">${data.wipTotal}</span>` +
      `<span class="wip-label">${label}</span>` +
      `</div>`;
    if (!data.wipAllLanes && data.wipLanes && data.wipLanes.length > 0) {
      html += `<div class="wip-lanes">${data.wipLanes.map(escHtml).join(' · ')}</div>`;
    }
    el.innerHTML = html;
  }

  function renderAgeArea(data) {
    const el = document.getElementById('ageArea');
    const bands = data.ageBandCounts;
    let rows = '';
    bands.forEach(function (band, i) {
      const zeroClass = band.count === 0 ? ' band-count-zero' : '';
      rows +=
        `<tr>` +
        `<td><span class="band-swatch" style="background:${safeCssColor(band.color)}"></span></td>` +
        `<td class="band-range">${bandRangeLabel(i, bands)}</td>` +
        `<td class="band-count${zeroClass}">${band.count}</td>` +
        `</tr>`;
    });
    if (data.notStartedCount > 0) {
      rows +=
        `<tr>` +
        `<td><span class="band-swatch" style="background:#95a5a6"></span></td>` +
        `<td class="band-range">Not yet started</td>` +
        `<td class="band-count">${data.notStartedCount}</td>` +
        `</tr>`;
    }
    if (data.doneCount > 0) {
      rows +=
        `<tr>` +
        `<td><span class="band-swatch" style="background:#28a745"></span></td>` +
        `<td class="band-range">Done / Resolved</td>` +
        `<td class="band-count band-count-zero">${data.doneCount}</td>` +
        `</tr>`;
    }
    el.className = '';
    el.innerHTML = `<table class="band-table"><tbody>${rows}</tbody></table>`;
  }

  function renderFreshnessArea(data) {
    const el = document.getElementById('freshnessArea');
    el.className = '';
    el.innerHTML =
      `<div class="stat-row">` +
      `<span>${escHtml(data.freshEmoji)} Fresh</span><strong>${data.freshCount}</strong>` +
      `</div>` +
      `<div class="stat-row">` +
      `<span>${escHtml(data.staleEmoji)} Stale</span><strong>${data.staleCount}</strong>` +
      `</div>` +
      `<div class="stat-hint">Stale after ${data.updateThresholdDays} days without update</div>`;
  }

  function renderSleArea(data) {
    const el = document.getElementById('sleArea');
    el.className = '';
    if (!data.sleEnabled) {
      el.innerHTML =
        `<div class="sle-disabled">SLE not configured. ` +
        `<button id="sleSettingsLink">Open settings</button> to enable.</div>`;
      document.getElementById('sleSettingsLink').addEventListener('click', function () {
        openOptions(currentBoardId);
      });
      return;
    }
    el.innerHTML =
      `<div class="stat-row">` +
      `<span>SLE Target</span><strong>${data.sleDays}d</strong>` +
      `</div>` +
      `<div class="stat-row">` +
      `<span>${escHtml(data.approachingEmoji)} Approaching</span><strong>${data.sleApproaching}</strong>` +
      `</div>` +
      `<div class="stat-row">` +
      `<span>${escHtml(data.breachedEmoji)} Breached</span><strong>${data.sleBreached}</strong>` +
      `</div>`;
  }

  function renderDashboard(data) {
    renderWipArea(data);
    renderAgeArea(data);
    renderFreshnessArea(data);
    renderSleArea(data);
    document.getElementById('exportSection').style.display = '';
  }

  function setAreasError(msg) {
    AREA_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      el.className = 'error-msg';
      el.textContent = msg;
    });
  }

  function setAreasLoading() {
    AREA_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      el.className = 'state-msg';
      el.textContent = 'Loading…';
    });
    document.getElementById('exportSection').style.display = 'none';
  }

  function queryContentScript() {
    if (!currentTab) return;
    setAreasLoading();
    VTBShared.loadConfig(function (cfg) {
      fullConfig = cfg;
      const board = cfg.boards[currentBoardId];
      if (board && board.name) {
        document.getElementById('boardNameDisplay').textContent = board.name;
      }
      chrome.tabs.sendMessage(currentTab.id, { type: 'VTB_POPUP_QUERY' }, function (response) {
        if (chrome.runtime.lastError || !response) {
          setAreasError('Board data unavailable. Make sure you are on the VTB page and the board has finished loading.');
          return;
        }
        renderDashboard(response);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('copyLinkBtn').addEventListener('click', function () {
      navigator.clipboard.writeText(STORE_URL).then(function () {
        document.getElementById('copyLinkBtn').style.display = 'none';
        const msg = document.getElementById('copiedMsg');
        msg.style.display = '';
        setTimeout(function () {
          document.getElementById('copyLinkBtn').style.display = '';
          msg.style.display = 'none';
        }, 2000);
      });
    });

    document.getElementById('refreshBtn').addEventListener('click', queryContentScript);

    document.getElementById('defaultSettingsBtn').addEventListener('click', function () {
      openOptions(null);
    });

    document.getElementById('thisBoardSettingsBtn').addEventListener('click', function () {
      if (currentBoardId) openOptions(currentBoardId);
    });

    document.getElementById('exportBtn').addEventListener('click', function () {
      if (fullConfig && currentBoardId) {
        VTBShared.exportBoardConfig(fullConfig, currentBoardId);
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      currentTab = tabs[0] || null;
      const url = currentTab ? currentTab.url : null;
      currentBoardId = getBoardIdFromUrl(url);
      const isVtbPage = !!currentBoardId;

      if (!isVtbPage) {
        document.getElementById('nonVtbNotice').style.display = '';
        document.getElementById('boardNameDisplay').textContent = 'Not on a VTB page';
        return;
      }

      document.getElementById('thisBoardSettingsBtn').disabled = false;
      document.getElementById('refreshBtn').style.display = '';
      document.getElementById('dashboardArea').style.display = '';
      queryContentScript();
    });
  });
})();
