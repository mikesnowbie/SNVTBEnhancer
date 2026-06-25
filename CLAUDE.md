# SNVTBEnhancer — CLAUDE.md

## Project Overview

**ServiceNow Visual Task Board Enhancer** is a browser extension (Manifest V3) that enhances ServiceNow Visual Task Boards with work item age badges, freshness indicators, total WIP tracking, and service level expectation targets. It is published to the Microsoft Edge Add-ons Store (compatible with Edge and Chrome).

- **Local repo**: `/Users/mikesnow/Library/CloudStorage/OneDrive-Personal/Dev/SNVTBEnhancerWIA`
- **Published repo**: https://github.com/mikesnowbie/SNVTBEnhancer
- **Issue backlog**: https://github.com/mikesnowbie/SNVTBEnhancer/issues

## Technology

- Vanilla JavaScript — no build step, no bundler, no framework, no npm dependencies beyond the version bump script.
- Manifest V3 (`manifest.json`).
- `chrome.storage.sync` for persisting per-board and global configuration.
- The extension runs on URLs matching `*://*.service-now.com/*vtb.do*` and `*://*.service-now.com/*agile_board.do*`.

## ServiceNow VTB DOM Architecture (important gotchas)

These are non-obvious facts about how ServiceNow renders Visual Task Boards. They override naive assumptions and have each caused real bugs — read before touching card/lane/freshness logic in `content.js`.

- **The board lives in a nested iframe.** The Now navigation shell loads the actual board in an inner `$vtb.do` (or `$agile_board.do`) iframe. The content script is injected with `all_frames: true` and runs inside that inner frame; the outer shell URL (`/now/nav/...`) has no board id. This is why `agile_board.do` boards "just work" — their inner frame is still `$vtb.do`. The test harness mirrors this: `getVtbFrame()` finds the inner frame, not the main frame.
- **Off-screen cards stay in the DOM as `display:none`** (ServiceNow's `vtb-viewport-on-scroll` virtual scroll). They are *not* removed, so `document.querySelectorAll('.vtb-card-component-wrapper')` returns every card on most boards. `processExistingCards()` therefore enhances all of them at load.
- **Per-card timestamps load lazily.** `sys_updated_on` is only bound onto a card when that card actually renders. On large/slow boards some cards are not yet rendered, so their freshness can't be computed until they are. The popup flags this via `boardCardTotal` (authoritative) vs `renderedCardCount` (see the partial-load notice in `popup.js`).
- **Lane headers and lane bodies are SEPARATE DOM subtrees.** ServiceNow renders the header row and the card columns as parallel `ng-repeat` branches that share a `v-lane-index` attribute (and a *duplicate* `id="lane_<sysid>"`). Consequences:
  - A card's body subtree does **not** contain its lane header, so you cannot map a card to its lane by DOM containment ("walk up to the single header") on these boards.
  - `getBoundingClientRect`-based (geometric) lane matching returns a zero-size rect for `display:none` cards, so it silently fails for every off-screen card. This caused WIP-lane freshness to drop hidden cards.
  - **Resolve a card's lane structurally instead:** walk up to the card's lane container and read `v-lane-index` (map it to a name via the header titles — see `getLaneIndexNameMap()`), or the lane body's `aria-label="Cards in lane: <name>"`. These work regardless of visibility. `findCardLane()` does this first, then falls back to containment, then geometry.
- **Lane header counts are the authoritative per-lane total.** `.vtb-lane-header-count` reflects all cards in the lane including unrendered ones, so summing them (`countAllLaneCards()` / `countCardsInWipLanes()`) is more reliable than counting card DOM elements.
- **The AngularJS model is unreachable from the content script.** `window.angular` and lane/card scopes live in the page's *main* world; the content script runs in the *isolated* world and cannot read them. Diagnostics via Playwright `frame.evaluate()` run in the main world and *can* see `angular` — do not assume the extension has the same access. Always derive runtime data from the DOM, not the Angular model.

## Key Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest; version number lives here |
| `shared.js` | Shared config constants, storage, and import/export utilities; loaded by content.js, options.js, and popup.js |
| `content.js` | Content script — injected into every matching ServiceNow VTB page |
| `options.html` / `options.js` | Extension options UI (age bands, freshness threshold, emojis) |
| `popup.html` / `popup.js` | Toolbar popup — board health dashboard and quick settings navigation |
| `bump-version.js` | Node script that increments the patch version in `manifest.json`; runs in CI only |
| `test/TESTING.md` | Full testing guide — setup, running tests, adding cases, troubleshooting |
| `test/helpers.js` | Shared Playwright utilities: `launchEdge`, `navigateToBoard`, `waitForBoardEnhanced`, `setConfig` |
| `test/playwright.config.js` | Playwright config — testDir, timeout, single worker, HTML reporter |
| `test/explore.js` | Diagnostic script: navigates to a board, captures screenshots, dumps DOM data to `test-local/output/` |
| `test/cases/` | Numbered assertion test files (01–08); each covers one enhancement feature |
| `test-local/` | Gitignored runtime dir: Edge profile (auth cookies), board config, screenshots, reports |

## Git & PR Workflow

- **Never push to `main`.** The `main` branch is managed manually by Mike on the GitHub website.
- **Never push to the remote** unless Mike explicitly asks.
- All work happens locally on a descriptive branch (no mandatory prefix — just make the name clear, e.g. `add-tooltip-to-age-badge`, `fix-duplicate-badge-render`).
- **Always bump the version as part of the branch** before committing (see Version Management below), so the exact version ships in the PR diff.
- When ready to publish, push the branch and create a PR with `gh pr create --base main`. The PR title should be concise and imperative. Include a brief summary and test notes in the body.
- **Always wait for Mike to confirm local testing is done before creating the PR.** Never create a GitHub PR autonomously — ask first.
- On merge to `main`, CI automatically builds the Edge zip and creates a versioned GitHub Release. No manual release steps needed.

## Version Management

- Version is stored in `manifest.json`.
- Use `bump-version.js` locally when creating a branch, before making any other changes:
  - **Bug fix / minor tweak** (patch bump): `node bump-version.js`
  - **New feature** (minor bump): `node bump-version.js --minor`
  - **Major release**: edit `manifest.json` manually.
- Commit the version bump as the first commit on the branch so it's clearly visible in the PR diff.
- CI reads the version from `manifest.json` to name the release tag and zip files — if two PRs carry the same version the CI release step will fail, which is the intended signal to investigate.

## Testing

The project has a **Playwright testing harness** that drives a real Microsoft Edge browser with the extension loaded against a live ServiceNow board. There is no mocked environment. See `test/TESTING.md` for the full guide.

### Quick reference

```bash
npm install              # once per machine after pulling
npm run test:explore     # diagnostic: screenshot + DOM dump to test-local/output/
npm run test:assert      # run all assertion test cases (test/cases/)
```

The board URL is stored in **`test-local/config.json`** (gitignored — never committed):

```json
{ "testingBoardUrl": "https://YOUR-INSTANCE.service-now.com/..." }
```

### When to use each tool

| Situation | Tool |
|---|---|
| Investigating a new board layout, unfamiliar DOM structure, or debugging why an enhancement isn't rendering | `npm run test:explore` |
| Verifying a bug fix or new feature works end-to-end | `npm run test:assert` |
| Testing against a different board (e.g. `agile_board.do`) | Update `testingBoardUrl` in `test-local/config.json`, then run explore first, then assert |

### First-time setup

1. `npm install`
2. `mkdir -p test-local && cp test/config.example.json test-local/config.json` — fill in your board URL
3. `npm run test:explore` — sign in when Edge opens; close once the board loads; session is saved to `test-local/.edge-profile/`

### Adding a new test case

Create `test/cases/NN-your-feature.js` (next number in sequence), import from `@playwright/test` and `../helpers.js`, use `helpers.launchEdge()` / `helpers.waitForBoardEnhanced()` / `helpers.setConfig()` / `helpers.queryPopup()`, and call `context.close()` in `afterAll`. See `test/TESTING.md` for the full pattern.

When making changes, document what was manually verified (or which test cases passed) in the PR body.

## Coding Conventions

- The extension has five JS execution contexts: content script (`content.js`), options page (`options.js`), popup (`popup.js`), shared utilities (`shared.js`), and the Node version script (`bump-version.js`). Keep logic in the correct context; don't add new script files without a strong reason (e.g. a new MV3 extension surface like a service worker or devtools panel).
- No comments unless the reason is non-obvious (hidden constraint, workaround, subtle invariant).
- Prefer small, focused functions with descriptive names over clever one-liners.
- Use `const` / `let`; avoid `var`.
- Do not add external dependencies.
