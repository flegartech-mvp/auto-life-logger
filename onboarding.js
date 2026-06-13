'use strict';

const FALLBACK_DISTRACTIONS = [
  'youtube.com','reddit.com','x.com','twitter.com','facebook.com','instagram.com',
  'tiktok.com','twitch.tv','netflix.com','discord.com','pinterest.com','snapchat.com',
  'threads.net','bsky.app','linkedin.com','web.whatsapp.com','telegram.org','quora.com',
  'medium.com','substack.com','news.ycombinator.com','producthunt.com','soundcloud.com',
  'spotify.com','primevideo.com','max.com','espn.com','fandom.com','amazon.com','ebay.com'
];
const FALLBACK_PRODUCTIVE = [
  'github.com','gitlab.com','stackoverflow.com','developer.mozilla.org','docs.google.com',
  'notion.so','figma.com','linear.app','jira.atlassian.com','trello.com','asana.com',
  'npmjs.com','pypi.org','vscode.dev','codepen.io','replit.com','leetcode.com',
  'coursera.org','udemy.com','khanacademy.org','edx.org','freecodecamp.org',
  'codecademy.com','arxiv.org','scholar.google.com','learn.microsoft.com',
  'docs.aws.amazon.com','cloud.google.com','web.dev','miro.com','airtable.com',
  'slack.com','teams.microsoft.com','zoom.us','drive.google.com','calendar.google.com'
];

let settings = null;

function msg(type, payload) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, r => {
      if (chrome.runtime.lastError || !r?.ok) {
        showStatus(chrome.runtime.lastError?.message || r?.error || 'Setup failed.');
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

function showStatus(text) {
  const box = document.getElementById('statusBox');
  box.textContent = text;
  box.style.display = 'block';
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

function readNumber(id, fallback, min, max) {
  const n = Number(document.getElementById(id).value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

async function finish() {
  const next = {
    ...settings,
    distractionSites: lines('distractionSites'),
    productiveSites: lines('productiveSites'),
    notificationsEnabled: document.getElementById('notificationsEnabled').checked,
    interventionEnabled: document.getElementById('interventionEnabled').checked,
    warningThresholdMins: readNumber('warningThresholdMins', 30, 1, 1440),
    loopDetectionVisits: readNumber('loopDetectionVisits', 4, 2, 100),
    loopDetectionWindowMins: readNumber('loopDetectionWindowMins', 15, 1, 1440),
    strictMode: {
      ...(settings.strictMode || {}),
      enabled: document.getElementById('strictEnabled').checked,
      threshold: readNumber('strictThreshold', 3, 1, 50)
    }
  };
  const saved = await msg('SAVE_SETTINGS', next);
  if (!saved) return;
  showStatus('Setup saved. Opening your dashboard...');
  setTimeout(() => location.href = chrome.runtime.getURL('dashboard.html'), 500);
}

document.getElementById('finishBtn').addEventListener('click', finish);
document.getElementById('optionsBtn').addEventListener('click', () => location.href = chrome.runtime.getURL('options.html'));
document.querySelectorAll('.toggle-row').forEach(row => {
  const input = row.querySelector('input');
  const label = row.querySelector('.tl')?.textContent?.trim();
  if (input && label && !input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
});

(async function boot() {
  settings = await msg('GET_SETTINGS') || {};
  setLines('distractionSites', settings.distractionSites?.length ? settings.distractionSites : FALLBACK_DISTRACTIONS);
  setLines('productiveSites', settings.productiveSites?.length ? settings.productiveSites : FALLBACK_PRODUCTIVE);
  document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled ?? true;
  document.getElementById('interventionEnabled').checked = settings.interventionEnabled ?? true;
  document.getElementById('strictEnabled').checked = settings.strictMode?.enabled ?? false;
  document.getElementById('warningThresholdMins').value = settings.warningThresholdMins ?? 30;
  document.getElementById('loopDetectionVisits').value = settings.loopDetectionVisits ?? 4;
  document.getElementById('loopDetectionWindowMins').value = settings.loopDetectionWindowMins ?? 15;
  document.getElementById('strictThreshold').value = settings.strictMode?.threshold ?? 3;
})();
