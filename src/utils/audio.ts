/**
 * Web Audio API based soft spiritual chime synthesizer — used for the
 * zikirmatik's lap-completion feedback, not for any notification sound
 * (design-refresh-v3 Faz 7 F1: no browser lets a web app choose a push
 * notification's sound, so this app no longer pretends otherwise).
 */

const EZAN_AUDIO_SRC = '/sounds/ezan.mp3';

export function playSoftChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Gentle pentatonic harmony frequencies (A4, C#5, E5, G#5)
    const frequencies = [440, 554.37, 659.25, 830.61];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);

      const startTime = ctx.currentTime + idx * 0.15;
      const duration = 2.5;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    const totalDurationMs = ((frequencies.length - 1) * 0.15 + 2.5) * 1000;
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, totalDurationMs + 100);
  } catch (err) {
    console.log('Audio playback error:', err);
  }
}

/**
 * Plays the real Wikimedia Commons ezan recording (CC BY-SA 4.0, see
 * public/sounds/ATTRIBUTION.md) — triggered only while the app is open in a
 * tab, either by AppSettings.playEzanInForeground (App.tsx's active-prayer
 * effect) or the settings preview button. Falls back to silence on
 * playback failure (e.g. browser autoplay restrictions) rather than
 * throwing.
 */
let ezanAudioElement: HTMLAudioElement | null = null;

/**
 * onEnded verilirse ses doğal olarak bitince (örn. önizleme) tetiklenir;
 * verilmezse önceki bir çağrıdan kalmış olabilecek handler temizlenir —
 * aksi halde önizlemeden kalan callback, sonraki gerçek ezan çalışında da
 * (App.tsx'in playEzanInForeground tetiklemesi) yanlışlıkla çalışırdı.
 */
export function playEzanAudio(onEnded?: () => void) {
  try {
    if (!ezanAudioElement) {
      ezanAudioElement = new Audio(EZAN_AUDIO_SRC);
    }
    ezanAudioElement.onended = onEnded ?? null;
    ezanAudioElement.pause();
    ezanAudioElement.currentTime = 0;
    ezanAudioElement.play().catch((err) => {
      console.log('Ezan sesi çalınamadı:', err);
    });
  } catch (err) {
    console.log('Ezan sesi çalınamadı:', err);
  }
}

export function stopEzanAudio() {
  try {
    if (ezanAudioElement) {
      ezanAudioElement.pause();
      ezanAudioElement.currentTime = 0;
    }
  } catch (err) {
    console.log('Ezan sesi durdurulamadı:', err);
  }
}
