import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const logoDir = path.join(dir, '../assets/logo');
const resDir = path.join(dir, '../android/app/src/main/res');

const iconSvg = readFileSync(path.join(logoDir, 'vakit-icon.svg'));
const bgSvg = readFileSync(path.join(logoDir, 'vakit-adaptive-background.svg'));
const fgSvg = readFileSync(path.join(logoDir, 'vakit-adaptive-foreground.svg'));
const monoSvg = readFileSync(path.join(logoDir, 'vakit-monochrome.svg'));

const densities = [
  { name: 'mdpi', legacy: 48, adaptive: 108 },
  { name: 'hdpi', legacy: 72, adaptive: 162 },
  { name: 'xhdpi', legacy: 96, adaptive: 216 },
  { name: 'xxhdpi', legacy: 144, adaptive: 324 },
  { name: 'xxxhdpi', legacy: 192, adaptive: 432 },
];

const circleMask = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );

for (const { name, legacy, adaptive } of densities) {
  const outDir = path.join(resDir, `mipmap-${name}`);

  // Legacy square launcher icon — vakit-icon.svg already bakes in its own
  // rounded-corner mask, matching the pre-Oreo convention of apps shipping
  // their own icon shape.
  await sharp(iconSvg, { density: 384 }).resize(legacy, legacy).png().toFile(path.join(outDir, 'ic_launcher.png'));

  // Legacy round launcher icon — flat (unrounded) background + foreground,
  // then circle-masked, so the square rounding above isn't double-applied.
  const flatSquare = await sharp(bgSvg, { density: 384 })
    .resize(legacy, legacy)
    .composite([{ input: await sharp(fgSvg, { density: 384 }).resize(legacy, legacy).toBuffer() }])
    .png()
    .toBuffer();
  await sharp(flatSquare)
    .composite([{ input: circleMask(legacy), blend: 'dest-in' }])
    .png()
    .toFile(path.join(outDir, 'ic_launcher_round.png'));

  // Adaptive icon layers
  await sharp(fgSvg, { density: 384 })
    .resize(adaptive, adaptive)
    .png()
    .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  await sharp(monoSvg, { density: 384 })
    .resize(adaptive, adaptive)
    .png()
    .toFile(path.join(outDir, 'ic_launcher_monochrome.png'));

  console.log(`Wrote mipmap-${name} icons`);
}
