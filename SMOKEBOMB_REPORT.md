# Smokebomb Report

Date: 2026-05-27

## Project

- Type: Plain Manifest V3 Chrome extension
- Package manager: npm
- Framework: No bundler/framework; static HTML/CSS/JS extension pages plus MV3 service worker/content scripts
- Supabase: Not used by the app. `supabase.com` only appears as a default productive-site entry.
- Chrome extension: Yes
- Dev server: Not applicable. Verified by unpacked Chrome extension load and Playwright browser runs.

## Commands Run

- `npm install`
- `npm install --save-dev @playwright/test`
- `npm run lint`
- `npm run test`
- `npm run validate`
- `npm run package`
- `npx playwright test tests/ui-smoke.spec.js --reporter=line`
- Real unpacked-extension Playwright run against `chrome-extension://<id>/dashboard.html`, `options.html`, and `onboarding.html`

## Pages Tested

- `popup.html`
- `dashboard.html`
- `options.html`
- `onboarding.html`
- `background.js` service worker load through unpacked Chrome smoke
- `content.js` and `blocker.js` syntax/manifest validation through `npm run lint`

## Flows Tested

- Home/dashboard overview loads
- Dashboard navigation: Overview, Sites, Patterns, Discipline, Gamification, Reports, History, Settings
- Popup top sites render
- Popup summary dialog opens
- Dashboard settings save
- Options settings save
- Options export settings and export all data buttons
- Options import settings JSON
- Onboarding setup saves and redirects to dashboard
- Dashboard refresh after onboarding redirect
- Empty states for no real extension browsing data
- Mock data states for charts, sites, patterns, scores, achievements, reports, and popup
- Mobile, tablet, laptop, and desktop layouts
- Horizontal overflow checks
- Browser console/page error capture

## Viewports Tested

- Desktop: 1440x900
- Laptop: 1280x720
- Tablet: 768x1024
- Mobile: 390x844
- Additional desktop smoke: 1366x900
- Additional popup smoke: 390x640

## Screenshots Taken

- `output/playwright/dashboard-desktop.png`
- `output/playwright/dashboard-mobile.png`
- `output/playwright/popup-mobile.png`
- `output/playwright/options-tablet.png`
- `output/playwright/onboarding-flow.png`
- `output/playwright/viewport-desktop.png`
- `output/playwright/viewport-laptop.png`
- `output/playwright/viewport-tablet.png`
- `output/playwright/viewport-mobile.png`
- `output/playwright/real-extension-dashboard-final-1440.png`
- `output/playwright/real-extension-dashboard-final-390.png`
- `output/playwright/real-extension-options-final-768.png`
- `output/playwright/real-extension-onboarding-final-1280.png`

## Bugs Found

1. Playwright UI smoke test was not runnable because `@playwright/test` was missing from project dependencies.
2. `npm test` only ran the unpacked Chrome load smoke and did not run the existing Playwright UI smoke suite.
3. Options/settings form controls, especially textareas, used intrinsic browser widths in some layouts, making site-list editors cramped on tablet.

## Bugs Fixed

1. Added `@playwright/test` as a dev dependency and committed the generated npm lockfile.
2. Updated npm scripts so `npm test` runs both Chrome extension load smoke and Playwright UI smoke.
3. Expanded `tests/ui-smoke.spec.js` to cover all requested viewports, primary pages, console errors, dashboard navigation, settings save, popup summary, options import/export, onboarding redirect, refresh behavior, and overflow checks.
4. Updated `.fi` and `textarea.fi` styles so form controls fill their container while preserving inline widths for intentionally compact numeric inputs.

## Files Changed

- `package.json`
- `package-lock.json`
- `styles.css`
- `tests/ui-smoke.spec.js`
- `SMOKEBOMB_REPORT.md`

Generated/updated artifacts:

- `dist/auto-life-logger-extension-2.1.0.zip`
- `output/playwright/*.png`
- `output/playwright/settings-import.json`

## Final Verification

- Build/package: PASS. `npm run package` created `dist/auto-life-logger-extension-2.1.0.zip`.
- Lint: PASS. `npm run lint` passed manifest, file, syntax, and forbidden-pattern validation.
- Tests: PASS. `npm test` passed Chrome load smoke plus 6 Playwright UI tests.
- Browser smoke: PASS. Real unpacked-extension Playwright run found no serious console/page errors.
- Mobile: PASS. 390x844 verified with screenshots and overflow checks.
- Console errors: PASS. No serious console/page errors found in automated UI tests or real extension run.

## Remaining Issues

- A custom invalid-route/404 page is not applicable to this plain MV3 extension. Invalid `chrome-extension://` paths are handled by the browser.
- Popup was tested as `popup.html` with mocked Chrome APIs and core extension pages were tested through real `chrome-extension://` URLs. The toolbar popup opening gesture itself was not automated.
