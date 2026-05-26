# Safari Extension - SNVTBEnhancerWIA

This folder contains the Safari-compatible version of the **ServiceNow Visual Task Board Enhancer - Work Item Age** extension. The source files in this folder are ready to be converted into a Safari Web Extension using Apple's Xcode toolchain.

## What Changed From the Chrome/Edge Version

The following changes were made relative to the original extension files:

**content.js and options.js**
- All `chrome.storage.sync` calls replaced with `browser.storage.sync` (the standard WebExtensions API namespace Safari uses).
- The `chrome.storage.sync.get(defaults, callback)` pattern replaced with the Promise-based `browser.storage.sync.get(defaults).then(callback)` pattern that Safari expects.
- Fallback paths (when the storage API is unavailable) are unchanged.

**options.html**
- The Google Fonts CDN `<link>` tag removed. Safari extension pages enforce a Content Security Policy that blocks external stylesheet requests by default. The font stack now uses `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` instead, which looks great on macOS.

**manifest.json**
- No changes needed. The extension already uses Manifest V3, which Safari 15.4+ supports fully.

## How to Convert to a Safari Extension Using Xcode

### Prerequisites

- A Mac running macOS 12 (Monterey) or later is recommended (minimum macOS 10.15).
- Xcode 14 or later — download free from the Mac App Store or [developer.apple.com](https://developer.apple.com/xcode/).

### Step 1 — Run the Safari Web Extension Converter

Open Terminal and point the converter at this folder:

```bash
xcrun safari-web-extension-converter /path/to/SNVTBEnhancerWIA/safari-extension
```

Replace `/path/to/SNVTBEnhancerWIA/safari-extension` with the actual path on your Mac. The tool will generate an Xcode project in the same parent directory.

### Step 2 — Review the Conversion Report

The converter prints a report listing any APIs it could not automatically handle. For this extension there should be no blocking issues, since:
- No `chrome.*` calls remain in the source.
- No unsupported permissions are used (only `storage`).
- Manifest V3 is used throughout.

### Step 3 — Build in Xcode

1. Open the generated `.xcodeproj` file in Xcode.
2. Select your Mac as the run destination.
3. Press **Cmd+R** (or Product > Run) to build and launch the host app.

### Step 4 — Enable the Extension in Safari

1. Open Safari and go to **Safari > Settings > Extensions**.
2. Find "ServiceNow Visual Task Board Enhancer - Work Item Age" in the list and toggle it on.
3. When prompted, grant permission to run on `*.service-now.com`.

### Step 5 — Test

Navigate to any ServiceNow Visual Task Board (`*://*.service-now.com/*vtb.do*`). The age badges and freshness indicators should appear exactly as they do in Chrome/Edge.

## Local-Only Use

For personal use on your own Mac you do not need an Apple Developer account. Xcode will sign the extension with a local (ad-hoc) certificate automatically. You will need to re-run the build occasionally as local certificates expire.

If you want to share the extension with others or distribute it, you will need to enroll in the Apple Developer Program ($99/year) and either submit to the Mac App Store or use notarization for direct distribution.

## Further Reading

- [Apple: Safari Web Extensions Overview](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [Apple: Converting a Web Extension for Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari)
- [Supported WebExtensions APIs in Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/assessing_your_safari_web_extension_s_browser_compatibility)
