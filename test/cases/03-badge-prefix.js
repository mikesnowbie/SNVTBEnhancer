// Verifies the badge prefix config toggle: when enabled, badge text starts with
// the configured prefix; when disabled, it shows plain "Nd" format.

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, extensionId, vtbPage, frame;

test.beforeAll(async () => {
  context     = await helpers.launchEdge();
  extensionId = await helpers.getExtensionId(context);
  vtbPage     = await helpers.waitForVtbPage(context);
});

test.afterAll(async () => { await context.close(); });

test('badge includes prefix when enableAgeBadgePrefix is true', async () => {
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.enableAgeBadgePrefix = true;
  cfg.defaultConfig.ageBadgePrefix       = 'Age:';

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const texts = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .map(card => card.querySelector('div[style*="border-radius"]')?.textContent?.trim())
      .filter(t => t && !t.startsWith('Done') && !t.includes('Starts in'))
  );

  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    expect(text).toContain('Age:');
  }
});

test('badge shows plain days when enableAgeBadgePrefix is false', async () => {
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.enableAgeBadgePrefix = false;

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const texts = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .map(card => card.querySelector('div[style*="border-radius"]')?.textContent?.trim())
      .filter(t => t && !t.startsWith('Done') && !t.includes('Starts in'))
  );

  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    expect(text).not.toContain('Age:');
    // Strip any SLE emoji prefix (e.g. "🔴 15d") then check for plain Nd pattern
    expect(text.replace(/^[\p{Emoji}\s]+/u, '')).toMatch(/^\d+d$/);
  }
});
