# SNVTBEnhancer — CLAUDE.md

## Project Overview

**ServiceNow Visual Task Board Enhancer - Work Item Age** is a browser extension (Manifest V3) that injects age badges and update-freshness indicators onto cards in ServiceNow Visual Task Boards. It is published to the Microsoft Edge Add-ons Store (compatible with Edge and Chrome).

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

## Git & PR Workflow

- **Never push to `main`.** The `main` branch is managed manually by Mike on the GitHub website.
- **Never push to the remote** unless Mike explicitly asks.
- All work happens locally on a descriptive branch (no mandatory prefix — just make the name clear, e.g. `add-tooltip-to-age-badge`, `fix-duplicate-badge-render`).
- **Always bump the version as part of the branch** before committing (see Version Management below), so the exact version ships in the PR diff.
- When ready to publish, push the branch and create a PR with `gh pr create --base main`. The PR title should be concise and imperative. Include a brief summary and test notes in the body.
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
