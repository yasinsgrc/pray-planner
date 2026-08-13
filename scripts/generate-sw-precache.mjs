// Embeds the precache version + URL list directly into dist/sw.js after
// `vite build` (design-refresh-v3 Faz 5 F1). An earlier version of this
// script wrote a separate dist/precache-manifest.json that sw.js fetched
// at startup to learn its own cache name — that fetch fails while
// offline, so a cold-started SW with no connection could never find its
// own cache even though the files were genuinely sitting in Cache
// Storage. Knowing the cache name must cost zero network requests, so the
// version and URL list are baked into the script itself instead.
//
// The version is a hash of every precached file's *content* (not just
// filenames) — Vite already renames hashed assets on content change, but
// files copied verbatim from public/ (fonts, icons, manifest, the ezan
// recording) keep the same filename forever, so a filename-only hash
// would never notice one of those changing and the SW would serve a
// stale copy indefinitely for cache-first assets.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DIST = path.resolve('dist');
const SW_PATH = path.join(DIST, 'sw.js');
// sw.js itself is fetched by the browser's own SW update mechanism, not
// through this list. gizlilik.html (Faz 26 Commit 3) is excluded too — it's
// the public, install-free privacy policy URL required by store listings
// (Play Console Data Safety etc.); it must always serve fresh from the
// network, never a stale cached copy from before an update.
const EXCLUDED = new Set(['sw.js', 'gizlilik.html']);

const VERSION_MARKER = "const PRECACHE_VERSION = 'dev';";
const URLS_MARKER = 'const PRECACHE_URLS = [];';

async function walk(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await walk(full, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

async function main() {
  const allFiles = await walk(DIST);
  const relPaths = allFiles.filter((f) => !EXCLUDED.has(f));

  const hash = crypto.createHash('sha256');
  for (const rel of [...relPaths].sort()) {
    hash.update(rel);
    hash.update(await readFile(path.join(DIST, rel)));
  }
  const version = hash.digest('hex').slice(0, 12);

  const urls = relPaths.map((f) => '/' + f);
  // The SPA is always served at '/' for navigation, not '/index.html'
  // literally — precache it under the URL a real navigation request uses.
  if (!urls.includes('/')) urls.push('/');

  let swSource = await readFile(SW_PATH, 'utf8');

  if (!swSource.includes(VERSION_MARKER) || !swSource.includes(URLS_MARKER)) {
    throw new Error(
      `sw.js no longer contains the expected placeholder lines — did the source change?\n` +
        `Expected to find:\n  ${VERSION_MARKER}\n  ${URLS_MARKER}`
    );
  }

  swSource = swSource.replace(VERSION_MARKER, `const PRECACHE_VERSION = '${version}';`);
  swSource = swSource.replace(URLS_MARKER, `const PRECACHE_URLS = ${JSON.stringify(urls)};`);

  await writeFile(SW_PATH, swSource);
  console.log(`Embedded precache into dist/sw.js — ${urls.length} files, version ${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
