import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(dir, '../public/icons/icon.svg');
const svg = readFileSync(svgPath);

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  const outPath = path.join(dir, '../public/icons', file);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log(`Wrote ${file} (${size}x${size})`);
}
