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

**2. Prime the Edge profile**

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

Runs all six test cases in `test/cases/` serially (one worker, one shared profile). Each case opens its own Edge window, navigates to the configured board, and makes assertions. The HTML report is written to `test-local/playwright-report/`.

### Exploration / diagnostics

```bash
npm run test:explore
```

Runs `test/explore.js` — a non-Playwright Node script that navigates to a board, captures screenshots, and dumps DOM diagnostic data to `test-local/output/`. Use this to inspect a specific board's structure or debug a suspected issue before writing an assertion.

## Test Cases

| File | What it verifies |
|---|---|
| `cases/01-badge-render.js` | Every enhanced card has a rendered age badge and `data-task-age-days` attribute (Done cards excluded) |
| `cases/02-badge-color.js` | Badge background color matches the configured age-band thresholds |
| `cases/03-badge-prefix.js` | Badge prefix (when enabled) appears before the age number with correct emoji/text |
| `cases/04-freshness.js` | Freshness indicators (✅/❌) appear next to each card's last-updated timestamp |
| `cases/05-summary-bar.js` | SLE summary bar appears when SLE is enabled; is absent when disabled |
| `cases/06-sle-breach.js` | Breached cards show the breach emoji and red outline; no indicators when SLE is disabled |

## Source Files vs. Generated Artifacts

### Committed to GitHub (`test/`)

```
test/
  TESTING.md            ← this file
  helpers.js            ← shared utilities (launchEdge, navigateToBoard, setConfig, …)
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

`test/helpers.js` exports a `BOARD_URL` constant pointing to the primary test board. Tests that need a different board URL set it locally in that file or in `test/explore.js`.

**Never commit a board ID or board-specific output file.** Board IDs are ServiceNow system IDs that identify real boards in your instance. The `test-local/output/` directory is the correct place for any board-specific data produced by a test run.

When you need to test with a different board — for example a larger board with more columns — change the URL in `explore.js` temporarily. Do not change `BOARD_URL` in `helpers.js` unless you are intentionally moving the primary test target.

## Adding a New Test Case

1. Create `test/cases/07-your-feature.js` (next number in sequence).
2. Import helpers: `import { test, expect } from '@playwright/test'; import * as helpers from '../helpers.js';`
3. Use `helpers.launchEdge()`, `helpers.waitForVtbPage(context)`, and `helpers.waitForBoardEnhanced(vtbPage)` to get a live board frame.
4. Use `helpers.setConfig(context, extensionId, cfg)` + `vtbPage.reload()` to inject specific config before asserting.
5. Always call `context.close()` in `afterAll`.

## Troubleshooting

**"Extension not found"** — Run `npm install` and confirm the extension loads at `edge://extensions/` (Developer Mode, Load unpacked, point to the repo root).

**Login prompt on every run** — The profile wasn't primed or the session expired. Run `npm run test:explore`, sign in when the window opens, wait for the board to load, then close.

**Tests time out on board load** — The board URL in `helpers.js` may have changed or the board was deleted. Update `BOARD_URL` to a working VTB board URL.

**All cards show "not enhanced"** — The extension content script may not be running. Check `edge://extensions/` to confirm the extension is enabled and that the board URL matches `*://*.service-now.com/*vtb.do*`.
