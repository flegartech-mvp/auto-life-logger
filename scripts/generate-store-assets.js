'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'store-assets');

const css = String.raw`
* { box-sizing: border-box; }
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
body {
  background: #f4f7fb;
  color: #16202f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.asset { position: relative; overflow: hidden; background: linear-gradient(135deg, #f8fbff 0%, #eef5f4 54%, #f8efe7 100%); }
.shot { width: 1280px; height: 800px; padding: 56px; }
.small { width: 440px; height: 280px; padding: 28px; }
.marquee { width: 1400px; height: 560px; padding: 58px 70px; }
.title { font-size: 58px; line-height: 1; margin: 0 0 18px; letter-spacing: 0; max-width: 540px; }
.copy { font-size: 25px; line-height: 1.35; max-width: 470px; margin: 0; color: #405066; }
.brand { display: flex; align-items: center; gap: 14px; margin-bottom: 42px; font-weight: 800; font-size: 26px; }
.icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 14px; background: #186bff; color: #fff; font-weight: 900; box-shadow: 0 16px 35px rgba(24, 107, 255, .22); }
.window { position: absolute; right: 58px; bottom: 120px; width: 520px; min-height: 500px; background: #fff; border: 1px solid #d7e0ea; border-radius: 8px; box-shadow: 0 26px 80px rgba(31, 44, 61, .18); padding: 24px; }
.window.wide { width: 620px; min-height: 360px; }
.topline { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.label { font-size: 14px; font-weight: 800; color: #65748a; text-transform: uppercase; }
.score { font-size: 44px; font-weight: 900; color: #0c8a5a; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 18px 0; }
.card { border: 1px solid #e2e9f0; border-radius: 8px; padding: 18px; background: #fbfdff; }
.num { font-size: 28px; font-weight: 900; margin-bottom: 5px; }
.muted { font-size: 14px; color: #6c7889; }
.bar { height: 18px; border-radius: 5px; background: #e8eef5; margin: 14px 0; overflow: hidden; }
.bar span { display: block; height: 100%; background: #186bff; }
.bar.green span { background: #10a36e; }
.bar.orange span { background: #e27d2f; }
.sites { margin-top: 22px; }
.site { display: grid; grid-template-columns: 1fr 86px; gap: 16px; align-items: center; margin-bottom: 14px; }
.site strong { font-size: 17px; }
.pill { justify-self: end; border-radius: 999px; padding: 7px 10px; background: #edf4ff; color: #1859b8; font-weight: 800; font-size: 13px; }
.panel { position: absolute; inset: auto 58px 120px auto; width: 575px; background: #172133; color: #fff; border-radius: 8px; padding: 34px; box-shadow: 0 26px 80px rgba(31, 44, 61, .24); }
.panel h2 { margin: 0 0 10px; font-size: 34px; }
.panel p { color: #cad5e3; font-size: 20px; line-height: 1.35; margin: 0 0 24px; }
.button { display: inline-block; padding: 13px 18px; border-radius: 6px; background: #fff; color: #172133; font-weight: 900; }
.small .brand { margin-bottom: 20px; font-size: 19px; gap: 10px; }
.small .icon { width: 42px; height: 42px; border-radius: 10px; }
.small .title { font-size: 33px; margin-bottom: 10px; max-width: 360px; }
.small .copy { font-size: 16px; max-width: 330px; }
.small .mini-bars { position: absolute; left: 30px; right: 30px; bottom: 25px; display: grid; gap: 8px; }
.small .bar { margin: 0; height: 13px; }
.marquee .title { font-size: 64px; max-width: 620px; }
.marquee .copy { font-size: 26px; max-width: 610px; }
.marquee .window { right: 74px; bottom: 80px; width: 560px; min-height: 360px; }
`;

const assets = [
  {
    id: 'screenshot-dashboard',
    width: 1280,
    height: 800,
    markup: String.raw`<section class="asset shot">
  <div class="brand"><div class="icon">ALL</div>Auto Life Logger</div>
  <h1 class="title">See where your browsing time goes.</h1>
  <p class="copy">Private daily analytics reveal focus time, distracting loops, top sites, and weekly trends. Data stays on your device.</p>
  <div class="window wide">
    <div class="topline"><div><div class="label">Today</div><div class="score">82 focus</div></div><div class="pill">Local only</div></div>
    <div class="grid">
      <div class="card"><div class="num">4h 20m</div><div class="muted">productive</div></div>
      <div class="card"><div class="num">42m</div><div class="muted">distracting</div></div>
      <div class="card"><div class="num">7</div><div class="muted">saved loops</div></div>
    </div>
    <div class="bar green"><span style="width:72%"></span></div>
    <div class="bar orange"><span style="width:28%"></span></div>
    <div class="sites">
      <div class="site"><strong>docs.google.com</strong><div class="pill">1h 46m</div></div>
      <div class="site"><strong>github.com</strong><div class="pill">58m</div></div>
      <div class="site"><strong>youtube.com</strong><div class="pill">18m</div></div>
    </div>
  </div>
</section>`
  },
  {
    id: 'screenshot-strict',
    width: 1280,
    height: 800,
    markup: String.raw`<section class="asset shot">
  <div class="brand"><div class="icon">ALL</div>Auto Life Logger</div>
  <h1 class="title">Turn distraction loops into decisions.</h1>
  <p class="copy">Optional reminders and Strict Mode help you pause, choose a focus reason, or block repeated detours after ignored warnings.</p>
  <div class="panel">
    <h2>Strict Mode Active</h2>
    <p>This site is paused after repeated distraction violations. Take a breath, review your intention, and return when your focus window ends.</p>
    <div class="button">Back to focused work</div>
  </div>
</section>`
  },
  {
    id: 'promo-small',
    width: 440,
    height: 280,
    markup: String.raw`<section class="asset small">
  <div class="brand"><div class="icon">ALL</div>Auto Life Logger</div>
  <h1 class="title">Private focus analytics for Chrome.</h1>
  <p class="copy">Track habits, catch loops, and build better browsing discipline.</p>
  <div class="mini-bars">
    <div class="bar green"><span style="width:76%"></span></div>
    <div class="bar"><span style="width:54%"></span></div>
    <div class="bar orange"><span style="width:30%"></span></div>
  </div>
</section>`
  },
  {
    id: 'promo-marquee',
    width: 1400,
    height: 560,
    markup: String.raw`<section class="asset marquee">
  <div class="brand"><div class="icon">ALL</div>Auto Life Logger</div>
  <h1 class="title">Build focus from your real browsing habits.</h1>
  <p class="copy">Local-first Chrome analytics, intervention nudges, and Strict Mode for calmer work sessions.</p>
  <div class="window">
    <div class="topline"><div><div class="label">Discipline score</div><div class="score">82</div></div><div class="pill">Private</div></div>
    <div class="bar green"><span style="width:82%"></span></div>
    <div class="grid">
      <div class="card"><div class="num">4h</div><div class="muted">focus</div></div>
      <div class="card"><div class="num">5</div><div class="muted">patterns</div></div>
      <div class="card"><div class="num">0</div><div class="muted">uploads</div></div>
    </div>
  </div>
</section>`
  }
];

fs.mkdirSync(outDir, { recursive: true });

const chromeCandidates = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const chrome = chromeCandidates.find(p => fs.existsSync(p));
if (!chrome) throw new Error('Chrome or Edge was not found.');

for (const asset of assets) {
  const htmlPath = path.join(outDir, `${asset.id}.html`);
  const output = path.join(outDir, `${asset.id}.png`);
  fs.writeFileSync(htmlPath, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${asset.markup}</body></html>`);

  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${asset.width},${asset.height}`,
    `--screenshot=${output}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ], { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(`${result.stdout || ''}${result.stderr || ''}`.trim());
  }
  console.log(`Created ${path.relative(root, output)}`);
}
