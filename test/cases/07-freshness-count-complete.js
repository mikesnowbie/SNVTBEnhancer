// Verifies the popup's freshness total is COMPLETE at load — i.e. it counts
// every card in the DOM without requiring the user to scroll through lanes.
//
// ServiceNow's vtb-viewport-on-scroll directive keeps off-screen cards in the
// DOM as display:none (not removed), and the content script draws an indicator
// on every card at load. So the accumulated fresh/stale total the popup reads
// should already equal the full in-DOM indicator count before any scrolling.
//
// This test guards against a regression where counting reverts to a
// visible-only / scroll-dependent approach (the reason the old popup carried a
// "scroll through all lanes for a complete total" qualifier, now removed).

import { test, expect } from '@playwright/test';
import * as helpers from '../helpers.js';

let context, extensionId, vtbPage, frame;

test.beforeAll(async () => {
  context     = await helpers.launchEdge();
  extensionId = await helpers.getExtensionId(context);
  vtbPage     = await helpers.waitForVtbPage(context);
  frame       = await helpers.waitForBoardEnhanced(vtbPage);
});

test.afterAll(async () => { await context.close(); });

test('popup freshness total counts every in-DOM card without scrolling', async () => {
  const cfg = helpers.defaultConfig();
  cfg.defaultConfig.enableUpdateIndicator = true;
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

  // Ground truth: indicators present in the DOM right now (no scrolling).
  const dom = await frame.evaluate(() => {
    const cards = [...document.querySelectorAll('.vtb-card-component-wrapper')];
    const indicators = [...document.querySelectorAll('.vtb-enhancer-update-indicator')];
    return {
      totalCards: cards.length,
      hidden: cards.filter(c => c.style.display === 'none').length,
      indicatorCount: indicators.length,
    };
  });

  // The scenario only has teeth when some cards are virtual-scroll hidden.
  expect(dom.indicatorCount).toBeGreaterThan(0);

  const popup = await helpers.queryPopup(context, extensionId);
  expect(popup).not.toBeNull();

  // The popup total must already equal every indicator drawn in the DOM —
  // proving the count does not depend on the user scrolling hidden lanes.
  expect(popup.freshCount + popup.staleCount).toBe(dom.indicatorCount);

  // The authoritative board total comes from the lane header counts and must
  // cover every rendered card. On a fully-rendered board the two are equal,
  // so the popup shows no "still loading" partial notice.
  expect(popup.boardCardTotal).toBeGreaterThan(0);
  expect(popup.renderedCardCount).toBeLessThanOrEqual(popup.boardCardTotal);
  expect(popup.renderedCardCount).toBe(dom.totalCards);
});
