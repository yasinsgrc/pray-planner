import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allNavLabelsFit, lineCount } from './textFit';

// 5 eşit sütun; her etiket kendi sütununun içerik genişliğine (sütun − iki
// yan padding) sığmalı. Sınır dahil, 0.01px fazlası sığmaz.
test('allNavLabelsFit: en uzun etiket sütun içeriğine tam eşitse sığar', () => {
  // 300 / 5 = 60, − 2·4 = 52
  assert.equal(allNavLabelsFit([40, 52, 30, 45, 38], 300, 4), true);
});

test('allNavLabelsFit: tek bir etiket 0.01px taşarsa hepsi sığmıyor', () => {
  assert.equal(allNavLabelsFit([40, 52.01, 30, 45, 38], 300, 4), false);
});

test('allNavLabelsFit: sütun sayısı etiket sayısından gelir', () => {
  // 200 / 4 = 50, − 2·5 = 40
  assert.equal(allNavLabelsFit([40, 40, 40, 40], 200, 5), true);
  assert.equal(allNavLabelsFit([40, 40, 40, 41], 200, 5), false);
});

test('lineCount: kutu yüksekliği satır yüksekliğine bölünüp yuvarlanır', () => {
  assert.equal(lineCount(16, 16), 1);
  assert.equal(lineCount(32, 16), 2);
  // Alt-piksel yuvarlama (örn. 20.8px satır, 41.59px kutu) satır sayısını bozmaz.
  assert.equal(lineCount(41.59, 20.8), 2);
  assert.equal(lineCount(0, 16), 0);
});
