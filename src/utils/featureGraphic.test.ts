import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Faz 26 Commit 5 — Play mağaza kaydı 1024x500 feature graphic zorunlu
// tutuyor ve şeffaf PNG'de beklenmedik sonuç veriyor; bu test
// scripts/generate-feature-graphic.mjs'nin ürettiği assets/feature-graphic.png
// dosyasının PNG IHDR chunk'ını okuyup boyutu ve renk tipini doğruluyor
// (yeniden çalıştırmadan npm install/harici bağımlılık gerektirmesin diye
// bir görüntü kütüphanesi yerine ham byte okuma kullanılıyor).
const png = readFileSync('assets/feature-graphic.png');

function readIHDR(buf: Buffer) {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
  };
}

test('feature-graphic.png is exactly 1024x500', () => {
  const { width, height } = readIHDR(png);
  assert.equal(width, 1024);
  assert.equal(height, 500);
});

test('feature-graphic.png has no alpha channel (Play rejects/mishandles transparency)', () => {
  const { colorType } = readIHDR(png);
  // PNG color type 4 (grayscale+alpha) and 6 (truecolor+alpha) carry an
  // alpha channel; type 2 (truecolor) does not.
  assert.notEqual(colorType, 4);
  assert.notEqual(colorType, 6);
});
