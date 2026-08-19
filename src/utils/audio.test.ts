import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playEzanAudio, stopEzanAudio } from './audio';

/**
 * Bu repo'da jsdom/RTL yok (node:test + react-dom/server ile çalışıyor),
 * o yüzden Önizle/Durdur davranışı burada gerçek bileşen yerine audio.ts'in
 * dışa açtığı saf fonksiyonlar üzerinden, global `Audio` sahte bir sınıfla
 * stublanarak test ediliyor (pushClient.test.ts'teki fetch/navigator stub
 * deseniyle aynı yaklaşım).
 */
class FakeAudioElement {
  currentTime = 0;
  onended: (() => void) | null = null;
  playCalls = 0;
  pauseCalls = 0;
  constructor(public src: string) {}
  play() {
    this.playCalls++;
    return Promise.resolve();
  }
  pause() {
    this.pauseCalls++;
  }
}

const instances: FakeAudioElement[] = [];
(globalThis as unknown as { Audio: unknown }).Audio = class extends FakeAudioElement {
  constructor(src: string) {
    super(src);
    instances.push(this);
  }
};

test('playEzanAudio ilk çağrıda tek bir Audio örneği oluşturur ve play() çağırır', () => {
  playEzanAudio();
  assert.equal(instances.length, 1, 'tek bir Audio örneği oluşturulmalı');
  assert.equal(instances[0].playCalls, 1);
});

test('playEzanAudio onEnded callback ile çağrıldığında onended handler kaydeder ve ended tetiklenince çalışır', () => {
  let ended = false;
  playEzanAudio(() => {
    ended = true;
  });
  assert.equal(instances.length, 1, 'ikinci çağrıda yeni Audio örneği oluşturulmamalı (paylaşılan singleton)');
  instances[0].onended?.();
  assert.equal(ended, true);
});

test('playEzanAudio callback verilmeden çağrıldığında önceki onended handlerını temizler', () => {
  playEzanAudio();
  assert.equal(instances[0].onended, null);
});

test('stopEzanAudio pause() çağırır ve currentTime sıfırlanır', () => {
  instances[0].currentTime = 42;
  stopEzanAudio();
  assert.equal(instances[0].pauseCalls >= 1, true);
  assert.equal(instances[0].currentTime, 0);
});
