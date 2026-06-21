// Verifies SLE breach indicators: sets SLE target to 1 day so virtually all
// cards breach, then checks that the breach emoji and red border appear on badges.

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, extensionId, vtbPage, frame, boardId;

test.beforeAll(async () => {
  context     = await helpers.launchEdge();
  extensionId = await helpers.getExtensionId(context);
  vtbPage     = await helpers.waitForVtbPage(context);
  frame       = await helpers.waitForBoardEnhanced(vtbPage);

  boardId = await frame.evaluate(() => {
    const m = window.location.search.match(/[?&]sysparm_board=([^&]+)/);
    return m ? m[1] : null;
  });
  expect(boardId).toBeTruthy();
});

test.afterAll(async () => { await context.close(); });

test('breach emoji appears on badges when cards exceed SLE target', async () => {
  const cfg = helpers.defaultConfig();
  cfg.boards[boardId] = {
    sle: {
      enabled:          true,
      days:             1,     // virtually every card will breach
      approachingDays:  0,
      showSummary:      true,
      showBadgeEmojis:  true,
      showBadgeBorder:  true,
      approachingEmoji: '⚠️',
      breachedEmoji:    '🔴',
    },
  };

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const results = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .map(card => {
        const age   = parseInt(card.getAttribute('data-task-age-days'), 10);
        const badge = card.querySelector('div[style*="border-radius"]');
        return {
          age,
          text:   badge?.textContent?.trim(),
          // element.style.border returns "" (not null) when unset, so ?? won't fall through —
          // use || to also treat empty string as absent and check outline (which content.js uses).
          border: badge?.style?.outline || badge?.style?.border || '',
        };
      })
      .filter(r => r.age >= 1) // only cards that should be breached
  );

  expect(results.length).toBeGreaterThan(0);

  for (const { text, border } of results) {
    expect(text).toContain('🔴');
    // Breached cards get a solid red outline — content.js uses #c0392b (rgb(192, 57, 43))
    expect(border).toMatch(/red|#c0392b|rgb\(192/i);
  }
});

test('no breach indicators when SLE is disabled', async () => {
  const cfg = helpers.defaultConfig();
  cfg.boards[boardId] = {
    sle: { enabled: false, days: 0 },
  };

  await helpers.setConfig(context, extensionId, cfg);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  frame = await helpers.waitForBoardEnhanced(vtbPage);

  const hasBreachEmoji = await frame.evaluate(() =>
    [...document.querySelectorAll('[data-task-age-enhanced="true"]')]
      .some(card => card.querySelector('div[style*="border-radius"]')?.textContent?.includes('🔴'))
  );
  expect(hasBreachEmoji).toBe(false);
});
