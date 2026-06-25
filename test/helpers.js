import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const EXTENSION_PATH = path.resolve(fileURLToPath(import.meta.url), '../..');
const USER_DATA_DIR  = path.resolve(fileURLToPath(import.meta.url), '../../test-local/.edge-profile');

// The board URL lives in test-local/config.json — gitignored, never committed.
// Copy test/config.example.json to test-local/config.json and fill in your board URL.
const CONFIG_PATH = path.resolve(fileURLToPath(import.meta.url), '../../test-local/config.json');
let testConfig;
try {
  testConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch {
  throw new Error(
    'test-local/config.json not found.\n' +
    'Copy test/config.example.json to test-local/config.json and fill in your board URL.\n' +
    `Expected: ${CONFIG_PATH}`
  );
}

// Exported so explore.js and any test can reference the same board target.
export const BOARD_URL = testConfig.testingBoardUrl;

export async function launchEdge() {
  return chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'msedge',
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
    viewport: null,
  });
}

export async function getExtensionId(context) {
  const page = await context.newPage();
  await page.goto('edge://extensions/');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(2000);

  // Attempt 1: chrome.management API (available on edge://extensions/ page itself).
  const idViaManagement = await page.evaluate(() => new Promise(resolve => {
    try {
      if (typeof chrome !== 'undefined' && chrome.management) {
        chrome.management.getAll(exts => {
          const match = exts.find(e => e.name && e.name.includes('ServiceNow Visual Task Board'));
          resolve(match?.id ?? null);
        });
      } else {
        resolve(null);
      }
    } catch { resolve(null); }
  })).catch(() => null);

  if (idViaManagement) { await page.close(); return idViaManagement; }

  // Attempt 2: recursive shadow DOM search (handles Edge's nested extensions-item-list).
  const idViaDom = await page.evaluate(() => {
    function findAll(root, sel) {
      const found = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*'))
        if (el.shadowRoot) found.push(...findAll(el.shadowRoot, sel));
      return found;
    }
    for (const item of findAll(document, 'extensions-item')) {
      const name = item.shadowRoot?.querySelector('#name')?.textContent ?? '';
      if (name.includes('ServiceNow Visual Task Board')) return item.getAttribute('id');
    }
    return null;
  }).catch(() => null);

  if (idViaDom) { await page.close(); return idViaDom; }

  // Both failed — save debug artifacts so we can see what Edge actually rendered.
  const OUTPUT_DIR = path.resolve('test-local/output');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'extensions-debug.png'), fullPage: true });
  const debugInfo = await page.evaluate(() => ({
    url:         location.href,
    bodyText:    document.body?.innerText?.slice(0, 2000) ?? '',
    topElements: [...document.querySelectorAll('*')].slice(0, 30).map(el => el.tagName),
  })).catch(() => ({}));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'extensions-debug.json'), JSON.stringify(debugInfo, null, 2));

  await page.close();
  throw new Error(
    'Extension not found in edge://extensions/.\n' +
    'Debug screenshot → test-local/output/extensions-debug.png\n' +
    'Debug info      → test-local/output/extensions-debug.json\n' +
    'Share both files to diagnose. Also check that the extension loads in a normal Edge window at edge://extensions/.'
  );
}

export async function setConfig(context, extensionId, cfg) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForFunction(() => typeof VTBShared !== 'undefined');
  await page.evaluate(
    config => new Promise(resolve => {
      VTBShared.saveConfig(config, resolve);
      setTimeout(resolve, 2000);
    }),
    cfg
  );
  await page.close();
}

// Sends the same VTB_POPUP_QUERY the toolbar popup uses and returns the
// content script's response (board health totals). Runs from an extension
// page so chrome.tabs is available. The extension has no "tabs" permission,
// so tab URLs are unreadable — instead we message every tab and take the one
// frame that answers (only the inner board frame, which has a boardId, does).
export async function queryPopup(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const response = await page.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      const resp = await new Promise(resolve => {
        chrome.tabs.sendMessage(t.id, { type: 'VTB_POPUP_QUERY' }, r => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(r);
        });
      });
      if (resp && typeof resp.freshCount === 'number') return resp;
    }
    return null;
  });
  await page.close();
  return response;
}

// Navigate directly to a known board URL. If the session has expired and auth
// is required, waits up to 5 minutes for the user to log in before continuing.
export async function navigateToBoard(context, url) {
  const page = await context.newPage();
  const isOnServiceNow = u => { try { return new URL(u).hostname.endsWith('.service-now.com'); } catch { return false; } };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);

  if (!isOnServiceNow(page.url())) {
    console.log('  Session expired — please log in. Waiting up to 5 minutes...');
    await page.waitForFunction(
      () => window.location.hostname.endsWith('.service-now.com'),
      { timeout: 5 * 60 * 1000 }
    );
  }

  console.log(`  Board page loaded: ${page.url()}`);
  return page;
}

export function defaultConfig() {
  return {
    defaultConfig: {
      enableAgeBadge: true,
      enableUpdateIndicator: true,
      enableAgeBadgePrefix: false,
      ageBadgePrefix: '',
      ageBands: [
        { maxDays: 7,    color: '#f9e79f' },
        { maxDays: 30,   color: '#f0ad4e' },
        { maxDays: 90,   color: '#e67e22' },
        { maxDays: 9999, color: '#d9534f' },
      ],
      updateThresholdDays: 6,
      updateIndicator: { freshEmoji: '✅', staleEmoji: '❌' },
    },
    boards: {},
  };
}

export async function waitForVtbPage(context) {
  return navigateToBoard(context, BOARD_URL);
}

// The content script runs in the inner $vtb.do or $agile_board.do iframe, not the
// outer Now nav shell. The outer shell URL encodes the board path as a query param —
// we skip that and look only at child frames whose URL directly serves the board as a path.
export async function getVtbFrame(page, timeout = 30_000) {
  const isInnerVtb = url => /\/\$?(vtb|agile_board)\.do(\?|&|$)/.test(url);
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const mainFrame = page.mainFrame();
    const inner = page.frames().find(f => f !== mainFrame && isInnerVtb(f.url()));
    if (inner) {
      console.log(`  [getVtbFrame] inner frame: ${inner.url()}`);
      return inner;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('  [getVtbFrame] Warning: inner vtb.do frame not found after timeout — falling back to main frame');
  return page.mainFrame();
}

// For assertion tests: waits until the extension has enhanced at least one card.
export async function waitForBoardEnhanced(page, timeout = 60_000) {
  const frame = await getVtbFrame(page);
  console.log(`  [waitForBoardEnhanced] frame URL: ${frame.url()}`);
  await frame.waitForFunction(
    () => document.querySelectorAll('[data-task-age-enhanced="true"]').length > 0,
    { timeout }
  );
  return frame;
}

// For explore mode: waits for the board to load, then gives the extension time to run.
// Does NOT require any cards to be enhanced — captures state as-is.
export async function waitForBoardLoaded(page, timeout = 60_000) {
  const frame = await getVtbFrame(page, timeout);
  console.log(`  [waitForBoardLoaded] frame URL: ${frame.url()}`);

  const found = await frame.waitForFunction(
    () => document.querySelectorAll('.vtb-card-component-wrapper').length > 0,
    { timeout }
  ).then(() => true).catch(() => false);

  if (!found) {
    console.log('  [waitForBoardLoaded] No .vtb-card-component-wrapper found — probing DOM for card/lane class names...');
    const domProbe = await frame.evaluate(() => {
      const allClasses = new Set();
      document.querySelectorAll('*').forEach(el => el.classList.forEach(c => allClasses.add(c)));
      const cardLike = [...allClasses].filter(c => /card|task|story|issue|item|ticket|work.?item/i.test(c)).sort();
      const laneLike = [...allClasses].filter(c => /lane|column|swim|sprint|board/i.test(c)).sort();
      return { cardLike, laneLike, totalClasses: allClasses.size };
    });
    console.log(`  DOM class probe (${domProbe.totalClasses} total classes):`);
    console.log(`    Card-like: ${domProbe.cardLike.join(', ') || '(none)'}`);
    console.log(`    Lane-like: ${domProbe.laneLike.join(', ') || '(none)'}`);
  } else {
    const count = await frame.evaluate(
      () => document.querySelectorAll('.vtb-card-component-wrapper').length
    );
    console.log(`  [waitForBoardLoaded] Board loaded: ${count} card wrappers found`);
  }

  // Give the extension time to process cards before we capture
  await page.waitForTimeout(5000);
  return frame;
}

// Browsers normalize hex colors to rgb() in style properties.
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
