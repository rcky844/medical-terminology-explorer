#!/usr/bin/env node
/* Regenerate public/version.json from package.json.

   package.json is the ONLY version declaration in this repository:
   - the Node server serves /api/version straight from package.json
   - public/version.json is auto-generated (bundled into native Capacitor
     builds where /api/version does not exist) and must not be edited by hand

   Run automatically from the npm scripts that need it, and from the
   `npm version` lifecycle hook. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const target = path.join(root, 'public', 'version.json');
const content = JSON.stringify({ version: pkg.version }, null, 2) + '\n';

let existed = '';
try { existed = fs.readFileSync(target, 'utf8'); } catch (e) {}
if (existed !== content) {
  fs.writeFileSync(target, content);
  console.log('public/version.json -> ' + pkg.version);
}

if (process.argv.includes('--git-add')) {
  // Used by the `npm version` lifecycle hook so the regenerated file is
  // part of the same release commit that npm has just staged.
  try {
    execFileSync('git', ['add', path.relative(root, target)], { cwd: root, stdio: 'ignore' });
  } catch (e) { /* not a git checkout — ignore */ }
}
