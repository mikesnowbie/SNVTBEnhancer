# SNVTBEnhancer — CLAUDE.md

## Project Overview

**ServiceNow Visual Task Board Enhancer - Work Item Age** is a browser extension (Manifest V3) that injects age badges and update-freshness indicators onto cards in ServiceNow Visual Task Boards. It is published to the Microsoft Edge Add-ons Store and has a parallel Safari variant.

- **Local repo**: `/Users/mikesnow/Library/CloudStorage/OneDrive-Personal/Dev/SNVTBEnhancerWIA`
- **Published repo**: https://github.com/mikesnowbie/SNVTBEnhancer
- **Issue backlog**: https://github.com/mikesnowbie/SNVTBEnhancer/issues

## Technology

- Vanilla JavaScript — no build step, no bundler, no framework, no npm dependencies beyond the version bump script.
- Manifest V3 (`manifest.json`).
- `chrome.storage.sync` for persisting per-board and global configuration.
- The extension only runs on URLs matching `*://*.service-now.com/*vtb.do*`.

## Key Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest; version number lives here |
| `content.js` | Content script — injected into every matching ServiceNow VTB page |
| `options.html` / `options.js` | Extension options UI (age bands, freshness threshold, emojis) |
| `bump-version.js` | Node script that increments the patch version in `manifest.json`; runs in CI only |
| `safari-extension/` | Safari variant — mirrors `content.js`, `options.html`, `options.js`, `images/`, `manifest.json` |

## Safari Extension Sync Policy

The Safari extension (`safari-extension/`) must stay in sync with the Edge extension. Any change to `content.js`, `options.html`, `options.js`, or `images/` must be reflected in `safari-extension/` as part of the **same PR**. If a Safari-specific divergence is necessary, document it clearly in the PR description.

Goal: keep the two as close to identical as possible so publishing both versions is straightforward.

## Git & PR Workflow

- **Never push to `main`.** The `main` branch is managed manually by Mike on the GitHub website.
- **Never push to the remote** unless Mike explicitly asks.
- All work happens locally on a descriptive branch (no mandatory prefix — just make the name clear, e.g. `add-tooltip-to-age-badge`, `fix-duplicate-badge-render`, `sync-safari-options-ui`).
- When a local change is ready, create a PR targeting `main` using `gh pr create`. The PR title should be concise and imperative (e.g. "Add tooltip showing raw start date on age badge"). Include a brief summary and test notes in the PR body.
- The CI/CD pipeline (`.github/workflows/release.yaml`) only runs on push to `main` — it auto-bumps the patch version and uploads the extension artifact. Do not trigger it during normal feature work.

## Version Management

- Version is stored in `manifest.json` only.
- `bump-version.js` is run by CI on merge to `main`; do not run it manually during feature work.
- Do not edit the version number during feature development.

## Testing

There are no automated tests. The extension runs inside ServiceNow, which is a live SaaS environment we cannot replicate locally. Testing means:

1. Loading the unpacked extension in Edge (`edge://extensions/` → Developer Mode → Load unpacked).
2. Navigating to a real ServiceNow VTB URL (`*service-now.com/*vtb.do*`).
3. Verifying badges render correctly, options persist, and no console errors appear.

When making changes, document what was manually verified in the PR body.

## Coding Conventions

- Keep all logic in `content.js` and `options.js`; do not introduce additional script files without a strong reason.
- No comments unless the reason is non-obvious (hidden constraint, workaround, subtle invariant).
- Prefer small, focused functions with descriptive names over clever one-liners.
- Use `const` / `let`; avoid `var`.
- Do not add external dependencies.
