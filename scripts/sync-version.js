#!/usr/bin/env node
/* Sync every version artifact from package.json — the ONLY version
   declaration in this repository. Generated/stamped artifacts:

   - public/version.json                     static fallback for /api/version
   - public/version-generated.js             window.MT_APP_VERSION for the WebView
   - android/app/build.gradle                APK metadata (versionName/versionCode)
   - ios/App/App.xcodeproj/project.pbxproj   IPA metadata (MARKETING_VERSION etc.)

   Native project files are stamped only when they exist: the android/ and
   ios/ projects are created by `npx cap add` (in CI and locally), never
   committed. `cap sync` does not touch version metadata, so this must.

   Run automatically from the npm scripts that need it (prestart, dist,
   cap:add:*, cap:sync) and from the `npm version` lifecycle hook. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const jsonTarget = path.join(root, 'public', 'version.json');
const jsTarget = path.join(root, 'public', 'version-generated.js');
const jsonContent = JSON.stringify({ version: pkg.version }, null, 2) + '\n';
/* Native Capacitor builds cannot rely on fetching a local version file:
   /api/version does not exist there and CapacitorHttp (enabled in
   capacitor.config.json) intercepts relative fetches, so the WebView asset
   origin is not reachable by the native HTTP engine. Ship the version as a
   tiny generated script loaded before app.js instead. */
const jsContent = `/* Auto-generated from package.json — do not edit (scripts/sync-version.js). */\nwindow.MT_APP_VERSION = ${JSON.stringify(pkg.version)};\n`;

let changed = false;
let existed = '';
try { existed = fs.readFileSync(jsonTarget, 'utf8'); } catch (e) {}
if (existed !== jsonContent) {
  fs.writeFileSync(jsonTarget, jsonContent);
  changed = true;
}
let jsExisted = '';
try { jsExisted = fs.readFileSync(jsTarget, 'utf8'); } catch (e) {}
if (jsExisted !== jsContent) {
  fs.writeFileSync(jsTarget, jsContent);
  changed = true;
}
if (changed) {
  console.log('version assets -> ' + pkg.version);
}

if (process.argv.includes('--git-add')) {
  // Used by the `npm version` lifecycle hook so the regenerated files are
  // part of the same release commit that npm has just staged.
  try {
    execFileSync('git', ['add', path.relative(root, jsonTarget), path.relative(root, jsTarget)], { cwd: root, stdio: 'ignore' });
  } catch (e) { /* not a git checkout — ignore */ }
}
