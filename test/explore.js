// Explore mode: launches Edge with the extension, waits for auth, captures
// screenshots and DOM data from the live board. No assertions — purely observational.
// Share test/output/ with Claude for visual analysis and edge case discovery.

import fs from 'fs';
import path from 'path';
import * as helpers from './helpers.js';

const OUTPUT_DIR = path.resolve('test/output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const context = await helpers.launchEdge();

try {
  const extensionId = await helpers.getExtensionId(context);
  console.log(`Extension ID: ${extensionId}`);

  const vtbPage = await helpers.waitForVtbPage(context);
  const frame   = await helpers.waitForBoardEnhanced(vtbPage);

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
    url:          window.location.href,
    totalCards:   document.querySelectorAll('.vtb-card-component-wrapper').length,
    enhancedCards: document.querySelectorAll('[data-task-age-enhanced="true"]').length,
    notEnhanced:  [...document.querySelectorAll('.vtb-card-component-wrapper')]
      .filter(c => !c.hasAttribute('data-task-age-enhanced')).length,
    summaryBar:   document.getElementById('vtb-enhancer-sle-bar')?.textContent?.trim() ?? null,
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

  console.log('\n=== Board Summary ===');
  console.log(`Total cards:    ${data.totalCards}`);
  console.log(`Enhanced:       ${data.enhancedCards}`);
  console.log(`Not enhanced:   ${data.notEnhanced}  (cards without a start date — expected)`);
  console.log(`Summary bar:    ${data.summaryBar ?? '(not present)'}`);
  console.log('\nFiles written:');
  console.log('  test/output/board-full.png   — full page including Edge nav chrome');
  console.log('  test/output/board-frame.png  — inner VTB frame only');
  console.log('  test/output/board-data.json  — badge data for every enhanced card');
  console.log('\nShare these three files with Claude for visual analysis.');

} finally {
  await context.close();
}
