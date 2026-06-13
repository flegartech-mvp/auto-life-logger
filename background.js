// background.js — Auto Life Logger v2 Service Worker
// Architecture:
//   StorageQueue  → resilient chrome.storage writes
//   SessionMgr    → tab tracking, session lifecycle
//   PatternEngine → 4 pattern types
//   ScoreEngine   → discipline score 0-100
//   GamifyEngine  → streaks + achievements
//   InsightEngine → coaching insights
//   StrictMode    → violation-based site blocking
//   MessageRouter → popup/dashboard/content bridge
'use strict';

// ─── StorageQueue — resilient chrome.storage writes ──────────────────────────
class StorageQueue {
  constructor() {
    this._pending = Promise.resolve();
  }
  /** Queue a key/value write. MV3 service workers can suspend, so persist immediately. */
  put(key, value) {
    return this.now(key, value);
  }
  /** Compatibility hook for older call sites. */
  flush() {
    return this._pending;
  }
  /** Immediate single-key write (bypasses queue) */
  async now(key, value) {
    const write = this._pending
      .catch(() => {})
      .then(() => chrome.storage.local.set({ [key]: value }));
    this._pending = write.catch(e => console.warn('[ALL] Storage error:', e));
    return write;
  }
}

const Q = new StorageQueue();

// ─── Constants ────────────────────────────────────────────────────────────────

const DISTRACTION_SITES = [
  'youtube.com','twitter.com','x.com','reddit.com','facebook.com','instagram.com',
  'tiktok.com','twitch.tv','netflix.com','hulu.com','disney.com','hbomax.com',
  'discord.com','pinterest.com','tumblr.com','snapchat.com','buzzfeed.com',
  '9gag.com','imgur.com','vk.com','weibo.com','dailymotion.com','kick.com',
  'threads.net','bsky.app','mastodon.social','linkedin.com','messenger.com',
  'web.whatsapp.com','telegram.org','signal.org','quora.com','medium.com',
  'substack.com','news.ycombinator.com','producthunt.com','dribbble.com',
  'behance.net','deviantart.com','soundcloud.com','spotify.com','primevideo.com',
  'crunchyroll.com','max.com','paramountplus.com','peacocktv.com','espn.com',
  'bleacherreport.com','fandom.com','wikipedia.org','etsy.com','amazon.com',
  'ebay.com','temu.com','aliexpress.com'
];

const PRODUCTIVE_SITES = [
  'github.com','gitlab.com','bitbucket.org','stackoverflow.com','developer.mozilla.org',
  'docs.google.com','notion.so','figma.com','linear.app','jira.atlassian.com',
  'confluence.atlassian.com','trello.com','asana.com','monday.com','clickup.com',
  'npmjs.com','pypi.org','crates.io','packagist.org','rubygems.org',
  'devdocs.io','mdn.io','vscode.dev','codepen.io','codesandbox.io','replit.com',
  'leetcode.com','hackerrank.com','codewars.com','exercism.org','coursera.org',
  'udemy.com','khanacademy.org','edx.org','pluralsight.com','frontendmasters.com',
  'egghead.io','codecademy.com','freecodecamp.org','scrimba.com','teamtreehouse.com',
  'datacamp.com','brilliant.org','duolingo.com','overleaf.com','arxiv.org',
  'scholar.google.com','researchgate.net','jstor.org','nature.com','science.org',
  'docs.microsoft.com','learn.microsoft.com','docs.aws.amazon.com','cloud.google.com',
  'firebase.google.com','vercel.com','netlify.com','supabase.com','docker.com',
  'kubernetes.io','terraform.io','w3.org','web.dev','canva.com','miro.com',
  'airtable.com','slack.com','teams.microsoft.com','zoom.us','meet.google.com',
  'drive.google.com','calendar.google.com','mail.google.com','outlook.office.com',
  'office.com','onedrive.live.com','dropbox.com','box.com'
];

const SITE_LIST_VERSION = 2;

const CONTEXT_MAP = {
  coding:       ['github.com','gitlab.com','bitbucket.org','vscode.dev','codepen.io',
                 'codesandbox.io','replit.com','jsfiddle.net','leetcode.com',
                 'hackerrank.com','codewars.com'],
  docs:         ['developer.mozilla.org','devdocs.io','stackoverflow.com',
                 'npmjs.com','pypi.org','docs.microsoft.com','docs.aws.amazon.com'],
  productivity: ['notion.so','trello.com','asana.com','linear.app','jira.atlassian.com',
                 'confluence.atlassian.com','figma.com','miro.com','monday.com','clickup.com'],
  learning:     ['coursera.org','udemy.com','khanacademy.org','edx.org','pluralsight.com',
                 'frontendmasters.com','egghead.io','youtube.com/watch'], // yt tutorials
  entertainment:['youtube.com','netflix.com','twitch.tv','hulu.com','disney.com'],
  social:       ['twitter.com','x.com','facebook.com','instagram.com','reddit.com',
                 'tiktok.com','discord.com','snapchat.com','pinterest.com']
};

const DEFAULT_SETTINGS = {
  siteListVersion:         SITE_LIST_VERSION,
  distractionSites:        DISTRACTION_SITES,
  productiveSites:         PRODUCTIVE_SITES,
  neverTrackDomains:       [],
  trackingPausedUntil:     0,
  dataRetentionDays:       90,
  warningThresholdMins:    30,
  loopDetectionVisits:     4,
  loopDetectionWindowMins: 15,
  dailySummaryEnabled:     true,
  notificationsEnabled:    true,
  interventionEnabled:     true,
  strictMode: {
    enabled:        false,
    threshold:      3,       // violations before blocking
    blockedDomains: [],
    perSiteThresholds: {},
    bypassMinutes: 30,
    activeHours: { enabled: false, start: 9, end: 17 },
    hardLockUntilTomorrow: false
  }
};

const ACHIEVEMENT_DEFS = [
  { id: 'first_session',    title: 'First Steps',      desc: 'Logged your first browsing session',          icon: '🎯', secret: false },
  { id: 'focus_60',         title: 'Deep Focus',        desc: '60+ productive minutes in one day',           icon: '⚡', secret: false },
  { id: 'clean_day',        title: 'Crystal Clear',     desc: 'A full day with zero distraction time',       icon: '💎', secret: false },
  { id: 'streak_3',         title: 'Hot Streak',        desc: '3 consecutive good days (score ≥ 70)',        icon: '🔥', secret: false },
  { id: 'streak_7',         title: 'Weekly Warrior',    desc: '7 consecutive good days',                     icon: '💪', secret: false },
  { id: 'streak_30',        title: 'Iron Will',         desc: '30 consecutive good days',                    icon: '⚔️',  secret: true  },
  { id: 'perfect_score',    title: 'Perfect Day',       desc: 'Discipline score of 100',                     icon: '⭐', secret: false },
  { id: 'score_80',         title: 'Laser Focus',       desc: 'Discipline score of 80 or higher',            icon: '🎖️', secret: false },
  { id: 'stay_focused_10',  title: 'Iron Mind',         desc: 'Chose "Stay Focused" 10 times',               icon: '🧠', secret: false },
  { id: 'early_bird',       title: 'Early Bird',        desc: 'Productive time logged before 8 AM',          icon: '🌅', secret: false },
  { id: 'comeback',         title: 'Comeback Kid',      desc: 'Returned after 3+ days away and scored ≥70',  icon: '🔄', secret: true  },
  { id: 'strict_survived',  title: 'Locked In',         desc: 'Enabled Strict Mode and kept it on all day',  icon: '🔒', secret: true  }
];

const GOOD_DAY_THRESHOLD = 70;
const BAD_DAY_THRESHOLD  = 40;
const MIN_SESSION_SEC    = 2;
const WARNING_COOLDOWN   = 10 * 60 * 1000; // 10 min
const ALARM_TICK         = 'tick';
const ALARM_DAILY        = 'daily';
const ICON_URL           = 'icons/icon128.png';

// ─── Runtime State ────────────────────────────────────────────────────────────

let currentSession = null;
// { id, tabId, domain, url, title, startTime, date, hour, isDistraction, isProductive, context }

let activeTabId     = null;
let activeWindowId  = null;
let isWindowFocused = true;
let isIdle          = false;

let recentVisits    = []; // [{ domain, ts }] — sliding window for loop detection
let warnCooldowns   = {}; // domain → last-warn-ts
let tempUnblocked   = new Map(); // domain -> bypass expiry timestamp

// ─── Utilities ────────────────────────────────────────────────────────────────

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDomainList(value) {
  return asArray(value)
    .map(v => String(v).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])
    .filter(Boolean);
}

function normalizeThresholdMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [domain, threshold] of Object.entries(value)) {
    const [safeDomain] = normalizeDomainList([domain]);
    if (safeDomain) out[safeDomain] = numberInRange(threshold, DEFAULT_SETTINGS.strictMode.threshold, 1, 50);
  }
  return out;
}

function numberInRange(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function matchesDomain(domain, patterns) {
  return asArray(patterns).some(d => domain === d || domain.endsWith('.' + d));
}

function matchingDomainRule(domain, patterns) {
  return asArray(patterns).find(d => domain === d || domain.endsWith('.' + d)) || null;
}

function thresholdForDomain(domain, perSiteThresholds, fallback) {
  const matchedRule = matchingDomainRule(domain, Object.keys(perSiteThresholds || {}));
  return matchedRule ? perSiteThresholds[matchedRule] : fallback;
}

function getDateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDays(dk, n) {
  const [y,m,d] = dk.split('-').map(Number);
  const dt = new Date(y, m-1, d+n);
  return getDateKey(dt.getTime());
}

function isTrackable(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

function isTrackingPaused(settings, now = Date.now()) {
  return Number(settings.trackingPausedUntil || 0) > now;
}

function isNeverTracked(domain, settings) {
  return matchesDomain(domain, settings.neverTrackDomains);
}

function strictModeActiveNow(settings, now = new Date()) {
  const sm = settings.strictMode;
  if (!sm.enabled) return false;
  if (!sm.activeHours?.enabled) return true;
  const h = now.getHours();
  const start = sm.activeHours.start;
  const end = sm.activeHours.end;
  if (start === end) return true;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

function formatDur(s) {
  if (!s || s < 0) return '0s';
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s/60), sec = s%60;
  if (m < 60) return sec ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m/60), rm = m%60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function detectContext(domain) {
  for (const [ctx, patterns] of Object.entries(CONTEXT_MAP)) {
    if (patterns.some(p => domain === p || domain.endsWith('.'+p) || domain.includes(p))) return ctx;
  }
  return 'other';
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

async function get(...keys) {
  return chrome.storage.local.get(keys.length === 1 ? keys[0] : keys);
}

function normalizeSettings(settings) {
  const raw = settings && typeof settings === 'object' ? settings : {};
  const strict = raw.strictMode && typeof raw.strictMode === 'object' ? raw.strictMode : {};
  return {
    siteListVersion:         numberInRange(raw.siteListVersion, 0, 0, SITE_LIST_VERSION),
    distractionSites:        normalizeDomainList(raw.distractionSites ?? DEFAULT_SETTINGS.distractionSites),
    productiveSites:         normalizeDomainList(raw.productiveSites ?? DEFAULT_SETTINGS.productiveSites),
    neverTrackDomains:       normalizeDomainList(raw.neverTrackDomains ?? DEFAULT_SETTINGS.neverTrackDomains),
    trackingPausedUntil:     Math.max(0, Number(raw.trackingPausedUntil) || 0),
    dataRetentionDays:       numberInRange(raw.dataRetentionDays, DEFAULT_SETTINGS.dataRetentionDays, 1, 3650),
    warningThresholdMins:    numberInRange(raw.warningThresholdMins, DEFAULT_SETTINGS.warningThresholdMins, 1, 1440),
    loopDetectionVisits:     numberInRange(raw.loopDetectionVisits, DEFAULT_SETTINGS.loopDetectionVisits, 2, 100),
    loopDetectionWindowMins: numberInRange(raw.loopDetectionWindowMins, DEFAULT_SETTINGS.loopDetectionWindowMins, 1, 1440),
    dailySummaryEnabled:     bool(raw.dailySummaryEnabled, DEFAULT_SETTINGS.dailySummaryEnabled),
    notificationsEnabled:    bool(raw.notificationsEnabled, DEFAULT_SETTINGS.notificationsEnabled),
    interventionEnabled:     bool(raw.interventionEnabled, DEFAULT_SETTINGS.interventionEnabled),
    strictMode: {
      enabled:        bool(strict.enabled, DEFAULT_SETTINGS.strictMode.enabled),
      threshold:      numberInRange(strict.threshold, DEFAULT_SETTINGS.strictMode.threshold, 1, 50),
      blockedDomains: normalizeDomainList(strict.blockedDomains ?? DEFAULT_SETTINGS.strictMode.blockedDomains),
      perSiteThresholds: normalizeThresholdMap(strict.perSiteThresholds),
      bypassMinutes:  numberInRange(strict.bypassMinutes, DEFAULT_SETTINGS.strictMode.bypassMinutes, 1, 1440),
      activeHours: {
        enabled: bool(strict.activeHours?.enabled, DEFAULT_SETTINGS.strictMode.activeHours.enabled),
        start:   numberInRange(strict.activeHours?.start, DEFAULT_SETTINGS.strictMode.activeHours.start, 0, 23),
        end:     numberInRange(strict.activeHours?.end, DEFAULT_SETTINGS.strictMode.activeHours.end, 0, 23)
      },
      hardLockUntilTomorrow: bool(strict.hardLockUntilTomorrow, DEFAULT_SETTINGS.strictMode.hardLockUntilTomorrow)
    }
  };
}

async function getSettings() {
  const { settings } = await get('settings');
  return normalizeSettings(settings);
}

async function migrateSettingsIfNeeded() {
  const { settings } = await get('settings');
  if (!settings || typeof settings !== 'object') return null;
  const currentVersion = Number(settings.siteListVersion) || 0;
  if (currentVersion >= SITE_LIST_VERSION) return normalizeSettings(settings);
  const migrated = normalizeSettings({
    ...settings,
    siteListVersion: SITE_LIST_VERSION,
    distractionSites: [...new Set([...normalizeDomainList(settings.distractionSites), ...DISTRACTION_SITES])],
    productiveSites: [...new Set([...normalizeDomainList(settings.productiveSites), ...PRODUCTIVE_SITES])]
  });
  await Q.now('settings', migrated);
  return migrated;
}

async function getSessions(dateKey) {
  const { sessions = [] } = await get('sessions');
  const safeSessions = asArray(sessions).filter(s => s && typeof s === 'object');
  return dateKey ? safeSessions.filter(s => s.date === dateKey) : safeSessions;
}

async function getSessionsWithCurrent(dateKey = null) {
  const sessions = await getSessions(dateKey);
  if (!currentSession) return sessions;
  if (dateKey && currentSession.date !== dateKey) return sessions;
  const duration = Math.max(0, Math.round((Date.now() - currentSession.startTime) / 1000));
  if (duration < MIN_SESSION_SEC) return sessions;
  return [...sessions, {
    id: `${currentSession.id}-live`,
    domain: currentSession.domain,
    url: currentSession.url,
    title: currentSession.title,
    startTime: currentSession.startTime,
    endTime: Date.now(),
    duration,
    date: currentSession.date,
    hour: currentSession.hour,
    isDistraction: currentSession.isDistraction,
    isProductive: currentSession.isProductive,
    context: currentSession.context,
    live: true
  }];
}

async function upsertSession(session) {
  const { sessions = [] } = await get('sessions');
  const settings = await getSettings();
  const safeSessions = asArray(sessions).filter(s => s && typeof s === 'object');
  const idx = safeSessions.findIndex(s => s.id === session.id);
  if (idx >= 0) safeSessions[idx] = session; else safeSessions.push(session);
  const cutoff = Date.now() - settings.dataRetentionDays * 86400000;
  await Q.put('sessions', safeSessions.filter(s => s.startTime > cutoff));
}

async function getGamification() {
  const { gamification } = await get('gamification');
  if (!gamification || typeof gamification !== 'object') {
    return {
      streak: { current: 0, longest: 0, lastGoodDay: null, lastDate: null },
      achievements: [],
      totalFocusedResponses: 0
    };
  }
  return {
    streak: Object.assign({ current: 0, longest: 0, lastGoodDay: null, lastDate: null }, gamification.streak),
    achievements: asArray(gamification.achievements),
    totalFocusedResponses: Number.isFinite(gamification.totalFocusedResponses) ? gamification.totalFocusedResponses : 0
  };
}

function defaultGamification() {
  return {
    streak: { current: 0, longest: 0, lastGoodDay: null, lastDate: null },
    achievements: [],
    totalFocusedResponses: 0
  };
}

async function saveGamification(G) {
  await Q.put('gamification', G);
  return G;
}

async function getStrictViolations() {
  const { strictViolations = {} } = await get('strictViolations');
  return strictViolations && typeof strictViolations === 'object' ? strictViolations : {};
}

async function getPatternHistory() {
  const { patternHistory = [] } = await get('patternHistory');
  return asArray(patternHistory);
}

async function getInterventionLog() {
  const { interventionLog = [] } = await get('interventionLog');
  return asArray(interventionLog);
}

// ─── Session Lifecycle ────────────────────────────────────────────────────────

async function startSession(tabId, url, title = '') {
  if (!isTrackable(url) || isIdle) return;
  const domain = getDomain(url);
  if (!domain) return;

  await endCurrentSession();

  const settings = await getSettings();
  if (isTrackingPaused(settings) || isNeverTracked(domain, settings)) return;
  const isDistraction = matchesDomain(domain, settings.distractionSites);
  const isProductive  = matchesDomain(domain, settings.productiveSites);
  const context       = detectContext(domain);

  currentSession = {
    id: uid(), tabId, domain, url, title: title.slice(0,120),
    startTime: Date.now(), date: getDateKey(), hour: new Date().getHours(),
    isDistraction, isProductive, context
  };

  recentVisits.push({ domain, ts: Date.now() });

  // Pattern + strict mode checks (async, non-blocking)
  Promise.all([
    checkPatterns(domain, settings),
    checkStrictMode(domain, settings)
  ]).catch(() => {});
}

async function endCurrentSession() {
  if (!currentSession) return;
  const endTime  = Date.now();
  const duration = Math.round((endTime - currentSession.startTime) / 1000);
  if (duration >= MIN_SESSION_SEC) {
    await upsertSession({
      id: currentSession.id, domain: currentSession.domain, url: currentSession.url,
      title: currentSession.title, startTime: currentSession.startTime, endTime, duration,
      date: currentSession.date, hour: currentSession.hour,
      isDistraction: currentSession.isDistraction, isProductive: currentSession.isProductive,
      context: currentSession.context
    });
    // Flush immediately on session end so data is never lost
    await Q.flush();
  }
  currentSession = null;
}

// ─── Strict Mode ──────────────────────────────────────────────────────────────

async function checkStrictMode(domain, settings) {
  if (!strictModeActiveNow(settings)) return;
  const bypassUntil = tempUnblocked.get(domain) || 0;
  if (bypassUntil > Date.now()) return;
  tempUnblocked.delete(domain);
  const blocked = settings.strictMode.blockedDomains || [];
  if (matchesDomain(domain, blocked) && activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: 'STRICT_BLOCK', payload: { domain } }).catch(() => {});
  }
}

async function handleIgnoredWarning(domain) {
  const settings = await getSettings();
  if (!strictModeActiveNow(settings)) return;

  const violations = await getStrictViolations();
  violations[domain] = (violations[domain] || 0) + 1;
  await Q.put('strictViolations', violations);

  // Block domain if threshold reached
  const threshold = thresholdForDomain(domain, settings.strictMode.perSiteThresholds, settings.strictMode.threshold);
  if (violations[domain] >= threshold) {
    if (!settings.strictMode.blockedDomains.includes(domain)) {
      settings.strictMode.blockedDomains.push(domain);
      await chrome.storage.local.set({ settings });
      // Notify
      chrome.notifications.create(`blocked-${domain}`, {
        type: 'basic', iconUrl: ICON_URL,
        title: 'Auto Life Logger — Site Blocked',
        message: `${domain} has been blocked in Strict Mode after ${violations[domain]} violations.`,
        priority: 2
      }).catch(() => {});
    }
  }
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

async function checkPatterns(domain, settings) {
  const now      = Date.now();
  const cooldown = warnCooldowns[domain];
  if (cooldown && now - cooldown < WARNING_COOLDOWN) return;

  const windowMs      = settings.loopDetectionWindowMins * 60 * 1000;
  recentVisits        = recentVisits.filter(v => now - v.ts < windowMs);
  const todaySessions = await getSessions(getDateKey());

  const triggered = await runPatternChecks(domain, todaySessions, settings, now, windowMs);
  if (triggered) warnCooldowns[domain] = now;
}

async function runPatternChecks(domain, todaySessions, settings, now, windowMs) {
  const isDistraction = matchesDomain(domain, settings.distractionSites);

  // ── 1. Time Overrun ──────────────────────────────────────────────────────
  if (isDistraction) {
    const totalSecs = todaySessions.filter(s => s.domain === domain).reduce((a, s) => a + s.duration, 0);
    if (Math.floor(totalSecs / 60) >= settings.warningThresholdMins) {
      const msg = `You've spent ${formatDur(totalSecs)} on ${domain} today. That's your limit.`;
      await fireIntervention(domain, 'time', msg, { minutes: Math.round(totalSecs/60) });
      await appendPattern({ type: 'TIME_OVERRUN', domain, minutes: Math.round(totalSecs/60), ts: now, date: getDateKey() });
      return true;
    }
  }

  // ── 2. Distraction Loop ──────────────────────────────────────────────────
  const domainVisits = recentVisits.filter(v => v.domain === domain);
  if (domainVisits.length >= settings.loopDetectionVisits) {
    const msg = `Distraction loop: you've hit ${domain} ${domainVisits.length}× in ${settings.loopDetectionWindowMins} min.`;
    await fireIntervention(domain, 'loop', msg, { count: domainVisits.length });
    await appendPattern({ type: 'DISTRACT_LOOP', domain, count: domainVisits.length, ts: now, date: getDateKey() });
    return true;
  }

  // ── 3. Social Rebound ────────────────────────────────────────────────────
  if (isDistraction && todaySessions.length >= 2) {
    const sorted   = [...todaySessions].sort((a,b) => b.startTime - a.startTime);
    const prev     = sorted[0];
    const gapMs    = now - (prev?.endTime || 0);
    if (prev?.isProductive && gapMs < 3 * 60000) {
      const msg = `You left ${prev.domain} and opened ${domain}. Don't break your flow!`;
      await fireIntervention(domain, 'rebound', msg, { from: prev.domain });
      await appendPattern({ type: 'SOCIAL_REBOUND', from: prev.domain, to: domain, ts: now, date: getDateKey() });
      return true;
    }
  }

  // ── 4. Time Leak (short repeated flashes, < 3 min each, same domain) ────
  if (isDistraction) {
    const shortVisits = todaySessions.filter(s => s.domain === domain && s.duration < 180);
    if (shortVisits.length >= 5) {
      const msg = `${domain} is draining you in small doses — ${shortVisits.length} quick visits today.`;
      await fireIntervention(domain, 'leak', msg, { count: shortVisits.length });
      await appendPattern({ type: 'TIME_LEAK', domain, count: shortVisits.length, ts: now, date: getDateKey() });
      return true;
    }
  }

  return false;
}

async function appendPattern(p) {
  const { patternHistory = [] } = await get('patternHistory');
  const trimmed = [...patternHistory, p].slice(-500);
  await Q.put('patternHistory', trimmed);
}

// ─── Intervention Engine ──────────────────────────────────────────────────────

async function fireIntervention(domain, reason, message, meta = {}) {
  const settings = await getSettings();
  if (!settings.interventionEnabled) return;

  if (settings.notificationsEnabled) {
    chrome.notifications.create(`warn-${domain}-${Date.now()}`, {
      type: 'basic', iconUrl: ICON_URL,
      title: 'Stay Focused — Auto Life Logger', message, priority: 1
    }).catch(() => {});
  }

  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      type: 'SHOW_INTERVENTION', payload: { domain, reason, message, ...meta }
    }).catch(() => {});
  }
}

async function handleInterventionResponse(domain, reason, response) {
  const entry = { domain, reason, response, ts: Date.now(), date: getDateKey() };
  const log   = await getInterventionLog();
  await Q.put('interventionLog', [...log, entry].slice(-200));

  if (response === 'ignored') await handleIgnoredWarning(domain);

  if (response === 'focused') {
    const G = await getGamification();
    G.totalFocusedResponses = (G.totalFocusedResponses || 0) + 1;
    await saveGamification(G);
    await checkAchievements({ totalFocusedResponses: G.totalFocusedResponses });
  }
}

// ─── Discipline Score ─────────────────────────────────────────────────────────
// 40 pts productive ratio + 30 pts low distraction + 20 pts no loops + 10 pts responses

async function computeScore(dateKey) {
  const sessions  = await getSessions(dateKey);
  const patterns  = (await getPatternHistory()).filter(p => p.date === dateKey);
  const log       = (await getInterventionLog()).filter(r => r.date === dateKey);

  if (!sessions.length) return null;

  const total      = sessions.reduce((a, s) => a + s.duration, 0);
  const distract   = sessions.filter(s => s.isDistraction).reduce((a,s) => a + s.duration, 0);
  const productive = sessions.filter(s => s.isProductive ).reduce((a,s) => a + s.duration, 0);
  const loops      = patterns.filter(p => p.type === 'DISTRACT_LOOP').length;
  const focused    = log.filter(r => r.response === 'focused').length;
  const ignored    = log.filter(r => r.response === 'ignored').length;
  const respTotal  = focused + ignored;

  const prodPts   = Math.round((total > 0 ? productive  / total : 0) * 40);
  const disPts    = Math.round((total > 0 ? (1 - distract/total) : 1) * 30);
  const loopPts   = Math.max(0, 20 - loops * 4);
  const respPts   = respTotal > 0 ? Math.round((focused / respTotal) * 10) : 10;
  const score     = Math.min(100, prodPts + disPts + loopPts + respPts);

  const obj = {
    score, date: dateKey, computedAt: Date.now(),
    components: { prodPts, disPts, loopPts, respPts },
    stats: { total, distract, productive, loops, focused, ignored }
  };

  const { disciplineScores = {} } = await get('disciplineScores');
  disciplineScores[dateKey] = obj;
  await Q.put('disciplineScores', disciplineScores);
  return obj;
}

// ─── Gamification: Streaks ────────────────────────────────────────────────────

async function updateStreak(dateKey, score) {
  const G = await getGamification();

  const isGood = score >= GOOD_DAY_THRESHOLD;
  const isBad  = score <  BAD_DAY_THRESHOLD;

  if (G.streak.lastDate === dateKey) {
    // Already updated today — only downgrade if it went bad
    if (isBad) { G.streak.current = 0; await saveGamification(G); }
    return G;
  }

  if (isGood) {
    const prevDate   = G.streak.lastGoodDay;
    const yesterday  = addDays(dateKey, -1);
    const continuous = prevDate === yesterday;
    G.streak.current    = continuous ? G.streak.current + 1 : 1;
    G.streak.lastGoodDay = dateKey;
    G.streak.longest    = Math.max(G.streak.longest, G.streak.current);
  } else if (isBad) {
    G.streak.current = 0;
  }
  G.streak.lastDate = dateKey;
  await saveGamification(G);
  return G;
}

// ─── Gamification: Achievements ──────────────────────────────────────────────

async function checkAchievements(ctx = {}) {
  const G        = await getGamification();
  const unlocked = new Set(G.achievements.map(a => a.id));
  const newOnes  = [];

  const try_ = async (id, condition) => {
    if (unlocked.has(id)) return;
    if (await condition()) {
      const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
      if (!def) return;
      const entry = { ...def, unlockedAt: Date.now(), date: getDateKey() };
      G.achievements.push(entry);
      newOnes.push(entry);
    }
  };

  // first_session
  await try_('first_session', async () => {
    const { sessions = [] } = await get('sessions');
    return sessions.length > 0;
  });

  // focus_60 — 60+ productive min today
  if (ctx.productive != null) {
    await try_('focus_60', async () => ctx.productive >= 3600);
  }

  // clean_day — zero distraction
  if (ctx.distract != null && ctx.total != null) {
    await try_('clean_day', async () => ctx.total > 600 && ctx.distract === 0);
  }

  // score_80, perfect_score
  if (ctx.score != null) {
    await try_('score_80',       async () => ctx.score >= 80);
    await try_('perfect_score',  async () => ctx.score === 100);
  }

  // streak milestones
  if (ctx.streak != null) {
    await try_('streak_3',  async () => ctx.streak >= 3);
    await try_('streak_7',  async () => ctx.streak >= 7);
    await try_('streak_30', async () => ctx.streak >= 30);
  }

  // stay_focused_10
  if (ctx.totalFocusedResponses != null) {
    await try_('stay_focused_10', async () => ctx.totalFocusedResponses >= 10);
  }

  // early_bird
  if (ctx.earlyProductiveHour != null) {
    await try_('early_bird', async () => ctx.earlyProductiveHour < 8);
  }

  // comeback — away 3+ days then scored ≥70
  if (ctx.daysSinceLastSession != null && ctx.score != null) {
    await try_('comeback', async () => ctx.daysSinceLastSession >= 3 && ctx.score >= 70);
  }

  await saveGamification(G);

  // Notify + send toast for each new achievement
  for (const ach of newOnes) {
    chrome.notifications.create(`ach-${ach.id}`, {
      type: 'basic', iconUrl: ICON_URL,
      title: `Achievement Unlocked: ${ach.title}`,
      message: `${ach.icon} ${ach.desc}`, priority: 0
    }).catch(() => {});
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, {
        type: 'ACHIEVEMENT_TOAST', payload: ach
      }).catch(() => {});
    }
  }

  return newOnes;
}

// ─── Insight Engine ───────────────────────────────────────────────────────────

function generateInsight({ total, distract, productive, patterns, sessions, streak, peakDistractHour, topDistractionSite }) {
  const distractRatio  = total > 0 ? distract / total  : 0;
  const productiveRatio= total > 0 ? productive / total : 0;
  const loops          = patterns.filter(p => p.type === 'DISTRACT_LOOP').length;
  const rebounds       = patterns.filter(p => p.type === 'SOCIAL_REBOUND').length;
  const leaks          = patterns.filter(p => p.type === 'TIME_LEAK').length;

  if (total < 300) return 'Light browsing today — less than 5 minutes tracked.';

  if (productiveRatio > 0.85 && loops === 0) {
    if (streak >= 3) return `${streak}-day streak. You're building real momentum — keep protecting your time.`;
    return 'Strong session. Productive time dominated. Fewer distractions = deeper work.';
  }

  if (loops >= 3) {
    const loopDomain = patterns.filter(p => p.type === 'DISTRACT_LOOP').sort((a,b) => b.count - a.count)[0]?.domain;
    return `You entered a distraction loop ${loops} times${loopDomain ? ` — mostly on ${loopDomain}` : ''}. Close the tab before you "just check" again.`;
  }

  if (rebounds >= 2) {
    const from = patterns.filter(p => p.type === 'SOCIAL_REBOUND')[0]?.from;
    return `You opened social media right after working${from ? ` (after ${from})` : ''} ${rebounds} times. Next time, take a water break instead.`;
  }

  if (leaks >= 3) {
    const leakDomain = patterns.filter(p => p.type === 'TIME_LEAK')[0]?.domain;
    return `${leakDomain || 'A distracting site'} is bleeding your focus in short bursts. Block it or set a hard limit.`;
  }

  if (peakDistractHour != null) {
    const h = peakDistractHour;
    const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    return `Your peak distraction time is ${h}:00 ${period}. Consider blocking distracting sites during that window.`;
  }

  if (topDistractionSite && distractRatio > 0.3) {
    const pct = Math.round(distractRatio * 100);
    return `${pct}% of your time went to ${topDistractionSite}. Set a ${Math.round(total/3600 * 0.2 * 60)}-minute hard limit tomorrow.`;
  }

  if (distractRatio > 0.5) {
    return 'Over half your browsing time was distracting. What pulled you off course today?';
  }

  const workMinutes = sessions.filter(s => s.isProductive).map(s => s.duration/60);
  if (workMinutes.length && Math.max(...workMinutes) < 30) {
    return "You're not sustaining focus for more than 30 minutes. Try working in strict 25-minute blocks.";
  }

  return `You had ${formatDur(productive)} of productive time. Push that number higher tomorrow.`;
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

async function generateDailySummary(dateKey) {
  const sessions = await getSessions(dateKey);
  if (!sessions.length) return null;

  const settings  = await getSettings();
  const patterns  = (await getPatternHistory()).filter(p => p.date === dateKey);
  const scoreObj  = await computeScore(dateKey);

  const domainMap = {};
  let total = 0, distract = 0, productive = 0;
  for (const s of sessions) {
    if (!domainMap[s.domain]) domainMap[s.domain] = { domain: s.domain, duration: 0, visits: 0, isDistraction: s.isDistraction, isProductive: s.isProductive };
    domainMap[s.domain].duration += s.duration;
    domainMap[s.domain].visits++;
    total    += s.duration;
    if (s.isDistraction) distract   += s.duration;
    if (s.isProductive)  productive += s.duration;
  }

  const topSites = Object.values(domainMap).sort((a,b) => b.duration - a.duration).slice(0,10);
  const topDistSite = topSites.find(s => s.isDistraction)?.domain;

  // Peak distraction hour
  const hourTotals = {};
  for (const s of sessions.filter(s => s.isDistraction)) {
    hourTotals[s.hour] = (hourTotals[s.hour]||0) + s.duration;
  }
  const peakDistractHour = Object.entries(hourTotals).sort((a,b) => b[1]-a[1])[0]?.[0];

  // Streak + gamification
  const G = await updateStreak(dateKey, scoreObj?.score ?? 0);

  // Check early bird
  const earlyHour = sessions.filter(s => s.isProductive).map(s => s.hour).sort()[0];

  // Days since last session
  const allSessions = await getSessions();
  const sorted      = allSessions.filter(s => s.date < dateKey).sort((a,b) => b.date.localeCompare(a.date));
  const lastDate    = sorted[0]?.date;
  const daysSince   = lastDate
    ? Math.round((new Date(dateKey) - new Date(lastDate)) / 86400000) - 1
    : 999;

  await checkAchievements({
    score:                scoreObj?.score,
    productive, distract, total,
    streak:               G.streak.current,
    totalFocusedResponses: G.totalFocusedResponses,
    earlyProductiveHour:  earlyHour,
    daysSinceLastSession: daysSince
  });

  const insight = generateInsight({
    total, distract, productive, patterns, sessions,
    streak: G.streak.current,
    peakDistractHour: peakDistractHour != null ? parseInt(peakDistractHour) : null,
    topDistractionSite: topDistSite
  });

  const summary = {
    date: dateKey, total, distract, productive,
    topSites, totalSessions: sessions.length,
    uniqueDomains: Object.keys(domainMap).length,
    patternCount: patterns.length,
    disciplineScore: scoreObj?.score ?? null,
    streak: G.streak.current, insight, generatedAt: Date.now()
  };

  const { dailySummaries = {} } = await get('dailySummaries');
  dailySummaries[dateKey] = summary;
  await Q.put('dailySummaries', dailySummaries);

  if (settings.notificationsEnabled && settings.dailySummaryEnabled) {
    const scoreStr = scoreObj ? ` · Score: ${scoreObj.score}/100` : '';
    const streakStr = G.streak.current > 1 ? ` · 🔥 ${G.streak.current}-day streak!` : '';
    chrome.notifications.create(`summary-${dateKey}`, {
      type: 'basic', iconUrl: ICON_URL,
      title: 'Auto Life Logger — Daily Summary',
      message: `${formatDur(total)} total${scoreStr}${streakStr}`,
      priority: 0
    }).catch(() => {});
  }

  return summary;
}

// ─── Today Stats (for popup) ──────────────────────────────────────────────────

async function buildTodayStats() {
  const dateKey  = getDateKey();
  const sessions = await getSessionsWithCurrent(dateKey);
  const settings = await getSettings();
  const patterns = (await getPatternHistory()).filter(p => p.date === dateKey);
  const G        = await getGamification();
  const { disciplineScores = {} } = await get('disciplineScores');
  const score    = disciplineScores[dateKey];

  const domainMap = {};
  let total = 0, distract = 0, productive = 0;
  for (const s of sessions) {
    if (!domainMap[s.domain]) domainMap[s.domain] = { domain: s.domain, duration: 0, visits: 0, isDistraction: s.isDistraction, isProductive: s.isProductive };
    domainMap[s.domain].duration += s.duration;
    domainMap[s.domain].visits++;
    total    += s.duration;
    if (s.isDistraction) distract   += s.duration;
    if (s.isProductive)  productive += s.duration;
  }

  const topSites = Object.values(domainMap).sort((a,b) => b.duration - a.duration).slice(0,5);

  // Active loops
  const now = Date.now();
  const windowMs = settings.loopDetectionWindowMins * 60000;
  const fresh = recentVisits.filter(v => now - v.ts < windowMs);
  const counts = {};
  for (const v of fresh) counts[v.domain] = (counts[v.domain]||0)+1;
  const loopAlerts = Object.entries(counts)
    .filter(([,c]) => c >= settings.loopDetectionVisits)
    .map(([domain,count]) => ({ domain, count }));

  // Recent achievements (last 3)
  const recentAch = [...G.achievements].sort((a,b) => b.unlockedAt - a.unlockedAt).slice(0,3);

  return {
    total, distract, productive,
    topSites, totalSessions: sessions.length,
    uniqueDomains: Object.keys(domainMap).length,
    loopAlerts, patternCount: patterns.length,
    disciplineScore: score?.score ?? null,
    streak: G.streak,
    recentAchievements: recentAch,
    currentDomain: currentSession?.domain ?? null,
    currentIsDistraction: currentSession?.isDistraction ?? false,
    currentDuration: currentSession ? Math.max(0, Math.round((Date.now() - currentSession.startTime) / 1000)) : 0,
    trackingPausedUntil: settings.trackingPausedUntil,
    strictModeEnabled: settings.strictMode.enabled
  };
}

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || typeof msg !== 'object') return false;
  const { type, payload } = msg;

  const async_ = fn => { fn().then(data => reply({ ok: true, data })).catch(e => reply({ ok: false, error: String(e) })); return true; };

  switch (type) {
    case 'GET_TODAY_STATS':       return async_(() => buildTodayStats());
    case 'GET_CURRENT_SESSION':   reply({ ok: true, data: currentSession }); return false;
    case 'GET_SESSIONS':          return async_(() => payload?.includeCurrent ? getSessionsWithCurrent(payload?.dateKey ?? null) : getSessions(payload?.dateKey ?? null));
    case 'GET_DAILY_SUMMARIES':   return async_(async () => { const { dailySummaries = {} } = await get('dailySummaries'); return dailySummaries; });
    case 'GET_SETTINGS':          return async_(() => getSettings());
    case 'SAVE_SETTINGS':         return async_(async () => {
      const normalized = normalizeSettings(payload);
      await Q.now('settings', normalized);
      if (currentSession && (isTrackingPaused(normalized) || isNeverTracked(currentSession.domain, normalized))) {
        await endCurrentSession();
      }
      return normalized;
    });
    case 'RESET_SETTINGS':        return async_(async () => {
      await Q.now('settings', DEFAULT_SETTINGS);
      return normalizeSettings(DEFAULT_SETTINGS);
    });
    case 'GET_DISCIPLINE_SCORES': return async_(async () => { const { disciplineScores = {} } = await get('disciplineScores'); return disciplineScores; });
    case 'GET_PATTERN_HISTORY':   return async_(() => getPatternHistory());
    case 'GET_INTERVENTION_LOG':  return async_(() => getInterventionLog());
    case 'GET_GAMIFICATION':      return async_(() => getGamification());
    case 'GENERATE_SUMMARY':      return async_(() => generateDailySummary(payload?.dateKey ?? getDateKey()));
    case 'COMPUTE_SCORE':         return async_(() => computeScore(payload?.dateKey ?? getDateKey()));
    case 'INTERVENTION_RESPONSE': return async_(async () => {
      if (!payload?.domain || !payload?.reason || !payload?.response) return false;
      await handleInterventionResponse(payload.domain, payload.reason, payload.response);
      return true;
    });
    case 'STRICT_UNBLOCK_TEMP':   return async_(async () => {
      if (!payload?.domain) return false;
      const settings = await getSettings();
      if (settings.strictMode.hardLockUntilTomorrow) return false;
      tempUnblocked.set(payload.domain, Date.now() + settings.strictMode.bypassMinutes * 60000);
      return true;
    });
    case 'OPEN_DASHBOARD':        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }).catch(() => {}); reply({ ok: true }); return false;
    case 'CLEAR_DATA':            return async_(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ settings: DEFAULT_SETTINGS, sessions: [], dailySummaries: {}, patternHistory: [], interventionLog: [], disciplineScores: {}, gamification: defaultGamification(), strictViolations: {} });
      return true;
    });
    case 'ACTIVITY_PING': reply({ ok: true }); return false; // no-op, keeps content.js happy
    default: return false; // unknown types — no response needed
  }
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { settings } = await get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: DEFAULT_SETTINGS, sessions: [], dailySummaries: {},
      patternHistory: [], interventionLog: [], disciplineScores: {},
      gamification: defaultGamification(), strictViolations: {}
    });
  } else {
    await migrateSettingsIfNeeded();
  }
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') }).catch(() => {});
  }
});

// ─── Tab / Window Listeners ───────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (!isWindowFocused || isIdle) return;
  activeTabId = tabId; activeWindowId = windowId;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) await startSession(tabId, tab.url, tab.title || '');
  } catch { /* tab closed */ }
});

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (tabId !== activeTabId || change.status !== 'complete' || !isWindowFocused) return;
  if (tab.url) await startSession(tabId, tab.url, tab.title || '');
});

chrome.tabs.onRemoved.addListener(async tabId => {
  if (tabId === activeTabId) { await endCurrentSession(); activeTabId = null; }
});

chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    await endCurrentSession();
  } else {
    isWindowFocused = true; activeWindowId = windowId;
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) { activeTabId = tab.id; if (tab.url) await startSession(tab.id, tab.url, tab.title || ''); }
    } catch { /* ignore */ }
  }
});

// Idle detection
chrome.idle.setDetectionInterval(60); // 60 s threshold
chrome.idle.onStateChanged.addListener(async state => {
  if (state === 'idle' || state === 'locked') {
    isIdle = true;
    await endCurrentSession();
  } else {
    isIdle = false;
    if (isWindowFocused && activeTabId) {
      try {
        const tab = await chrome.tabs.get(activeTabId);
        if (tab.url) await startSession(activeTabId, tab.url, tab.title || '');
      } catch { /* ignore */ }
    }
  }
});

// ─── Alarms ───────────────────────────────────────────────────────────────────

chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 });

// Daily summary at midnight + 1 min
(function scheduleDailyAlarm() {
  const now = new Date();
  const next = new Date(now); next.setHours(24, 1, 0, 0);
  chrome.alarms.create(ALARM_DAILY, { delayInMinutes: (next - now) / 60000, periodInMinutes: 1440 });
})();

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === ALARM_TICK) {
    await Q.flush(); // wait for any in-flight storage writes
    // Prune visit window
    const { settings } = await get('settings');
    const windowMs = ((settings?.loopDetectionWindowMins) || 15) * 60000;
    recentVisits = recentVisits.filter(v => Date.now() - v.ts < windowMs);
    // Re-check pattern for active distraction session
    if (currentSession?.isDistraction) {
      const s = await getSettings();
      checkPatterns(currentSession.domain, s).catch(() => {});
    }
  }
  if (alarm.name === ALARM_DAILY) {
    const yesterday = addDays(getDateKey(), -1);
    await generateDailySummary(yesterday);
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const { settings } = await get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: DEFAULT_SETTINGS, sessions: [], dailySummaries: {},
      patternHistory: [], interventionLog: [], disciplineScores: {},
      gamification: null, strictViolations: {}
    });
  } else {
    await migrateSettingsIfNeeded();
  }
  // Start tracking current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && isTrackable(tab.url)) {
      activeTabId = tab.id;
      await startSession(tab.id, tab.url, tab.title || '');
    }
  } catch { /* no tab */ }
}

boot();
