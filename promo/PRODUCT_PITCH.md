# PRODUCT PITCH — AutoLifeLogger

## One-Sentence Pitch

A Chrome extension that silently tracks exactly where your browser time goes — classifies every site as productive, distracting, or neutral — and confronts you with the truth about your focus patterns.

## Product Description

AutoLifeLogger runs invisibly in your browser and logs every active HTTP/HTTPS tab session to chrome.storage.local. No account. No analytics service. No data ever leaves your machine. At any point you can open the dashboard and see precisely how many minutes you spent on GitHub versus YouTube, what your discipline score is today, and whether you're caught in a distraction loop right now.

The extension goes beyond raw time totals. It detects behavioural patterns: distraction loops (bouncing between unproductive sites), time overruns (staying on a site far longer than intended), rebounds (returning to a distraction immediately after doing productive work), and micro-distractions (brief context switches that fragment focus). When it detects these patterns, it fires browser notifications. Strict Mode goes further — it actively blocks sites classified as distracting, the same way a site blocker would, but only during windows you define. Everything is local, everything is yours.

## Best 5 Features

- **Automatic session classification** — every domain is tagged productive, distracting, or neutral based on a built-in ruleset you can customise
- **Focus pattern detection** — identifies distraction loops, time overruns, rebounds, and micro-distractions in real time and notifies you
- **Discipline score** — a daily 0-100 score that reflects your actual ratio of productive to distracted browsing time
- **Strict Mode site blocking** — optionally block distracting domains with a hard browser-level block, not just a warning
- **Weekly trends + context breakdowns** — dashboard charts showing your top sites, daily totals, and how your focus changes across the week

## 30-Second Demo Flow

1. Open Chrome with the extension installed — the toolbar icon shows the current discipline score badge (e.g. "72")
2. Click the toolbar icon to open the popup — show today's totals: 1h 20m productive, 45m distracting, score 68
3. Click "Top Sites" — a ranked list appears showing GitHub (productive, 55m), YouTube (distracting, 30m), Gmail (neutral, 20m)
4. Click "Weekly Trends" — a bar chart shows discipline scores for the last 7 days with a visible dip on Sunday
5. Navigate to a site classified as distracting — a browser notification fires immediately: "You've spent 30 min on YouTube today"
6. Enable Strict Mode from the dashboard — attempt to visit the distracting site — the tab is redirected to the block page
7. Return to the dashboard and point out the "Distraction Loop Detected" alert badge

## Target Audience

Knowledge workers, students, and developers who use a browser for the majority of their work day and want honest data about where their focus goes — without installing a surveillance tool that phones home to a subscription service.
