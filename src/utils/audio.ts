/**
 * Web Audio API based soft spiritual chime synthesizer for previewing prayer sounds
 */

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
  } catch (err) {
    console.log('Audio playback error:', err);
  }
}

export function playEzanSample() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Warm, soothing multi-tone vocal-like synth resonance
    const notes = [
      { freq: 293.66, delay: 0.0, duration: 1.2 }, // D4
      { freq: 329.63, delay: 0.8, duration: 1.4 }, // E4
      { freq: 349.23, delay: 1.8, duration: 2.0 }, // F4
      { freq: 440.00, delay: 3.2, duration: 2.5 }, // A4
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.delay);

      const startTime = ctx.currentTime + note.delay;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + note.duration);
    });
  } catch (err) {
    console.log('Audio playback error:', err);
  }
}
