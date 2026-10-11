#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-bitwise -- the noise generator is 32-bit integer arithmetic */
/**
 * Synthesises the game's sound effects as small 16-bit mono WAV files, so the app ships
 * licence-free audio and needs no downloads. Output goes to android/app/src/main/res/raw.
 *
 *   node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'res',
  'raw',
);

// --- tiny synth -----------------------------------------------------------------------------

const TAU = Math.PI * 2;
const sine = (f, t) => Math.sin(TAU * f * t);
const triangle = (f, t) => (2 / Math.PI) * Math.asin(Math.sin(TAU * f * t));
const square = (f, t) => (Math.sin(TAU * f * t) >= 0 ? 1 : -1);

/** Deterministic noise so every build produces identical files. */
function makeNoise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

/** Attack–decay envelope: linear attack, exponential decay to zero at `duration`. */
function env(t, attack, duration, curve = 4) {
  if (t < 0 || t > duration) return 0;
  if (t < attack) return t / attack;
  const x = (t - attack) / Math.max(1e-6, duration - attack);
  return Math.exp(-curve * x) * (1 - x * 0.15);
}

/** Renders `seconds` of audio from a per-sample callback (t in seconds). */
function render(seconds, sampleAt) {
  const n = Math.round(seconds * SAMPLE_RATE);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = sampleAt(i / SAMPLE_RATE, i);
  return out;
}

function mix(...layers) {
  const n = Math.max(...layers.map(l => l.length));
  const out = new Float64Array(n);
  for (const l of layers) for (let i = 0; i < l.length; i++) out[i] += l[i];
  return out;
}

/** Shifts a layer later in time by `seconds`. */
function delay(layer, seconds) {
  const offset = Math.round(seconds * SAMPLE_RATE);
  const out = new Float64Array(layer.length + offset);
  out.set(layer, offset);
  return out;
}

/** One-pole low-pass, cutoff in Hz. */
function lowpass(samples, cutoff) {
  const rc = 1 / (TAU * cutoff);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  const out = new Float64Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i] - y);
    out[i] = y;
  }
  return out;
}

function highpass(samples, cutoff) {
  const low = lowpass(samples, cutoff);
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] - low[i];
  return out;
}

function normalize(samples, peak = 0.82) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const k = peak / max;
  return samples.map(s => s * k);
}

function writeWav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

// --- musical helpers -------------------------------------------------------------------------

const NOTE = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.5,
};

/** A plucked, bell-like tone with a touch of second harmonic. */
function pluck(freq, duration, gain = 1, curve = 5) {
  return render(duration, t => {
    const e = env(t, 0.004, duration, curve);
    return (
      gain *
      e *
      (0.75 * sine(freq, t) +
        0.2 * sine(freq * 2, t) +
        0.05 * sine(freq * 3, t))
    );
  });
}

/** Soft, warm tone with vibrato for sustained notes. */
function warm(freq, duration, gain = 1) {
  return render(duration, t => {
    const vib = 1 + 0.004 * Math.sin(TAU * 5.5 * t);
    const e = env(t, 0.02, duration, 2.5);
    return (
      gain *
      e *
      (0.6 * sine(freq * vib, t) +
        0.3 * triangle(freq * vib, t) +
        0.1 * sine(freq * 2 * vib, t))
    );
  });
}

/** A card hitting the pile: filtered noise snap plus a low thump. */
function cardSnap(seed, duration = 0.13, thumpFreq = 170) {
  const noise = makeNoise(seed);
  const snap = lowpass(
    highpass(
      render(duration, t => noise() * env(t, 0.001, duration, 9)),
      900,
    ),
    5200,
  );
  const thump = render(
    duration,
    t => 0.6 * env(t, 0.002, duration, 7) * sine(thumpFreq * (1 - t * 2.5), t),
  );
  return mix(snap, thump);
}

// --- the effects -----------------------------------------------------------------------------

const sounds = {
  // A card lands on the discard pile.
  card_play: () => cardSnap(11),

  // A card slides off the draw pile: a soft swish.
  card_draw: () => {
    const noise = makeNoise(23);
    const d = 0.2;
    return lowpass(
      highpass(
        render(
          d,
          t => noise() * Math.sin(Math.PI * Math.min(1, t / d)) ** 2 * 0.9,
        ),
        1400,
      ),
      3800,
    );
  },

  // Your turn: two bright notes, E5 then A5.
  your_turn: () =>
    mix(pluck(NOTE.E5, 0.28, 0.9), delay(pluck(NOTE.A5, 0.42, 1), 0.14)),

  // A TAKI opens: a quick rising arpeggio.
  taki: () =>
    mix(
      pluck(NOTE.C5, 0.22, 0.8),
      delay(pluck(NOTE.E5, 0.22, 0.8), 0.09),
      delay(pluck(NOTE.G5, 0.22, 0.85), 0.18),
      delay(pluck(NOTE.C6, 0.36, 0.95), 0.27),
    ),

  // Stop / Plus / Change Direction: a short zap sweeping down.
  special: () =>
    render(0.3, t => {
      const f = 950 - 650 * Math.min(1, t / 0.25);
      return (
        env(t, 0.004, 0.3, 5) * (0.7 * sine(f, t) + 0.3 * square(f, t) * 0.4)
      );
    }),

  // A colour is chosen: a glassy bling.
  color: () =>
    mix(pluck(1175, 0.32, 0.8, 6), delay(pluck(1760, 0.38, 0.7, 6), 0.05)),

  // Illegal move: a low buzz.
  reject: () =>
    render(0.26, t => {
      const e = env(t, 0.003, 0.26, 3);
      return e * (0.5 * square(110, t) + 0.5 * square(113, t)) * 0.6;
    }),

  // You won: a fanfare.
  win: () =>
    mix(
      pluck(NOTE.C5, 0.3, 0.85),
      delay(pluck(NOTE.E5, 0.3, 0.85), 0.15),
      delay(pluck(NOTE.G5, 0.3, 0.9), 0.3),
      delay(warm(NOTE.C6, 0.85, 0.9), 0.45),
      delay(warm(NOTE.E6, 0.7, 0.35), 0.5),
    ),

  // Someone else won: three descending notes.
  lose: () =>
    mix(
      warm(NOTE.G4, 0.35, 0.8),
      delay(warm(NOTE.E4, 0.35, 0.8), 0.28),
      delay(warm(NOTE.C4, 0.6, 0.85), 0.56),
    ),

  // A player joined the lobby: a quick pop.
  join: () =>
    render(0.22, t => {
      const f = 520 + 420 * Math.min(1, t / 0.08);
      return env(t, 0.003, 0.22, 6) * sine(f, t);
    }),

  // The deal: a burst of card snaps.
  start: () => {
    const snaps = [0, 0.07, 0.13, 0.2, 0.26, 0.33, 0.41].map((at, i) =>
      delay(cardSnap(100 + i, 0.1, 150 + i * 10), at),
    );
    return mix(...snaps);
  },

  // A button tap: a tiny tick.
  tap: () => {
    const noise = makeNoise(7);
    return lowpass(
      render(0.045, t => noise() * env(t, 0.0005, 0.045, 12)),
      6000,
    );
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, build] of Object.entries(sounds)) {
  const samples = normalize(build());
  const file = path.join(OUT_DIR, `sfx_${name}.wav`);
  writeWav(file, samples);
  console.log(
    `${path.basename(file)}  ${(samples.length / SAMPLE_RATE).toFixed(2)}s  ${(
      fs.statSync(file).size / 1024
    ).toFixed(1)} KB`,
  );
}
