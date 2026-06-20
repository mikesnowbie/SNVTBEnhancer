// Smoke test: verifies the core badge injection runs at all.
// If this fails, all other tests will too — fix this first.

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, vtbPage, frame;

test.beforeAll(async () => {
  context = await helpers.launchEdge();
  const extensionId = await helpers.getExtensionId(context);
  await helpers.setConfig(context, extensionId, helpers.defaultConfig());
  vtbPage = await helpers.waitForVtbPage(context);
  frame   = await helpers.waitForBoardEnhanced(vtbPage);
});

test.afterAll(async () => { await context.close(); });

test('at least one card is enhanced', async () => {
  const count = await frame.evaluate(() =>
    document.querySelectorAll('[data-task-age-enhanced="true"]').length
  );
  expect(count).toBeGreaterThan(0);
});

test('every enhanced card has a badge div', async () => {
  const allHaveBadge = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .every(card => card.querySelector('div[style*="border-radius"]') !== null)
  );
  expect(allHaveBadge).toBe(true);
});

test('every enhanced card has a data-task-age-days attribute', async () => {
  const allHaveDays = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .every(card => card.hasAttribute('data-task-age-days'))
  );
  expect(allHaveDays).toBe(true);
});

test('badge text matches expected patterns', async () => {
  const texts = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .map(card => card.querySelector('div[style*="border-radius"]')?.textContent?.trim())
      .filter(Boolean)
  );
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    // Valid badge text: "15d", "Age: 15d", "Done", "Starts in 3d", or with SLE emoji prefix
    expect(text).toMatch(/\d+d|Done|Starts in \d+d/);
  }
});
