'use strict';

const DEFAULT_SETTINGS = {
  siteListVersion: 2,
  distractionSites: [
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
  ],
  productiveSites: [
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
  ],
  neverTrackDomains: [],
  trackingPausedUntil: 0,
  dataRetentionDays: 90,
  warningThresholdMins: 30,
  loopDetectionVisits: 4,
  loopDetectionWindowMins: 15,
  dailySummaryEnabled: true,
  notificationsEnabled: true,
  interventionEnabled: true,
  strictMode: {
    enabled: false,
    threshold: 3,
    blockedDomains: [],
    perSiteThresholds: {},
    bypassMinutes: 30,
    activeHours: { enabled: false, start: 9, end: 17 },
    hardLockUntilTomorrow: false
  }
};

let settings = DEFAULT_SETTINGS;

function msg(type, payload) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, r => {
      if (chrome.runtime.lastError || !r?.ok) {
        showStatus(chrome.runtime.lastError?.message || r?.error || 'Action failed');
        resolve(null);
        return;
      }
      resolve(r.data ?? null);
    });
  });
}

function lines(id) {
  const seen = new Set();
  return document.getElementById(id).value
    .split('\n')
    .map(normalizeDomain)
    .filter(domain => {
      if (!domain || seen.has(domain)) return false;
      seen.add(domain);
      return true;
    });
}

function setLines(id, values) {
  document.getElementById(id).value = (values || []).join('\n');
}

function toDatetimeLocal(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  return value ? new Date(value).getTime() : 0;
}

function thresholdsToText(map) {
  return Object.entries(map || {}).map(([domain, threshold]) => `${domain}, ${threshold}`).join('\n');
}

function textToThresholds(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const [domainRaw, value] = line.split(',').map(s => s?.trim());
    const domain = normalizeDomain(domainRaw);
    const n = Number(value);
    if (domain && Number.isFinite(n)) out[domain.toLowerCase()] = Math.max(1, Math.round(n));
  }
  return out;
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/,+$/, '');
}

function readNumber(id, fallback, min, max) {
  const n = Number(document.getElementById(id).value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function render() {
  document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
  document.getElementById('interventionEnabled').checked = settings.interventionEnabled;
  document.getElementById('dailySummaryEnabled').checked = settings.dailySummaryEnabled;
  document.getElementById('trackingPausedUntil').value = toDatetimeLocal(settings.trackingPausedUntil);
  document.getElementById('dataRetentionDays').value = settings.dataRetentionDays || 90;
  setLines('neverTrackDomains', settings.neverTrackDomains);
  setLines('distractionSites', settings.distractionSites);
  setLines('productiveSites', settings.productiveSites);

  const sm = settings.strictMode || DEFAULT_SETTINGS.strictMode;
  document.getElementById('strictEnabled').checked = sm.enabled;
  document.getElementById('strictThreshold').value = sm.threshold || 3;
  document.getElementById('bypassMinutes').value = sm.bypassMinutes || 30;
  document.getElementById('strictHoursEnabled').checked = !!sm.activeHours?.enabled;
  document.getElementById('strictStart').value = sm.activeHours?.start ?? 9;
  document.getElementById('strictEnd').value = sm.activeHours?.end ?? 17;
  document.getElementById('hardLockUntilTomorrow').checked = !!sm.hardLockUntilTomorrow;
  document.getElementById('perSiteThresholds').value = thresholdsToText(sm.perSiteThresholds);
}

function readSettings() {
  const sm = settings.strictMode || {};
  return {
    ...settings,
    notificationsEnabled: document.getElementById('notificationsEnabled').checked,
    interventionEnabled: document.getElementById('interventionEnabled').checked,
    dailySummaryEnabled: document.getElementById('dailySummaryEnabled').checked,
    trackingPausedUntil: fromDatetimeLocal(document.getElementById('trackingPausedUntil').value),
    dataRetentionDays: readNumber('dataRetentionDays', 90, 1, 3650),
    neverTrackDomains: lines('neverTrackDomains'),
    distractionSites: lines('distractionSites'),
    productiveSites: lines('productiveSites'),
    strictMode: {
      ...sm,
      enabled: document.getElementById('strictEnabled').checked,
      threshold: readNumber('strictThreshold', 3, 1, 50),
      bypassMinutes: readNumber('bypassMinutes', 30, 1, 1440),
      activeHours: {
        enabled: document.getElementById('strictHoursEnabled').checked,
        start: readNumber('strictStart', 0, 0, 23),
        end: readNumber('strictEnd', 0, 0, 23)
      },
      hardLockUntilTomorrow: document.getElementById('hardLockUntilTomorrow').checked,
      perSiteThresholds: textToThresholds(document.getElementById('perSiteThresholds').value)
    }
  };
}

async function save() {
  const saved = await msg('SAVE_SETTINGS', readSettings());
  if (saved) {
    settings = saved;
    render();
    showStatus('Settings saved.');
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showStatus(text) {
  const box = document.getElementById('statusBox');
  box.textContent = text;
  box.style.display = 'block';
}

document.getElementById('saveBtn').addEventListener('click', save);
document.querySelectorAll('.toggle-row').forEach(row => {
  const input = row.querySelector('input');
  const label = row.querySelector('.tl')?.textContent?.trim();
  if (input && label && !input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  document.getElementById('trackingPausedUntil').value = '';
});
document.querySelectorAll('[data-pause]').forEach(btn => btn.addEventListener('click', () => {
  document.getElementById('trackingPausedUntil').value = toDatetimeLocal(Date.now() + Number(btn.dataset.pause) * 60000);
}));
document.getElementById('exportSettingsBtn').addEventListener('click', () => downloadJson('auto-life-logger-settings.json', { settings: readSettings() }));
document.getElementById('exportAllBtn').addEventListener('click', () => chrome.storage.local.get(null, data => downloadJson('auto-life-logger-backup.json', data)));
document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
  if (!confirm('Reset settings to defaults? Your browsing history will remain.')) return;
  settings = await msg('RESET_SETTINGS') || DEFAULT_SETTINGS;
  render();
  showStatus('Settings reset.');
});
document.getElementById('clearDataBtn').addEventListener('click', async () => {
  if (!confirm('Permanently delete all local extension data?')) return;
  await msg('CLEAR_DATA');
  settings = await msg('GET_SETTINGS') || DEFAULT_SETTINGS;
  render();
  showStatus('All local data deleted.');
});
document.getElementById('importSettingsFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = parsed.settings || parsed;
    settings = await msg('SAVE_SETTINGS', imported) || settings;
    render();
    showStatus('Settings imported.');
  } catch {
    showStatus('Could not import that JSON file.');
  }
});

(async function boot() {
  settings = await msg('GET_SETTINGS') || DEFAULT_SETTINGS;
  render();
})();
