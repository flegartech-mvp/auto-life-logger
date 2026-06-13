# SAFE PUBLIC CLAIMS — AutoLifeLogger

## SAFE TO CLAIM

These are accurate, verifiable statements about what the product does:

1. **Tracks active HTTP/HTTPS tab sessions** — the extension monitors which tab is active and how long, logging session durations per domain.
2. **Classifies domains as productive, distracting, or neutral** — a built-in classification system categorises domains; the ruleset is stored locally.
3. **All data stored in chrome.storage.local** — no data is transmitted to any remote server, analytics service, or third party at any point.
4. **Calculates a daily discipline score from 0-100** — the score reflects the ratio of productive to distracting time based on classified session data.
5. **Detects focus patterns including distraction loops and micro-distractions** — the extension identifies specific behavioural patterns and surfaces them as alerts.
6. **Fires browser notifications when patterns are detected** — uses the Chrome Notifications API to alert users in real time.
7. **Strict Mode can block distracting sites** — when enabled, navigation to classified distracting domains is intercepted and redirected.
8. **Built as a Chrome Extension Manifest V3 using vanilla JavaScript** — the tech stack is accurate and the MV3 compliance is verifiable from the manifest.

---

## DO NOT CLAIM

Avoid these statements — they are unverified, exaggerated, or potentially misleading:

1. **"Improves productivity by X%"** — no controlled study or user measurement exists; productivity improvement claims require evidence you do not have.
2. **"Available on the Chrome Web Store"** — only claim this if the extension has actually been submitted and approved; do not preemptively state it.
3. **"Works on all websites"** — the extension targets HTTP/HTTPS tabs; edge cases (chrome:// pages, PDFs, extensions pages) are not tracked and should not be claimed.
4. **"Detects all distraction patterns"** — the extension detects the specific patterns it was coded to detect; claiming exhaustive detection implies capabilities beyond what's implemented.
5. **"Your data is completely secure"** — chrome.storage.local is accessible to the extension and to any other extension with the right permissions; avoid implying cryptographic security for locally stored data.
