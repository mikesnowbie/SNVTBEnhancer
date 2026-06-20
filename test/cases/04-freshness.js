// Verifies freshness indicators: emoji siblings appear next to <sn-time-ago>
// elements. Depends on ServiceNow populating timestamps on the board.

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, extensionId, vtbPage, frame;

test.beforeAll(async () => {
  context     = await helpers.launchEdge();
  extensionId = await helpers.getExtensionId(context);
  vtbPage     = await helpers.waitForVtbPage(context);
});

test.afterAll(async () => { await context.close(); });

test('freshness indicators appear when enableUpdateIndicator is true', async () => {
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.enableUpdateIndicator = true;

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const indicatorCount = await frame.evaluate(() =>
    document.querySelectorAll('.vtb-enhancer-update-indicator').length
  );

  // If no sn-time-ago elements exist on this board, indicators can't render —
  // skip rather than fail, since this depends on ServiceNow's DOM structure.
  const timeAgoCount = await frame.evaluate(() =>
    document.querySelectorAll('sn-time-ago').length
  );
  if (timeAgoCount === 0) {
    console.log('  SKIP: no sn-time-ago elements found on this board');
    return;
  }

  expect(indicatorCount).toBeGreaterThan(0);
});

test('freshness indicators are absent when enableUpdateIndicator is false', async () => {
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.enableUpdateIndicator = false;

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  // Give the content script a moment to settle — then check nothing was added
  await vtbPage.waitForTimeout(2000);

  const indicatorCount = await frame.evaluate(() =>
    document.querySelectorAll('.vtb-enhancer-update-indicator').length
  );
  expect(indicatorCount).toBe(0);
});

test('fresh emoji matches configuration', async () => {
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.enableUpdateIndicator = true;
  cfg.defaultConfig.updateThresholdDays   = 9999; // every card is "fresh"
  cfg.defaultConfig.updateIndicator       = { freshEmoji: '🟢', staleEmoji: '🔴' };

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const timeAgoCount = await frame.evaluate(() =>
    document.querySelectorAll('sn-time-ago').length
  );
  if (timeAgoCount === 0) {
    console.log('  SKIP: no sn-time-ago elements found on this board');
    return;
  }

  const indicators = await frame.evaluate(() =>
    [...document.querySelectorAll('.vtb-enhancer-update-indicator')]
      .map(el => el.textContent?.trim())
      .filter(Boolean)
  );

  expect(indicators.length).toBeGreaterThan(0);
  // With threshold 9999, all cards should show the fresh emoji
  for (const text of indicators) {
    expect(text).toBe('🟢');
  }
});
