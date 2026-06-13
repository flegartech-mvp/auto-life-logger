'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
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
if (!chrome) {
  console.warn('Chrome/Edge not found; skipping unpacked-load smoke test.');
  process.exit(0);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'all-smoke-'));
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--enable-logging=stderr',
  '--v=1',
  `--user-data-dir=${profile}`,
  `--disable-extensions-except=${root}`,
  `--load-extension=${root}`,
  '--dump-dom',
  'about:blank'
];

const result = spawnSync(chrome, args, { encoding: 'utf8', timeout: 30000 });
const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const lines = output.split(/\r?\n/);

try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch {
  // Chrome may still be releasing locks on Windows. The temp profile is disposable.
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(output);
  process.exit(result.status || 1);
}
const fatal = lines.filter(line =>
  /Failed to load extension|Could not load extension|Invalid extension|Manifest is not valid|Error loading extension/i.test(line) ||
  (/Auto Life Logger|MVP/i.test(line) && /error|failed|invalid/i.test(line))
);
if (fatal.length) {
  console.error(fatal.join('\n'));
  process.exit(1);
}

console.log('Chrome unpacked-load smoke passed.');
