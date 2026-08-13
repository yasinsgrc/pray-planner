import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.join(dir, '../assets/feature-graphic.svg'));

// Play Store rejects/mishandles transparency on the feature graphic — flatten
// onto the SVG's own navy background so the PNG has no alpha channel.
const outPath = path.join(dir, '../assets/feature-graphic.png');
await sharp(svg, { density: 384 })
  .resize(1024, 500)
  .flatten({ background: '#0F1B2E' })
  .png()
  .toFile(outPath);
console.log('Wrote feature-graphic.png (1024x500)');
