const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { expect, test } = require('playwright/test');

const root = path.resolve(__dirname, '..');
const pageUrl = file => pathToFileURL(path.join(root, file)).href;
fs.mkdirSync(path.join(root, 'output', 'playwright'), { recursive: true });

const targetViewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

function collectSeriousErrors(page) {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
  expect(overflow).toBeLessThanOrEqual(2);
}

async function installChromeMock(page) {
  await page.addInitScript(() => {
    const pad = n => String(n).padStart(2, '0');
    const dateKey = ts => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const today = dateKey(Date.now());
    const yesterday = dateKey(Date.now() - 86400000);
    const settings = {
      notificationsEnabled: true,
      interventionEnabled: true,
      dailySummaryEnabled: true,
      warningThresholdMins: 25,
      loopDetectionVisits: 4,
      loopDetectionWindowMins: 15,
      dataRetentionDays: 90,
      trackingPausedUntil: 0,
      neverTrackDomains: ['bank.example'],
      distractionSites: ['youtube.com', 'reddit.com'],
      productiveSites: ['github.com', 'developer.mozilla.org'],
      strictMode: {
        enabled: true,
        threshold: 3,
        blockedDomains: ['reddit.com'],
        perSiteThresholds: { 'youtube.com': 2 },
        bypassMinutes: 30,
        activeHours: { enabled: false, start: 9, end: 17 },
        hardLockUntilTomorrow: false
      }
    };
    const sessions = [
      { id: '1', domain: 'github.com', duration: 3600, date: today, hour: 9, isProductive: true, isDistraction: false, context: 'coding', startTime: Date.now() - 7200000, endTime: Date.now() - 3600000 },
      { id: '2', domain: 'developer.mozilla.org', duration: 1800, date: today, hour: 10, isProductive: true, isDistraction: false, context: 'docs', startTime: Date.now() - 3500000, endTime: Date.now() - 1700000 },
      { id: '3', domain: 'youtube.com', duration: 950, date: today, hour: 12, isProductive: false, isDistraction: true, context: 'entertainment', startTime: Date.now() - 1600000, endTime: Date.now() - 650000 },
      { id: '4', domain: 'github.com', duration: 2200, date: yesterday, hour: 14, isProductive: true, isDistraction: false, context: 'coding', startTime: Date.now() - 90000000, endTime: Date.now() - 87800000 }
    ];
    const summary = {
      date: today,
      total: 6350,
      productive: 5400,
      distract: 950,
      uniqueDomains: 3,
      totalSessions: 3,
      patternCount: 1,
      disciplineScore: 81,
      streak: 4,
      insight: 'Productive time dominated today. Keep protecting the first hour.',
      topSites: [
        { domain: 'github.com', duration: 3600 },
        { domain: 'developer.mozilla.org', duration: 1800 },
        { domain: 'youtube.com', duration: 950 }
      ]
    };
    const scores = {
      [today]: { score: 81, components: { prodPts: 34, disPts: 25, loopPts: 18, respPts: 4 } },
      [yesterday]: { score: 76, components: { prodPts: 32, disPts: 24, loopPts: 20, respPts: 0 } }
    };
    const patterns = [
      { type: 'DISTRACT_LOOP', domain: 'youtube.com', count: 4, ts: Date.now() - 300000, date: today }
    ];
    const gamification = {
      streak: { current: 4, longest: 6 },
      achievements: [{ id: 'first_session', title: 'First Steps', desc: 'Logged your first session', icon: '*', unlockedAt: Date.now() - 100000 }],
      totalFocusedResponses: 8
    };
    const interventionLog = [
      { response: 'focused', date: today },
      { response: 'ignored', date: today },
      { response: 'focused', date: today }
    ];

    const respond = (type, payload) => {
      switch (type) {
        case 'GET_TODAY_STATS':
          return { ...summary, topSites: summary.topSites, totalSessions: 3, loopAlerts: patterns, recentAchievements: gamification.achievements, currentDomain: 'github.com', currentDuration: 420, currentIsDistraction: false, strictModeEnabled: true };
        case 'GET_SESSIONS':
          return sessions;
        case 'GET_DAILY_SUMMARIES':
          return { [today]: summary };
        case 'GET_DISCIPLINE_SCORES':
          return scores;
        case 'GET_PATTERN_HISTORY':
          return patterns;
        case 'GET_SETTINGS':
        case 'SAVE_SETTINGS':
          return payload || settings;
        case 'GET_GAMIFICATION':
          return gamification;
        case 'GET_INTERVENTION_LOG':
          return interventionLog;
        case 'GET_CURRENT_SESSION':
          return { domain: 'github.com', isDistraction: false };
        case 'GENERATE_SUMMARY':
          return summary;
        case 'COMPUTE_SCORE':
          return scores[today];
        case 'RESET_SETTINGS':
          return settings;
        case 'CLEAR_DATA':
        case 'OPEN_DASHBOARD':
          return true;
        default:
          return null;
      }
    };

    window.chrome = {
      runtime: {
        lastError: null,
        getURL: file => new URL(file, window.location.href).href,
        sendMessage: (message, callback) => {
          setTimeout(() => callback?.({ ok: true, data: respond(message?.type, message?.payload) }), 0);
          return true;
        }
      },
      tabs: {
        create: () => Promise.resolve({ id: 1 })
      },
      storage: {
        local: {
          get: (_keys, callback) => callback({ settings }),
          set: (_value, callback) => callback?.(),
          clear: callback => callback?.()
        }
      }
    };
  });
}

test.beforeEach(async ({ page }) => {
  await installChromeMock(page);
});

test('primary extension pages load at target viewports without serious console errors', async ({ page }) => {
  const errors = collectSeriousErrors(page);
  const pages = [
    { file: 'dashboard.html', heading: 'Overview' },
    { file: 'options.html', heading: 'Auto Life Logger Options' },
    { file: 'onboarding.html', heading: 'Auto Life Logger' },
    { file: 'popup.html', text: 'Auto Life Logger' }
  ];

  for (const viewport of targetViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const target of pages) {
      await page.goto(pageUrl(target.file));
      if (target.heading) {
        await expect(page.getByRole('heading', { name: target.heading })).toBeVisible();
      } else {
        await expect(page.getByText(target.text)).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
    }
    await page.screenshot({
      path: path.join(root, 'output', 'playwright', `viewport-${viewport.name}.png`),
      fullPage: true
    });
  }

  expect(errors).toEqual([]);
});

test('dashboard main flows render on desktop', async ({ page }) => {
  const errors = collectSeriousErrors(page);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(pageUrl('dashboard.html'));
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('button', { name: /Sites/ }).click();
  await expect(page.getByText('github.com').first()).toBeVisible();
  await page.getByRole('button', { name: /Patterns/ }).click();
  await expect(page.locator('#patternList').getByText('Distraction Loop', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Settings/ }).click();
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(root, 'output', 'playwright', 'dashboard-desktop.png'), fullPage: true });

  expect(errors).toEqual([]);
});

test('dashboard mobile layout avoids page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl('dashboard.html'));
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(root, 'output', 'playwright', 'dashboard-mobile.png'), fullPage: true });
});

test('popup and options render without console errors', async ({ page }) => {
  const errors = collectSeriousErrors(page);

  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto(pageUrl('popup.html'));
  await expect(page.getByText('Auto Life Logger')).toBeVisible();
  await expect(page.locator('#puSites').getByText('github.com', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Summary' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(root, 'output', 'playwright', 'popup-mobile.png'), fullPage: true });

  await page.goto(pageUrl('options.html'));
  await expect(page.getByRole('heading', { name: 'Auto Life Logger Options' })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  expect(errors).toEqual([]);
});

test('options backup controls and import flow work', async ({ page }) => {
  const errors = collectSeriousErrors(page);
  const importPath = path.join(root, 'output', 'playwright', 'settings-import.json');
  fs.writeFileSync(importPath, JSON.stringify({
    settings: {
      distractionSites: ['news.example'],
      productiveSites: ['docs.example'],
      strictMode: { enabled: true, threshold: 2, blockedDomains: [] }
    }
  }));

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(pageUrl('options.html'));
  await page.locator('#neverTrackDomains').fill('https://Bank.Example/path\nbank.example');
  await page.locator('#dataRetentionDays').fill('120');
  await page.locator('#importSettingsFile').setInputFiles(importPath);
  await expect(page.getByText('Settings imported.')).toBeVisible();
  await page.getByRole('button', { name: 'Export Settings' }).click();
  await page.getByRole('button', { name: 'Export All Data' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.screenshot({ path: path.join(root, 'output', 'playwright', 'options-tablet.png'), fullPage: true });

  expect(errors).toEqual([]);
});

test('onboarding setup flow saves and routes to dashboard', async ({ page }) => {
  const errors = collectSeriousErrors(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(pageUrl('onboarding.html'));
  await page.getByLabel('Distraction sites').fill('video.example\nsocial.example');
  await page.getByLabel('Productive sites').fill('docs.example\nrepo.example');
  await page.getByLabel('Warn after minutes').fill('20');
  await page.getByLabel('Strict Mode').check();
  await page.getByRole('button', { name: 'Start Tracking' }).click();
  await expect(page.getByText('Setup saved. Opening your dashboard...')).toBeVisible();
  await page.waitForURL(/dashboard\.html/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.screenshot({ path: path.join(root, 'output', 'playwright', 'onboarding-flow.png'), fullPage: true });

  expect(errors).toEqual([]);
});
