import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SunArcDial } from './SunArcDial';
import { calculateDaySchedule, deriveLiveSchedule } from '../utils/prayerCalculator';
import { DEFAULT_LOCATION } from '../data/locations';

const day = calculateDaySchedule(DEFAULT_LOCATION, new Date('2026-08-01T00:00:00'), 'Diyanet');

// Kerahet yayları geri sayım halkasından kaldırıldı — kerahet bilgisi
// halkanın altındaki KERAHET metin bölümünde (KerahetStrip) zaten veriliyor;
// halka üzerindeki kalın yaylar vakit ilerleme yayıyla karışan görsel gürültü
// yaratıyordu. Bu test halkanın artık kerahet'e özgü hiçbir eleman
// render etmediğini doğrular.
test('SunArcDial no longer renders kerahet arc elements', () => {
  const duringSunriseKerahet = new Date(day.sunrise.getTime() + 10 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringSunriseKerahet);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.doesNotMatch(html, /data-kerahet-type/);
  assert.doesNotMatch(html, /animate-kerahet-pulse/);
});

// Halka üzerindeki "şu an" işaretçisi gece boyunca hilal olarak çiziliyordu,
// ama eski uygulama sabit koordinatlarda tanımlı bir <mask> kullanıyordu
// (işaretçi hareket ederken kesim rastgele yerden geçip yamuk bir kama
// oluşturuyordu). Hilal artık kendi lokal koordinatlarında sabit bir <path>
// olarak çizilip tek bir <g transform="translate(x, y) rotate(angle)">
// ile konumlandırılıp döndürülmeli — böylece şekil konumdan bağımsız olur.
test('SunArcDial no longer uses an SVG mask for the crescent marker', () => {
  const duringImsak = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringImsak);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.doesNotMatch(html, /<mask/);
  assert.doesNotMatch(html, /dial-crescent-mask/);
});

test('SunArcDial renders a fixed crescent path during the night', () => {
  const duringImsak = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringImsak);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.match(html, /data-crescent-shape/);
});

test('SunArcDial crescent path "d" is identical across two different moments, only the transform differs', () => {
  const firstMoment = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const secondMoment = new Date(day.fajr.getTime() + 45 * 60 * 1000);

  const htmlFirst = renderToStaticMarkup(
    React.createElement(SunArcDial, { schedule: deriveLiveSchedule(day, firstMoment) })
  );
  const htmlSecond = renderToStaticMarkup(
    React.createElement(SunArcDial, { schedule: deriveLiveSchedule(day, secondMoment) })
  );

  const extractCrescent = (html: string) => {
    const match = html.match(
      /<g transform="translate\(([^,]+), ?([^)]+)\) rotate\([^)]+\)">\s*<circle[^>]*><\/circle>\s*<path[^>]*data-crescent-shape[^>]*d="([^"]+)"/
    );
    assert.ok(match, 'crescent <g translate+rotate><circle/><path data-crescent-shape d="..."/></g> not found');
    return { x: match![1], y: match![2], d: match![3] };
  };

  const first = extractCrescent(htmlFirst);
  const second = extractCrescent(htmlSecond);

  assert.equal(first.d, second.d, 'crescent shape "d" must be identical regardless of position');
  assert.notEqual(`${first.x},${first.y}`, `${second.x},${second.y}`, 'translate must differ between moments');
});

// Hilal dolgusu eskiden var(--accent) idi — --accent ise index.css'te
// var(--v-ogle)'nin bir alias'ı, yani teknik olarak bir segment token'ı.
// Gece segmentleriyle (imsak/yatsi) karışmasın diye hilale özgü, segment
// token'larından bağımsız bir tasarım token'ı (--gold) kullanılmalı.
test('SunArcDial crescent fill uses a token distinct from --accent/segment tokens', () => {
  const duringImsak = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringImsak);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  const match = html.match(/data-crescent-shape="true"[^>]*fill="([^"]+)"/);
  assert.ok(match, 'crescent path with a fill attribute not found');
  assert.equal(match![1], 'var(--gold)');
});

// Hilal, radyal/teğet eksene göre döndürülmeli (sabit/rastgele yön değil) —
// konumdan bağımsız aynı "d" değerini koruyan <g transform="translate(...)
// rotate(...)"> tek transform'unun parçası olarak, açıya göre değişen bir
// rotate() içermeli.
test('SunArcDial crescent is wrapped in a rotate() transform tied to day progress', () => {
  const duringImsak = new Date(day.fajr.getTime() + 5 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, duringImsak);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.match(html, /<g transform="translate\([^)]+\) rotate\([^)]+\)">\s*<circle[^>]*><\/circle>\s*<path[^>]*data-crescent-shape/);
});

// Sıradaki vakit dot'u (r=4.5, beyaz stroke) ile "şu an" işaretçisi (r=9,
// beyaz stroke) vakit yaklaşınca üst üste binip tek bir blob gibi
// görünüyordu. Vakte çok az kala sıradaki vakit dot'u gizlenmeli.
// Öğle→ikindi aralığı (~234 dk) hem 11 dk hem 2 saat öncesini aynı
// "sıradaki vakit = ikindi" penceresinde test edebilecek kadar geniş —
// imsak→güneş aralığı (~105 dk) bunun için yeterince geniş değil.
const ikindiTime = day.rawPrayers.find((p) => p.name === 'ikindi')!.dateObj;

test('SunArcDial vakte 11 dakika kala sıradaki vakit dot\'unu gizler', () => {
  const elevenMinutesBefore = new Date(ikindiTime.getTime() - 11 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, elevenMinutesBefore);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.doesNotMatch(html, /data-next-prayer-dot="true"/);
});

test('SunArcDial vakte 2 saat kala sıradaki vakit dot\'unu gösterir', () => {
  const twoHoursBefore = new Date(ikindiTime.getTime() - 2 * 60 * 60 * 1000);
  const schedule = deriveLiveSchedule(day, twoHoursBefore);

  const html = renderToStaticMarkup(React.createElement(SunArcDial, { schedule }));

  assert.match(html, /data-next-prayer-dot="true"/);
});
