/**
 * Web Audio API based soft spiritual chime synthesizer for previewing prayer sounds
 */

import type { SoundMode } from '../types';

const EZAN_AUDIO_SRC = '/sounds/ezan.mp3';

const ILAHI_NOTE_SEQUENCES: Record<1 | 2 | 3, number[]> = {
  1: [392.0, 440.0, 493.88, 523.25, 587.33], // G4 A4 B4 C5 D5 - yükselen sakin dizi
  2: [523.25, 493.88, 440.0, 392.0, 349.23], // C5 B4 A4 G4 F4 - alçalan sakin dizi
  3: [440.0, 493.88, 587.33, 493.88, 440.0], // A4 B4 D5 B4 A4 - dalgalı sakin dizi
};

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
 * attribution note in SpiritualSettings). Falls back to silence on
 * playback failure (e.g. browser autoplay restrictions) rather than
 * throwing.
 */
let ezanAudioElement: HTMLAudioElement | null = null;

export function playEzanAudio() {
  try {
    if (!ezanAudioElement) {
      ezanAudioElement = new Audio(EZAN_AUDIO_SRC);
    }
    ezanAudioElement.pause();
    ezanAudioElement.currentTime = 0;
    ezanAudioElement.play().catch((err) => {
      console.log('Ezan sesi çalınamadı:', err);
    });
  } catch (err) {
    console.log('Ezan sesi çalınamadı:', err);
  }
}

export function playIlahiSample(variant: 1 | 2 | 3) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const notes = ILAHI_NOTE_SEQUENCES[variant];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const startTime = ctx.currentTime + idx * 0.35;
      const duration = 1.2;

      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    const totalDurationMs = ((notes.length - 1) * 0.35 + 1.2) * 1000;
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, totalDurationMs + 100);
  } catch (err) {
    console.log('İlahi sesi çalınamadı:', err);
  }
}

/**
 * Central dispatcher used by both the settings preview buttons and the
 * foreground auto-play effect in App.tsx, so the SoundMode -> player
 * mapping lives in exactly one place.
 */
export function playSoundForMode(mode: SoundMode) {
  switch (mode) {
    case 'ezan':
      playEzanAudio();
      break;
    case 'tini':
      playSoftChime();
      break;
    case 'ilahi1':
      playIlahiSample(1);
      break;
    case 'ilahi2':
      playIlahiSample(2);
      break;
    case 'ilahi3':
      playIlahiSample(3);
      break;
    case 'sessiz':
    default:
      break;
  }
}
