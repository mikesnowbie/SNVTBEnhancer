// Explore mode: launches Edge with the extension, navigates to the board directly,
// captures screenshots and DOM data. No assertions — purely observational.
// Share test-local/output/ with Claude for visual analysis and edge case discovery.

import fs from 'fs';
import path from 'path';
import * as helpers from './helpers.js';

const OUTPUT_DIR = path.resolve('test-local/output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BOARD_URL = 'https://khndev.service-now.com/now/nav/ui/classic/params/target/%24vtb.do%3Fsysparm_board%3Dc66cfa4d931816d0ecacff584dba1009';

const context = await helpers.launchEdge();

try {
  const extensionId = await helpers.getExtensionId(context);
  console.log(`Extension ID: ${extensionId}`);

  console.log(`\nNavigating to board...`);
  const vtbPage = await helpers.navigateToBoard(context, BOARD_URL);
  const frame   = await helpers.waitForBoardLoaded(vtbPage);

  // Full-page screenshot (nav chrome + board)
  await vtbPage.screenshot({
    path: path.join(OUTPUT_DIR, 'board-full.png'),
    fullPage: true,
  });

  // Inner VTB frame only (the enhanced content)
  await frame.locator('body').screenshot({
    path: path.join(OUTPUT_DIR, 'board-frame.png'),
  });

  // DOM data: card counts, badge text/color, summary bar presence
  const data = await frame.evaluate(() => ({
    url:           window.location.href,
    totalCards:    document.querySelectorAll('.vtb-card-component-wrapper').length,
    enhancedCards: document.querySelectorAll('[data-task-age-enhanced="true"]').length,
    notEnhanced:   [...document.querySelectorAll('.vtb-card-component-wrapper')]
      .filter(c => !c.hasAttribute('data-task-age-enhanced')).length,
    summaryBar:    document.getElementById('vtb-enhancer-sle-bar')?.textContent?.trim() ?? null,
    badges: [...document.querySelectorAll('[data-task-age-enhanced="true"]')].map(card => {
      const badge = card.querySelector('div[style*="border-radius"]');
      return {
        ageDays:    card.getAttribute('data-task-age-days'),
        badgeText:  badge?.textContent?.trim(),
        badgeColor: badge?.style?.backgroundColor,
      };
    }),
  }));

  fs.writeFileSync(path.join(OUTPUT_DIR, 'board-data.json'), JSON.stringify(data, null, 2));

  // --- Freshness diagnostic (pass 2) ---
  // Checks whether the extension actually rendered indicators on hidden cards,
  // and probes AngularJS scope structure to find a reliable timestamp source.
  const freshnessDiag = await frame.evaluate(() => {
    const cards   = [...document.querySelectorAll('.vtb-card-component-wrapper')];
    const hidden  = cards.filter(c => c.style.display === 'none');
    const visible = cards.filter(c => c.style.display !== 'none');

    // What attributes does the <time> element carry on visible vs hidden cards?
    function timeAttrs(card) {
      const t = card.querySelector('sn-time-ago time');
      if (!t) return null;
      return {
        datetime:          t.getAttribute('datetime'),
        dataOriginalTitle: t.getAttribute('data-original-title'),
        title:             t.getAttribute('title'),
        // any of these gives us parseable data
        anyData: !!(t.getAttribute('datetime') || t.getAttribute('data-original-title') || t.getAttribute('title')),
      };
    }

    // Count how many cards have each attribute
    const count = (arr, fn) => arr.filter(fn).length;
    const hiddenWithAnyTimestamp  = count(hidden,  c => timeAttrs(c)?.anyData);
    const visibleWithAnyTimestamp = count(visible, c => timeAttrs(c)?.anyData);

    // Did the extension render .vtb-enhancer-update-indicator on these cards?
    const hiddenWithIndicator  = count(hidden,  c => !!c.querySelector('.vtb-enhancer-update-indicator'));
    const visibleWithIndicator = count(visible, c => !!c.querySelector('.vtb-enhancer-update-indicator'));

    // How many cards have been wrapped in .vtb-enhancer-time-wrapper?
    const hiddenWrapped  = count(hidden,  c => !!c.querySelector('.vtb-enhancer-time-wrapper'));
    const visibleWrapped = count(visible, c => !!c.querySelector('.vtb-enhancer-time-wrapper'));

    // Sample 4 hidden cards with their indicator state
    const hiddenSample = hidden.slice(0, 4).map(card => ({
      timeAttrs:    timeAttrs(card),
      hasIndicator: !!card.querySelector('.vtb-enhancer-update-indicator'),
      indicatorText: card.querySelector('.vtb-enhancer-update-indicator')?.textContent ?? null,
    }));

    // AngularJS scope — walk up from the card wrapper to find sysUpdatedOn
    function scopeWalk(el) {
      try {
        if (typeof angular === 'undefined') return { available: false };
        // Try card element first, then walk up through parent scopes
        let node = el;
        while (node && node !== document.body) {
          const scope = angular.element(node).scope();
          if (scope) {
            // Check own properties AND prototype chain for sysUpdatedOn
            const own = Object.keys(scope).filter(k => !k.startsWith('$'));
            const ts  = scope.sysUpdatedOn ?? scope.sys_updated_on;
            if (ts) return { available: true, foundAt: node.tagName, ownKeys: own, sysUpdatedOn: String(ts) };
            if (own.length > 0) return { available: true, foundAt: node.tagName, ownKeys: own, sysUpdatedOn: null };
          }
          node = node.parentElement;
        }
        return { available: true, foundAt: null };
      } catch (e) {
        return { available: false, error: e.message };
      }
    }

    // Find the AngularJS scope that holds sysUpdatedOn — try card, sn-time-ago, and time elements
    const sampleCard = hidden[0];
    const scopeOnCard      = sampleCard ? scopeWalk(sampleCard) : null;
    const scopeOnSnTimeAgo = sampleCard ? scopeWalk(sampleCard.querySelector('sn-time-ago')) : null;
    const scopeOnTimeEl    = sampleCard ? scopeWalk(sampleCard.querySelector('sn-time-ago time')) : null;

    return {
      totalCards:   cards.length,
      visibleCards: visible.length,
      hiddenCards:  hidden.length,
      // Timestamp availability
      hiddenWithAnyTimestamp,
      visibleWithAnyTimestamp,
      // Extension coverage
      hiddenWithIndicator,
      visibleWithIndicator,
      hiddenWrapped,
      visibleWrapped,
      hiddenSample,
      // Angular scope walk
      scopeOnCard,
      scopeOnSnTimeAgo,
      scopeOnTimeEl,
    };
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'freshness-diag.json'),
    JSON.stringify(freshnessDiag, null, 2)
  );

  console.log('\n=== Board Summary ===');
  console.log(`Total cards:    ${data.totalCards}`);
  console.log(`Enhanced:       ${data.enhancedCards}`);
  console.log(`Not enhanced:   ${data.notEnhanced}  (cards without a start date — expected)`);
  console.log(`Summary bar:    ${data.summaryBar ?? '(not present)'}`);

  console.log('\n=== Freshness Diagnostic ===');
  const d = freshnessDiag;
  console.log(`Total / visible / hidden:      ${d.totalCards} / ${d.visibleCards} / ${d.hiddenCards}`);
  console.log(`\nTimestamp data available:`);
  console.log(`  Visible with any attr:       ${d.visibleWithAnyTimestamp} / ${d.visibleCards}`);
  console.log(`  Hidden  with any attr:       ${d.hiddenWithAnyTimestamp} / ${d.hiddenCards}  ← key number`);
  console.log(`\nExtension coverage after load:`);
  console.log(`  Visible with indicator:      ${d.visibleWithIndicator} / ${d.visibleCards}`);
  console.log(`  Hidden  with indicator:      ${d.hiddenWithIndicator} / ${d.hiddenCards}  ← did we miss these?`);
  console.log(`  Visible wrapped:             ${d.visibleWrapped}`);
  console.log(`  Hidden  wrapped:             ${d.hiddenWrapped}`);
  console.log(`\nAngularJS scope walk:`);
  console.log(`  On card element:             ${JSON.stringify(d.scopeOnCard)}`);
  console.log(`  On sn-time-ago element:      ${JSON.stringify(d.scopeOnSnTimeAgo)}`);
  console.log(`  On <time> element:           ${JSON.stringify(d.scopeOnTimeEl)}`);
  console.log(`\nHidden card sample:`);
  d.hiddenSample.forEach((s, i) => console.log(`  [${i}] ${JSON.stringify(s)}`.slice(0, 160)));

  console.log('\nFiles written:');
  console.log('  test-local/output/board-full.png      — full page screenshot');
  console.log('  test-local/output/board-frame.png     — inner VTB frame');
  console.log('  test-local/output/board-data.json     — badge data');
  console.log('  test-local/output/freshness-diag.json — hidden card timestamp diagnostic');

} finally {
  await context.close();
}
