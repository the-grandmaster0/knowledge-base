/**
 * zip-server.js
 * Creates server-deploy.zip ready for AWS Elastic Beanstalk upload.
 *
 * Usage (from the project root):
 *   node zip-server.js
 *
 * Zero external dependencies — uses Node built-ins + system tar.
 *
 * Excludes:  node_modules/  .env
 * Includes:  everything else inside server/ at the ZIP root (EB requirement)
 */

const { execSync }  = require('node:child_process');
const { existsSync, unlinkSync, readdirSync, statSync } = require('node:fs');
const { resolve, join, relative } = require('node:path');

const ROOT       = __dirname;
const SERVER_DIR = resolve(ROOT, 'server');
const OUTPUT     = resolve(ROOT, 'server-deploy.zip');

const EXCLUDE = new Set(['node_modules', '.env', 'package-lock.json']);

// ── Remove stale zip ──────────────────────────────────────────
if (existsSync(OUTPUT)) {
  unlinkSync(OUTPUT);
  console.log('Removed old server-deploy.zip\n');
}

// ── Collect entries to include ────────────────────────────────
const entries = readdirSync(SERVER_DIR).filter((e) => !EXCLUDE.has(e));

if (entries.length === 0) {
  console.error('Nothing to zip — server directory appears empty.');
  process.exit(1);
}

console.log('Including in zip:');
entries.forEach((e) => {
  const full = join(SERVER_DIR, e);
  const isDir = statSync(full).isDirectory();
  console.log(`  + ${e}${isDir ? '/' : ''}`);
});

// Show excluded items
EXCLUDE.forEach((e) => {
  if (existsSync(join(SERVER_DIR, e))) {
    console.log(`  - ${e}  (excluded)`);
  }
});
console.log('');

// ── Build the zip using system tar ───────────────────────────
// tar on Windows (bsdtar) supports -a (auto-format from extension) and
// will create a .zip when the output ends in .zip.
// We cd into server/ first so paths inside the zip are relative (no leading folder).
const entryList = entries.map((e) => `"${e}"`).join(' ');
const cmd = `tar -a -c -f "${OUTPUT}" ${entryList}`;

try {
  execSync(cmd, { cwd: SERVER_DIR, stdio: 'inherit' });
} catch (err) {
  console.error('\nFailed to create zip:', err.message);
  process.exit(1);
}

// ── Summary ───────────────────────────────────────────────────
const sizeMB = (statSync(OUTPUT).size / 1024 / 1024).toFixed(2);
console.log(`\nDone!  server-deploy.zip  (${sizeMB} MB)`);
console.log(`Path:  ${OUTPUT}\n`);
console.log('Next steps:');
console.log('  1. AWS Console -> Elastic Beanstalk -> Upload and Deploy');
console.log('  2. Select server-deploy.zip');
console.log('  3. Confirm these env vars in EB Configuration -> Software:');
console.log('       GEMINI_API_KEY');
console.log('       PINECONE_API_KEY');
console.log('       ALLOWED_ORIGIN   (your Vercel URL, no trailing slash)');
console.log('       NODE_ENV         production');
