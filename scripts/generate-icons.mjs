import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(dir, '../public/icons/icon.svg'));
// Separate, more tightly-cropped source for purpose:"maskable" — reusing
// the "any" icon there is a common mistake (design-refresh-v3 Faz 4 F5):
// Android/etc. crop maskable icons to a circle/squircle/teardrop using
// only the central ~80% "safe zone", and this app's ring almost reaches
// that boundary in the regular icon. icon-maskable.svg is the same design
// scaled down with real margin, not just re-exported at a different size.
const maskableSvg = readFileSync(path.join(dir, '../public/icons/icon-maskable.svg'));

const targets = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'icon-512-maskable.png', size: 512, source: maskableSvg },
  { file: 'apple-touch-icon.png', size: 180, source: svg },
];

for (const { file, size, source } of targets) {
  const outPath = path.join(dir, '../public/icons', file);
  await sharp(source, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log(`Wrote ${file} (${size}x${size})`);
}
