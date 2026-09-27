import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZikirHistoryView, formatHistoryDay } from './ZikirHistoryView';

const noop = () => {};

test('formatHistoryDay: bugün/dün ve tarih + gün adı', () => {
  assert.deepEqual(formatHistoryDay('2026-09-27', '2026-09-27'), { title: 'Bugün', subtitle: '27 Eylül Pazar' });
  assert.deepEqual(formatHistoryDay('2026-09-26', '2026-09-27'), { title: 'Dün', subtitle: '26 Eylül Cumartesi' });
  assert.deepEqual(formatHistoryDay('2026-09-24', '2026-09-27'), { title: '24 Eylül', subtitle: 'Perşembe' });
});

test('boş geçmişte boş durum kartı gösterilir, grafik yok', () => {
  const html = renderToStaticMarkup(React.createElement(ZikirHistoryView, { zikirLog: {}, todayKey: '2026-09-27', onBack: noop }));
  assert.equal(html.includes('Henüz kayıtlı zikir yok'), true);
  assert.equal(html.includes('Son 30 gün özeti'), false);
});

test('gün kartında toplam, zikir sayısı ve tamamlanan tur yazılır; 14 sütun çizilir', () => {
  const html = renderToStaticMarkup(
    React.createElement(ZikirHistoryView, {
      zikirLog: { '2026-09-27': { Subhânallah: 71, Elhamdulillâh: 10 } },
      todayKey: '2026-09-27',
      onBack: noop,
    })
  );
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 14);
  assert.equal(html.includes('aria-label="Bugün: 81 zikir"'), true);
  assert.equal(html.includes('>2 tur<'), true); // 71 / 33
  assert.equal(html.includes('>1 tur<'), false); // Elhamdulillâh 10 < 33
});
