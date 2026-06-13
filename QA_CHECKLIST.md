# Manual QA Checklist

Use this checklist before shipping a release.

## Install / Update

- Load the folder unpacked from `chrome://extensions`.
- Confirm the extension appears as Auto Life Logger with icons.
- Open the onboarding page on a fresh profile.
- Reload the extension and confirm existing settings/data remain.
- Disable and re-enable the extension.

## Popup

- Open the popup on a normal HTTP/HTTPS page.
- Confirm the active domain is shown.
- Confirm live session duration increases.
- Open the dashboard from both popup buttons.
- Generate a summary when no data exists and when data exists.

## Dashboard

- Visit Overview, Sites, Patterns, Discipline, Gamification, Reports, History, and Settings.
- Confirm empty states render without console errors.
- Confirm weekly trend and charts render after browsing.
- Change settings and confirm they persist after dashboard reload.
- Export all data.
- Export settings.
- Import a settings JSON file.

## Options Page

- Open Chrome extension Details > Extension options.
- Pause tracking and confirm the popup shows paused state.
- Resume tracking.
- Add a never-track domain and confirm it is not logged.
- Reset settings to defaults.

## Strict Mode

- Enable Strict Mode.
- Set a low per-site threshold.
- Trigger or simulate ignored warnings.
- Confirm the blocked domain appears in Settings.
- Visit the blocked site and confirm the block page appears.
- Test temporary bypass.
- Enable no-bypass mode and confirm the bypass button is disabled.
- Test scheduled strict hours.

## Privacy / Security

- Confirm no remote favicon requests appear in DevTools Network.
- Confirm no extension errors appear in the background service worker console.
- Confirm local data deletion removes sessions, summaries, scores, patterns, and violations.
