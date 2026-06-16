# Permission Justification — Auto Life Logger

Single purpose: **help users understand and improve their browsing habits by measuring time-on-site locally and optionally blocking distracting sites.** All data stays on the device — verified: the extension makes **no network requests** (no `fetch`, `XMLHttpRequest`, `sendBeacon`, or WebSocket in any script).

## `permissions`
| Permission | Why it is needed | Data impact |
|------------|------------------|-------------|
| `storage` | Persist habit/time-tracking data, streaks, and user settings locally via `chrome.storage`. | Local only; never transmitted. |
| `alarms` | Roll over daily/weekly counters, schedule focus windows, and trigger periodic aggregation without a persistent background page (MV3). | None. |
| `notifications` | Surface focus reminders and distraction-loop alerts the user opted into. | None. |
| `idle` | Detect when the user is away (locked/idle) so idle time is **not** miscounted as active browsing — improves accuracy and avoids over-collecting. | Reduces data collected. |

## `host_permissions`: `http://*/*`, `https://*/*`
A habit tracker and site blocker must work across **every** site the user visits — there is no way to know in advance which sites a user wants measured or blocked. The two content scripts:
- `blocker.js` (`document_start`) — enforces the user's block list before a distracting page renders.
- `content.js` (`document_idle`) — measures active time on the current site.

Broad host access is inherent to the single purpose. It is **not** used to read page content, scrape data, or exfiltrate anything — confirmed by the absence of any outbound network code.

## Not requested (deliberately)
- ❌ `history`, `tabs`, `webNavigation` — time tracking is done in-page via content scripts, which is more privacy-preserving than reading full browsing history.
- ❌ `cookies`, `downloads`, `bookmarks`, `<all_urls>` scripting injection at runtime.
- ❌ No remote code, no `eval`, MV3 default CSP.

## Data handling
100% local. See [PRIVACY.md](PRIVACY.md). Users can export and delete all data from the dashboard/options page.
