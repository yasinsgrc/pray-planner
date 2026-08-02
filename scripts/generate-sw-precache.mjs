// Generates dist/precache-manifest.json after `vite build` — sw.js fetches
// this at install time to know exactly what to precache (design-refresh-v3
// Faz 4 F1). The list can't be hand-written: JS/CSS asset filenames are
// content-hashed by Vite and change on every build.
//
// The version string is a hash of every precached file's *content* (not
// just filenames) — Vite already renames hashed assets on content change,
// but files copied verbatim from public/ (fonts, icons, manifest, the
// ezan recording) keep the same filename forever, so a filename-only hash
// would never notice one of those changing and the SW would serve a stale
// copy indefinitely for cache-first assets.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DIST = path.resolve('dist');
// Never precached: sw.js is fetched by the browser's own SW update
// mechanism, not through this list; precache-manifest.json is what we're
// about to write.
const EXCLUDED = new Set(['sw.js', 'precache-manifest.json']);

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

  await writeFile(
    path.join(DIST, 'precache-manifest.json'),
    JSON.stringify({ version, urls })
  );
  console.log(`Generated precache-manifest.json — ${urls.length} files, version ${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
