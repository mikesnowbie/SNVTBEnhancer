// Verifies WIP-lane freshness restriction counts cards in the configured lanes
// even when they are scrolled off-screen (display:none).
//
// Regression guard: lane resolution once relied on getBoundingClientRect, which
// returns a zero-size rect for hidden cards, so every off-screen card failed the
// WIP-lane check and was dropped from the freshness tally. On large boards that
// undercounted freshness badly (e.g. 22 instead of 81). The fix resolves a
// card's lane structurally (v-lane-index / aria-label), independent of layout.
//
// Strategy: restricting freshness to EVERY lane must yield the same total as no
// restriction at all — restricting to all lanes excludes nothing. Before the
// fix the all-lanes run collapsed to roughly the visible-card count.

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

test('WIP-restricted freshness counts off-screen cards in the configured lanes', async () => {
  // Discover every lane name on the board.
  const laneNames = await frame.evaluate(() => {
    const out = [];
    document.querySelectorAll('.vtb-lane-header-title').forEach((el) => {
      const label = el.querySelector('label, input');
      const name = ((label ? (label.value || label.textContent) : el.textContent) || '').trim();
      if (name && !out.includes(name)) out.push(name);
    });
    return out;
  });
  if (laneNames.length === 0) {
    console.log('  SKIP: no lane headers found on this board');
    return;
  }

  const counts = await frame.evaluate(() => {
    const cards = [...document.querySelectorAll('.vtb-card-component-wrapper')];
    return {
      hidden: cards.filter(c => c.style.display === 'none').length,
      visible: cards.filter(c => c.style.display !== 'none').length,
    };
  });
  if (counts.hidden === 0) {
    console.log('  SKIP: no off-screen cards on this board — restriction path has no teeth here');
    return;
  }

  // Run 1: freshness with no WIP restriction.
  const noRestrict = helpers.defaultConfig();
  noRestrict.boards[boardId] = { enableUpdateIndicator: true, enableWipLanes: false, wipLanes: [] };
  await helpers.setConfig(context, extensionId, noRestrict);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  await helpers.waitForBoardEnhanced(vtbPage);
  const unrestricted = await helpers.queryPopup(context, extensionId);
  const unrestrictedTotal = unrestricted.freshCount + unrestricted.staleCount;

  // Run 2: freshness restricted to EVERY lane — must match the unrestricted run.
  const allLanes = helpers.defaultConfig();
  allLanes.boards[boardId] = { enableUpdateIndicator: true, enableWipLanes: true, wipLanes: laneNames };
  await helpers.setConfig(context, extensionId, allLanes);
  await vtbPage.reload({ waitUntil: 'networkidle' });
  await helpers.waitForBoardEnhanced(vtbPage);
  const restricted = await helpers.queryPopup(context, extensionId);
  const restrictedTotal = restricted.freshCount + restricted.staleCount;

  // Restricting to all lanes excludes nothing, so the totals must be identical.
  // This is the core regression assertion: the old geometry-based lane lookup
  // dropped off-screen cards, collapsing the restricted total to roughly the
  // visible-card count.
  expect(restrictedTotal).toBe(unrestrictedTotal);

  // And the restricted total must include off-screen cards, so it exceeds the
  // count of cards that were visible at load.
  expect(restrictedTotal).toBeGreaterThan(counts.visible);
});
