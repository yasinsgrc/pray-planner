import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const resDir = path.join(dir, '../android/app/src/main/res');
const logoSvg = readFileSync(path.join(dir, '../assets/logo/vakit-marka-logo.svg'));

// Splash arka planı ic_launcher_background ile aynı olmalı; ikisi ayrışırsa
// açılışta bir kare bir renk sıçraması görünür.
const BACKGROUND = '#0F1B2E';

// Boyutlar Capacitor'ın ürettiği mevcut splash.png dosyalarından alındı,
// birebir korunuyor. Bir boyut değişirse styles.xml'deki @drawable/splash
// referansı yanlış yoğunlukta ölçekler.
const targets = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
];

// Logo kısa kenarın %42'si. Daha büyüğü küçük ekranlarda kenara dayanıyor,
// daha küçüğü büyük ekranlarda kayboluyor.
const LOGO_RATIO = 0.42;

for (const [folder, width, height] of targets) {
  const outDir = path.join(resDir, folder);
  mkdirSync(outDir, { recursive: true });

  const logoSize = Math.round(Math.min(width, height) * LOGO_RATIO);
  const logo = await sharp(logoSvg, { density: 384 })
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  await sharp({
    create: { width, height, channels: 3, background: BACKGROUND },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, 'splash.png'));
}

console.log(`splash: ${targets.length} dosya yazıldı`);
