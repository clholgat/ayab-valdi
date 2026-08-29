#!/usr/bin/env node

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(webDir, '..');
const repositoryRoot = path.resolve(workspaceRoot, '..');
const bazelSiteZip = path.join(workspaceRoot, 'bazel-bin', 'ayab_valdi_app_web.zip');
const distDir = path.join(webDir, 'dist');
const indexPath = path.join(distDir, 'index.html');
const bundlePath = path.join(distDir, 'bundle.js');

function isBazelBuilt() {
  return fs.existsSync(bazelSiteZip);
}

function isDistValid() {
  return fs.existsSync(indexPath) && fs.existsSync(bundlePath);
}

function extractStaticSite() {
  console.log(`Extracting first-class Valdi Web site to ${distDir}...`);
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  execFileSync('unzip', ['-oq', bazelSiteZip, '-d', distDir], { stdio: 'inherit' });
}

// The E2E runner builds and extracts immediately before `npm run serve`.
// Avoid repeating that work in npm's `preserve` lifecycle hook.
if (process.env.AYAB_WEB_ALREADY_ENSURED === '1' && isDistValid()) {
  process.exit(0);
}

execFileSync(path.join(repositoryRoot, 'scripts', 'ensure-valdi-registry.sh'), {
  cwd: repositoryRoot,
  stdio: 'inherit',
});

console.log('Building //:ayab_valdi_app_web (incremental when up to date)...');
execSync('bazel build //:ayab_valdi_app_web', {
    cwd: workspaceRoot,
    stdio: 'inherit',
});

if (!isBazelBuilt()) {
  console.error(`Error: Valdi Web site not found at ${bazelSiteZip}`);
  console.error('Run from src/: bazel build //:ayab_valdi_app_web');
  process.exit(1);
}

extractStaticSite();

if (!isDistValid()) {
  console.error(`Error: extracted Valdi Web site is incomplete at ${distDir}`);
  process.exit(1);
}
