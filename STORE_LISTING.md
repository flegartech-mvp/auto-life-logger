# Chrome Web Store Listing

## Name

Auto Life Logger

## Summary

Private browsing habit tracker with focus nudges, strict mode, and local analytics.

## Description

Auto Life Logger helps you understand where your browsing time goes and catch distraction loops before they take over your day.

The extension tracks active HTTP and HTTPS tab sessions locally, classifies sites as productive, distracting, or neutral, and turns that history into daily totals, top sites, weekly trends, focus patterns, and discipline scores. Optional notifications and on-page interventions can nudge you back toward focused work, while Strict Mode can block distracting sites after repeated ignored warnings.

All browsing history created by the extension stays on your device in Chrome extension storage. Auto Life Logger does not use analytics, remote logging, or a backend service.

## Category

Productivity

## Language

English

## Privacy Practices

- Single purpose: local browsing habit tracking, focus analytics, and distraction intervention.
- Data storage: `chrome.storage.local` on the user's device.
- Data sharing: no data is sold, transferred, or sent to a remote service.
- Remote code: none.

Use `PRIVACY.md` as the privacy policy source when publishing.

## Permission Justification

### Host permissions: `http://*/*`, `https://*/*`

Auto Life Logger needs access to HTTP and HTTPS pages because its single purpose is automatic local browsing habit tracking across the websites the user visits. The extension records active tab domain, URL, title, timestamp, and duration locally so it can show productivity summaries, classify sites, detect distraction loops, display optional on-page interventions, and support Strict Mode blocking on user-configured distracting domains.

The extension cannot use only `activeTab` because `activeTab` grants temporary access only after an explicit user gesture, such as clicking the extension action. Auto Life Logger must work continuously as the user changes tabs and navigates between sites, including when the popup is not open.

The extension does not transmit browsing history, page data, settings, or analytics to a remote server. All extension data is stored locally with `chrome.storage.local`, and users can pause tracking, exclude domains, export data, or delete all local extension data.

### `storage`

Required to store local browsing sessions, summaries, settings, user-created domain lists, Strict Mode state, and export/import data.

### `alarms`

Required to update active browsing sessions and generate daily summaries on schedule.

### `notifications`

Required for optional focus reminders, achievements, and daily summary notifications.

### `idle`

Required to avoid counting inactive or idle browser time as active browsing time.

## Suggested Screenshots

- Popup showing today's focus summary.
- Dashboard with daily totals and trends.
- Options page showing local-first controls.
- Strict Mode block/intervention state.
