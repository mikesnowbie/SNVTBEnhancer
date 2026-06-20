import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const EXTENSION_PATH = path.resolve(fileURLToPath(import.meta.url), '../..');
const USER_DATA_DIR  = path.resolve(fileURLToPath(import.meta.url), '../.edge-profile');

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
  await page.goto('chrome://extensions/');
  const id = await page.evaluate(() => {
    const mgr = document.querySelector('extensions-manager');
    if (!mgr) return null;
    for (const item of mgr.shadowRoot.querySelectorAll('extensions-item')) {
      const name = item.shadowRoot.querySelector('#name')?.textContent ?? '';
      if (name.includes('ServiceNow Visual Task Board')) return item.getAttribute('id');
    }
    return null;
  });
  await page.close();
  if (!id) throw new Error('Extension not found — load it as an unpacked extension in edge://extensions/ first');
  return id;
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
  console.log('\n=== ACTION REQUIRED ===');
  console.log('1. Log in to your ServiceNow dev instance in the Edge window that just opened');
  console.log('2. Navigate to a Visual Task Board (URL must contain vtb.do)');
  console.log('3. Wait until badges appear on the cards');
  console.log('4. Press Enter here — or the harness will auto-detect after 3 seconds\n');

  const isVtb = url => /service-now\.com.*vtb\.do/.test(url);

  return new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error('Timed out (10 min) waiting for authentication')),
      10 * 60 * 1000
    );

    const poll = setInterval(async () => {
      const vtbPage = context.pages().find(p => isVtb(p.url()));
      if (!vtbPage) return;
      clearInterval(poll);
      setTimeout(() => {
        const still = context.pages().find(p => isVtb(p.url()));
        if (still) { clearTimeout(deadline); resolve(still); }
      }, 3000);
    }, 1500);

    process.stdin.resume();
    process.stdin.once('data', () => {
      clearInterval(poll);
      clearTimeout(deadline);
      const vtbPage = context.pages().find(p => isVtb(p.url()));
      if (vtbPage) resolve(vtbPage);
      else reject(new Error('No vtb.do page found — navigate to a board first'));
    });
  });
}

// The content script runs in the inner $vtb.do iframe, not the outer nav shell.
// All DOM assertions must target this frame.
export async function getVtbFrame(page) {
  const frames = page.frames();
  return frames.find(f => f.url().includes('vtb.do')) || page.mainFrame();
}

export async function waitForBoardEnhanced(page, timeout = 30_000) {
  const frame = await getVtbFrame(page);
  await frame.waitForFunction(
    () => document.querySelectorAll('[data-task-age-enhanced="true"]').length > 0,
    { timeout }
  );
  return frame;
}

// Browsers normalize hex colors to rgb() in style properties.
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
