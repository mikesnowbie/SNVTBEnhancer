// Verifies age-band color bucketing: sets a custom band config and checks
// that each card's badge color matches the expected band for its age.

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, extensionId, vtbPage, frame;

test.beforeAll(async () => {
  context     = await helpers.launchEdge();
  extensionId = await helpers.getExtensionId(context);
  vtbPage     = await helpers.waitForVtbPage(context);
});

test.afterAll(async () => { await context.close(); });

test('cards receive the correct color for their age band', async () => {
  // Use distinctive, easy-to-assert colors so we can spot band mismatches clearly
  const customBands = [
    { maxDays: 10,   color: '#aaaaff' }, // blue   — 0–10d
    { maxDays: 9999, color: '#ff4444' }, // red    — everything older
  ];
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.ageBands = customBands;

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const results = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')].map(card => ({
      ageDays: parseInt(card.getAttribute('data-task-age-days'), 10),
      color:   card.querySelector('div[style*="border-radius"]')?.style?.backgroundColor,
    })).filter(r =>
      // Exclude Done cards (no data-task-age-days → NaN) and future-start cards (age < 0,
      // shown with a fixed #95a5a6 color that's not part of the configurable age bands).
      r.color && !isNaN(r.ageDays) && r.ageDays >= 0
    )
  );

  expect(results.length).toBeGreaterThan(0);

  for (const { ageDays, color } of results) {
    // content.js uses age < band.maxDays (exclusive), so age === maxDays goes
    // into the next band. Mirror that boundary here: < 10, not <= 10.
    const expected = ageDays < 10
      ? helpers.hexToRgb('#aaaaff')
      : helpers.hexToRgb('#ff4444');
    expect(color).toBe(expected);
  }
});

test('restores default colors after test', async () => {
  await helpers.setConfig(context, extensionId, helpers.defaultConfig());
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const count = await frame.evaluate(() =>
    document.querySelectorAll('[data-task-age-enhanced="true"]').length
  );
  expect(count).toBeGreaterThan(0);
});
