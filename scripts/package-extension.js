'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const slug = packageJson.name || manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const version = manifest.version;
const distDir = path.join(root, 'dist');
const stageDir = path.join(distDir, `${slug}-${version}`);
const zipPath = path.join(distDir, `${slug}-${version}.zip`);

const files = [
  'manifest.json',
  'background.js',
  'blocker.js',
  'content.js',
  'popup.html',
  'popup.js',
  'dashboard.html',
  'dashboard.js',
  'options.html',
  'options.js',
  'onboarding.html',
  'onboarding.js',
  'styles.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(output || `${command} ${args.join(' ')} failed`);
  }
  return result;
}

function copyFile(rel) {
  const source = path.join(root, rel);
  const target = path.join(stageDir, rel);
  if (!fs.existsSync(source)) throw new Error(`Missing release file: ${rel}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function zipWithPowerShell() {
  const source = path.join(stageDir, '*');
  run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Compress-Archive -Path '${source.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
  ]);
}

function zipWithCli() {
  run('zip', ['-r', zipPath, '.'], { cwd: stageDir });
}

if (manifest.version !== packageJson.version) {
  throw new Error(`Version mismatch: manifest.json has ${manifest.version}, package.json has ${packageJson.version}`);
}

run(process.execPath, [path.join(root, 'scripts', 'validate-extension.js')]);

fs.rmSync(stageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const rel of files) copyFile(rel);

if (os.platform() === 'win32') zipWithPowerShell();
else zipWithCli();

console.log(`Created ${path.relative(root, zipPath)}`);
