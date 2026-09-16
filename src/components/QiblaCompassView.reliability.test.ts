import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeRoseRotation, HeadingReliability } from '../utils/compassHeading';
import { calculateQiblaBearing } from '../utils/qibla';
import { DEFAULT_LOCATION } from '../data/locations';

/**
 * Pusula güvenilir değilken (kalibresiz manyetometre ya da yakında metal)
 * yön göstermek, yanlış yöne namaza durdurur — bu, hiç göstermemekten
 * kötüdür. Bu yüzden 'calibrate'/'interference' durumunda ibre de
 * "… dönün" yönlendirmesi de render EDİLMEMELİ; yalnızca açı değeri ve
 * uyarı kalmalı.
 */

const HEADING = 100;
const reliabilityState = { value: 'ok' as HeadingReliability };

let QiblaCompassView: typeof import('./QiblaCompassView').QiblaCompassView;

before(async () => {
  mock.module('../hooks/useCompassHeading', {
    namedExports: {
      useCompassHeading: () => ({
        heading: HEADING,
        permissionState: 'granted',
        requestPermission: async () => {},
        needsCalibration: false,
        reliability: reliabilityState.value,
        debug: {
          alpha: null,
          webkitCompassHeading: undefined,
          webkitCompassAccuracy: undefined,
          isAbsolute: false,
          screenAngle: 0,
          rawHeading: 95,
          smoothedHeading: null,
          driftDeg: null,
          activeEventType: 'none',
          firstRawHeadingDeg: null,
          userAgentSummary: 'test',
          stats: null,
          driftCharacter: 'insufficient-data',
          source: 'native-accmag',
          declination: 5.3,
          accuracy: 3,
          fieldUt: 46,
          rvHeadingTrue: 190.3,
          reliability: reliabilityState.value,
        },
      }),
    },
  });

  ({ QiblaCompassView } = await import('./QiblaCompassView'));
});

function renderWith(reliability: HeadingReliability): string {
  reliabilityState.value = reliability;
  return renderToStaticMarkup(
    React.createElement(QiblaCompassView, { location: DEFAULT_LOCATION, active: true })
  );
}

test('parazit varken "dönün" yönlendirmesi hiç render edilmez', () => {
  const html = renderWith('interference');
  assert.equal(html.includes('dönün'), false);
});

test('parazit varken ibre (KÂBE başlığı) render edilmez', () => {
  const html = renderWith('interference');
  assert.equal(html.includes('KÂBE'), false);
});

test('parazit uyarısı kullanıcıya ne yapacağını söyler', () => {
  const html = renderWith('interference');
  assert.equal(html.includes('manyetik parazit'), true);
});

test('kalibresizken "dönün" yönlendirmesi hiç render edilmez', () => {
  const html = renderWith('calibrate');
  assert.equal(html.includes('dönün'), false);
});

test('kalibrasyon uyarısı 8 çizme talimatını içerir', () => {
  const html = renderWith('calibrate');
  assert.equal(html.includes('8 çizerek'), true);
});

test('güvenilir okumada yönlendirme ve ibre geri gelir', () => {
  const html = renderWith('ok');
  assert.equal(html.includes('dönün'), true);
  assert.equal(html.includes('KÂBE'), true);
});

test('açı değeri her durumda görünür kalır — pusula susarsa bile kullanıcı açıyı okuyabilmeli', () => {
  const expected = `${Math.round(calculateQiblaBearing(DEFAULT_LOCATION))}°`;
  assert.equal(renderWith('interference').includes(expected), true);
  assert.equal(renderWith('calibrate').includes(expected), true);
});

test("N/E/S/W halkası heading'in tersine döner", () => {
  const html = renderWith('ok');
  assert.equal(html.includes(`rotate(${computeRoseRotation(HEADING)}deg)`), true);
});

test('yönerge metni telefonu elde yere paralel tutmayı söyler', () => {
  const html = renderWith('ok');
  assert.equal(
    html.includes('Telefonu elinizde yere paralel tutun ve üst kenarını Kâbe ibresine çevirin.'),
    true
  );
});
