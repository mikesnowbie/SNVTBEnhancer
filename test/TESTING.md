# SNVTBEnhancer — Testing Guide

The testing harness uses [Playwright](https://playwright.dev/) to drive a real Microsoft Edge browser with the extension loaded. There is no mocked environment — every test run connects to a live ServiceNow VTB board using your authenticated session.

## Prerequisites

- Node.js 18 or later
- Microsoft Edge installed (used via `channel: 'msedge'` — not Chromium)
- An authenticated session on a ServiceNow VTB board (see First-time Setup)

## First-time Setup

**1. Install dependencies**

```bash
npm install
```

This installs Playwright and its Edge browser driver. Run once per machine (or after pulling a new version).

**2. Create your local board config**

Board URLs are not stored in source — they contain ServiceNow system IDs specific to your instance and must never be committed.

Copy the example template and fill in your own board URLs:

```bash
mkdir -p test-local
cp test/config.example.json test-local/config.json
```

Then edit `test-local/config.json`:

```json
{
  "testingBoardUrl": "https://YOUR-INSTANCE.service-now.com/now/nav/..."
}
```

`testingBoardUrl` is used by both the assertion test cases and the explore script. `test-local/` is gitignored entirely, so `config.json` will never be committed.

**3. Prime the Edge profile**

The harness uses a persistent Edge profile at `test-local/.edge-profile/`. This profile stores your ServiceNow authentication cookies so tests can navigate directly to board URLs without prompting for login. You only need to do this once:

```bash
npm run test:explore
```

On first run, the navigation will land on the Microsoft/SAML login page. Sign in manually in the Edge window that opens. Once you reach the VTB board, close the window — the session cookie is now saved in the profile.

Subsequent runs will navigate directly to the board without prompting.

> **Security note:** `test-local/.edge-profile/` contains real authentication cookies. The entire `test-local/` directory is gitignored and must never be committed or shared.

## Running Tests

### Assertion tests (the main test suite)

```bash
npm run test:assert
```

Runs every test case in `test/cases/` serially (one worker, one shared profile). Each case opens its own Edge window, navigates to the configured board, and makes assertions. The HTML report is written to `test-local/playwright-report/`.

### Exploration / diagnostics

```bash
npm run test:explore
```

Runs `test/explore.js` — a non-Playwright Node script that navigates to a board, captures screenshots, and dumps DOM diagnostic data to `test-local/output/`. Use this to inspect a specific board's structure or debug a suspected issue before writing an assertion.

### Investigating board-specific rendering (read before deep DOM debugging)

ServiceNow VTB has several non-obvious rendering behaviours that have caused real bugs — they are documented in the **ServiceNow VTB DOM Architecture** section of the repo-root `CLAUDE.md`. Read that first. The two that most affect *testing*:

- **The harness renders everything, so it cannot reproduce lazy-loading states.** In automated Edge, a board renders all its cards into the DOM regardless of window size or even with CDP network throttling — so a problem a user sees in their real browser (e.g. "the popup only counts 22 of 136 cards until I scroll") will *not* reproduce as a low count here. Do not conclude the bug doesn't exist. Instead read the DOM directly: count `display:none` cards, sum `.vtb-lane-header-count`, and compare against rendered counts to reason about what the user's slower/narrower environment would show.
- **Geometry lies for off-screen cards; the Angular model is out of reach for the extension.** `getBoundingClientRect` is zero-size for `display:none` cards, and `window.angular` is only visible from `frame.evaluate()` (page main world), never from the content script (isolated world). When debugging card→lane or freshness issues, resolve lanes structurally (`v-lane-index`, `aria-label="Cards in lane: …"`), not by geometry, and verify against `.vtb-lane-header-count` totals.

**Throwaway probe pattern.** For one-off investigation, write a small Node script in `test-local/` (gitignored) that `import`s `../test/helpers.js`, calls `helpers.launchEdge()` + `helpers.waitForVtbPage()` + `helpers.getVtbFrame()`, then uses `frame.evaluate()` to dump whatever DOM/Angular structure you need (ancestor chains, attributes, per-lane counts). Run it with `node test-local/your-probe.mjs`, learn what you need, then delete it. Several findings in `CLAUDE.md` came from exactly this loop. To inspect the numbers the toolbar popup would show, use `helpers.queryPopup(context, extensionId)`, which sends the real `VTB_POPUP_QUERY` message and returns the content script's response.

## Test Cases

| File | What it verifies |
|---|---|
| `cases/01-badge-render.js` | Every enhanced card has a rendered age badge and `data-task-age-days` attribute (Done cards excluded) |
| `cases/02-badge-color.js` | Badge background color matches the configured age-band thresholds |
| `cases/03-badge-prefix.js` | Badge prefix (when enabled) appears before the age number with correct emoji/text |
| `cases/04-freshness.js` | Freshness indicators (✅/❌) appear next to each card's last-updated timestamp |
| `cases/05-summary-bar.js` | SLE summary bar appears when SLE is enabled; is absent when disabled |
| `cases/06-sle-breach.js` | Breached cards show the breach emoji and red outline; no indicators when SLE is disabled |
| `cases/07-freshness-count-complete.js` | Popup freshness total counts every in-DOM card at load (no scrolling needed), even when most lanes are virtual-scroll hidden |
| `cases/08-wip-freshness-hidden.js` | WIP-lane freshness restriction counts off-screen (display:none) cards in the configured lanes; restricting to all lanes equals no restriction |

## Source Files vs. Generated Artifacts

### Committed to GitHub (`test/`)

```
test/
  TESTING.md            ← this file
  helpers.js            ← shared utilities (launchEdge, navigateToBoard, waitForBoardEnhanced, setConfig, queryPopup, …)
  playwright.config.js  ← testDir, testMatch, timeout, workers, reporter settings
  explore.js            ← diagnostic script for board investigation
  cases/                ← numbered assertion test files
```

### Never committed (`test-local/` — gitignored entirely)

```
test-local/
  .edge-profile/        ← persistent Edge profile; contains auth cookies
  output/               ← screenshots and JSON dumps from explore.js runs
  playwright-report/    ← Playwright HTML report
  test-results/         ← Playwright trace/video artifacts
```

The split is intentional: everything in `test/` is source that any future session can use immediately after `npm install`. Everything in `test-local/` is either runtime state (auth cookies) or board-specific data that changes with every run.

## Board Configuration

The board URL lives in `test-local/config.json` under the `testingBoardUrl` key (created during First-time Setup). `test/helpers.js` reads that file when it loads and exposes the value as the exported `BOARD_URL` constant, which both the assertion tests and `test/explore.js` use.

**Never commit a board ID or board-specific output file.** Board IDs are ServiceNow system IDs that identify real boards in your instance. `test-local/` is gitignored in its entirety, so `config.json` and everything under `test-local/output/` stay off GitHub.

To point the harness at a different board — for example a larger board with more columns — edit `testingBoardUrl` in `test-local/config.json`. No source files need to change.

## Adding a New Test Case

1. Create `test/cases/NN-your-feature.js` (next number in sequence).
2. Import helpers: `import { test, expect } from '@playwright/test'; import * as helpers from '../helpers.js';`
3. Use `helpers.launchEdge()`, `helpers.waitForVtbPage(context)`, and `helpers.waitForBoardEnhanced(vtbPage)` to get a live board frame.
4. Use `helpers.setConfig(context, extensionId, cfg)` + `vtbPage.reload()` to inject specific config before asserting.
5. To assert on the toolbar popup's reported totals, use `helpers.queryPopup(context, extensionId)` (sends the real `VTB_POPUP_QUERY`).
6. For features whose correctness depends on off-screen cards (freshness counts, lane restriction, totals), assert with cards present but `display:none` — that is where geometry-based logic historically failed. See `cases/07` and `cases/08`.
7. Always call `context.close()` in `afterAll`.

## Troubleshooting

**"Extension not found"** — Run `npm install` and confirm the extension loads at `edge://extensions/` (Developer Mode, Load unpacked, point to the repo root).

**Login prompt on every run** — The profile wasn't primed or the session expired. Run `npm run test:explore`, sign in when the window opens, wait for the board to load, then close.

**Tests time out on board load** — The board may have been deleted or `testingBoardUrl` is wrong. Update `testingBoardUrl` in `test-local/config.json` to a working VTB board URL.

**All cards show "not enhanced"** — The extension content script may not be running. Check `edge://extensions/` to confirm the extension is enabled and that the board URL matches `*://*.service-now.com/*vtb.do*` or `*://*.service-now.com/*agile_board.do*`.

**A user reports low/incomplete counts you can't reproduce** — The harness renders all cards while the user's browser may not (see "Investigating board-specific rendering" above and the DOM Architecture section in the repo-root `CLAUDE.md`). Reason from the DOM (`display:none` counts, `.vtb-lane-header-count` totals) rather than expecting the partial state to reproduce. If the feature uses lane lookup, confirm cards resolve to a lane while hidden — geometry (`getBoundingClientRect`) silently fails for `display:none` cards.
