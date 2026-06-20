// Verifies the SLE summary bar: #vtb-enhancer-sle-bar appears when SLE is
// configured for the current board and is absent when SLE is disabled.

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, extensionId, vtbPage, frame, boardId;

test.beforeAll(async () => {
  context     = await helpers.launchEdge();
  extensionId = await helpers.getExtensionId(context);
  vtbPage     = await helpers.waitForVtbPage(context);
  frame       = await helpers.waitForBoardEnhanced(vtbPage);

  // Capture the board ID from the inner frame URL so we can write board-specific config
  boardId = await frame.evaluate(() => {
    const m = window.location.search.match(/[?&]sysparm_board=([^&]+)/);
    return m ? m[1] : null;
  });
  expect(boardId).toBeTruthy();
});

test.afterAll(async () => { await context.close(); });

test('summary bar appears when SLE is enabled for this board', async () => {
  const cfg = helpers.defaultConfig();
  cfg.boards[boardId] = {
    sle: {
      enabled:         true,
      days:            30,
      approachingDays: 5,
      showSummary:     true,
      showBadgeEmojis: true,
      showBadgeBorder: true,
      approachingEmoji: '⚠️',
      breachedEmoji:    '🔴',
    },
  };

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  // Summary bar is rendered by the outer nav-shell frame using the board title selector,
  // so query from vtbPage (the shell page), not the inner frame.
  await vtbPage.waitForSelector('#vtb-enhancer-sle-bar', { timeout: 15_000 });
  const barText = await vtbPage.$eval('#vtb-enhancer-sle-bar', el => el.textContent?.trim());

  expect(barText).toBeTruthy();
  expect(barText).toMatch(/SLE/);
});

test('summary bar is absent when SLE is disabled', async () => {
  const cfg = helpers.defaultConfig();
  cfg.boards[boardId] = {
    sle: { enabled: false, days: 0 },
  };

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  await vtbPage.waitForTimeout(3000);
  const barExists = await vtbPage.$('#vtb-enhancer-sle-bar');
  expect(barExists).toBeNull();
});
