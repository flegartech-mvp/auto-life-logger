# Auto Life Logger

Auto Life Logger is a local-first Chrome extension for tracking browsing habits, spotting distraction loops, and nudging the user back toward focused work.

## What It Does

- Tracks active HTTP/HTTPS tab sessions locally.
- Classifies domains as productive, distracting, or neutral.
- Shows daily totals, top sites, weekly trends, context breakdowns, and discipline scores.
- Detects focus patterns such as distraction loops, time overruns, rebounds, and micro-distractions.
- Shows optional browser notifications and on-page interventions.
- Supports Strict Mode, which can block distracting sites after ignored warnings.
- Stores data in `chrome.storage.local`; no analytics or remote service is used.

## Load Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder (the directory containing `manifest.json`).

## Development

This is a plain MV3 extension, not a bundled web app. There are no runtime dependencies.

Useful commands:

```bash
npm run lint
npm run smoke
npm run validate
npm run package
```

`npm run lint` performs manifest, path, syntax, and security-pattern validation.

`npm run test:chrome` starts Chrome or Edge with a temporary profile and loads the extension unpacked (this is what CI runs).

`npm run test:ui` runs the Playwright UI smoke suite. Install the browser first with `npx playwright install chromium`. On a Linux distribution without a Playwright-bundled Chromium build, drive your system Chrome instead: `PW_CHANNEL=chrome npm run test:ui`.

`npm run package` validates the extension and creates a Chrome Web Store upload zip in `dist/`.

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`, for example `npm.cmd run validate`.

## Main Files

- `manifest.json`: MV3 extension manifest.
- `background.js`: service worker, storage, session tracking, scoring, strict mode.
- `blocker.js`: document-start strict-mode block page.
- `content.js`: page overlays and achievement toasts.
- `popup.html` / `popup.js`: extension action popup.
- `dashboard.html` / `dashboard.js`: analytics dashboard.
- `options.html` / `options.js`: Chrome options page.
- `onboarding.html` / `onboarding.js`: first-install setup.

## Privacy

The extension is designed to keep browsing data local. Domain lists, sessions, scores, summaries, strict-mode state, and backups are stored on the device through Chrome extension storage.

---

Made by FlegarTech. If this project helped you, you can [support development](https://paypal.me/TiniFlegar).
