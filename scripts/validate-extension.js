'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'manifest.json');
const problems = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3) problems.push('manifest.json must use Manifest V3.');

const requiredPaths = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_page
].filter(Boolean);

for (const script of manifest.content_scripts || []) {
  requiredPaths.push(...(script.js || []), ...(script.css || []));
}
for (const iconMap of [manifest.icons, manifest.action?.default_icon]) {
  if (iconMap) requiredPaths.push(...Object.values(iconMap));
}

for (const rel of requiredPaths) {
  if (!exists(rel)) problems.push(`Manifest references missing file: ${rel}`);
}

for (const permission of ['tabs', 'activeTab']) {
  if ((manifest.permissions || []).includes(permission)) {
    problems.push(`Avoid broad unused permission: ${permission}`);
  }
}

const jsFiles = [
  'background.js',
  'blocker.js',
  'content.js',
  'popup.js',
  'dashboard.js',
  'options.js',
  'onboarding.js'
];

for (const rel of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  if (result.status !== 0) problems.push(`${rel} failed syntax check:\n${result.stderr || result.stdout}`);
}

const scanFiles = jsFiles.concat(['manifest.json', 'popup.html', 'dashboard.html', 'options.html', 'onboarding.html']);
const forbidden = [
  [/eval\s*\(/, 'eval()'],
  [/new Function\b/, 'new Function'],
  [/google\.com\/s2/, 'remote Google favicon endpoint']
];
for (const rel of scanFiles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) problems.push(`${rel} contains forbidden pattern: ${label}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log('Extension validation passed.');
