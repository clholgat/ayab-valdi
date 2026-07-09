#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(webDir, '..');
const bazelAyabWebDir = path.join(workspaceRoot, 'bazel-bin', 'ayab_web');
const stableAyabWebDir = path.join(webDir, '.ayab_web_cache');
const bazelMarker = path.join(bazelAyabWebDir, 'src', 'RegisterNativeModules.js');
const stableMarker = path.join(stableAyabWebDir, 'src', 'RegisterNativeModules.js');
const integrityMarker = path.join(stableAyabWebDir, 'src', 'coreutils', 'src', 'unicode', 'UnicodeNative.js');

function isBazelBuilt() {
  return fs.existsSync(bazelMarker);
}

function isStableCacheValid() {
  return fs.existsSync(stableMarker) && fs.existsSync(integrityMarker);
}

function shouldRefreshCache() {
  if (!isStableCacheValid()) {
    return true;
  }
  return fs.statSync(bazelMarker).mtimeMs > fs.statSync(stableMarker).mtimeMs;
}

function copyAyabWebToStableCache() {
  console.log(`Copying ayab_web to stable cache at ${stableAyabWebDir}...`);
  fs.rmSync(stableAyabWebDir, { recursive: true, force: true });
  fs.cpSync(bazelAyabWebDir, stableAyabWebDir, { recursive: true });
}

if (!isBazelBuilt()) {
  console.log('Building ayab_web (required for webpack)...');
  execSync('bazel build :ayab_web --define disable_minify_web=true', {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
}

if (!isBazelBuilt()) {
  console.error(`Error: ayab_web not found at ${bazelAyabWebDir}`);
  console.error('Run from src/: bazel build :ayab_web --define disable_minify_web=true');
  process.exit(1);
}

if (shouldRefreshCache()) {
  copyAyabWebToStableCache();
}

if (!isStableCacheValid()) {
  console.error(`Error: ayab_web cache is incomplete at ${stableAyabWebDir}`);
  process.exit(1);
}

// Symlink into node_modules for tools that resolve via node_modules.
const nodeModulesLink = path.join(webDir, 'node_modules', 'ayab_web');
fs.mkdirSync(path.dirname(nodeModulesLink), { recursive: true });
try {
  if (fs.existsSync(nodeModulesLink)) {
    fs.unlinkSync(nodeModulesLink);
  }
  fs.symlinkSync(path.relative(path.dirname(nodeModulesLink), stableAyabWebDir), nodeModulesLink, 'dir');
} catch (err) {
  console.warn('Could not symlink ayab_web into node_modules:', err.message);
}
