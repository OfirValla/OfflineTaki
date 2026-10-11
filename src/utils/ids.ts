/**
 * Random identifiers. Relies on `crypto.getRandomValues`, which React Native gets from the
 * `react-native-get-random-values` polyfill (imported first thing in index.js) and Node has
 * built in.
 */

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

function randomSource(): RandomSource {
  const source = (globalThis as unknown as { crypto?: RandomSource }).crypto;
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error(
      'crypto.getRandomValues is unavailable; import react-native-get-random-values first',
    );
  }
  return source;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  randomSource().getRandomValues(bytes);
  return bytes;
}

const HEX = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0'),
);

/** RFC 4122 version 4 UUID, lower-case, with dashes. */
export function uuid(): string {
  const b = randomBytes(16);
  /* eslint-disable no-bitwise -- RFC 4122 version and variant bits */
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  /* eslint-enable no-bitwise */
  const h = Array.from(b, byte => HEX[byte]);
  return (
    h.slice(0, 4).join('') +
    '-' +
    h.slice(4, 6).join('') +
    '-' +
    h.slice(6, 8).join('') +
    '-' +
    h.slice(8, 10).join('') +
    '-' +
    h.slice(10, 16).join('')
  );
}

/** Compact identifier for wire use: `length` hex characters. */
export function shortId(length = 8): string {
  const bytes = randomBytes(Math.ceil(length / 2));
  return Array.from(bytes, byte => HEX[byte])
    .join('')
    .slice(0, length);
}

/** Numeric join code, zero-padded, e.g. "0417". */
export function joinCode(digits = 4): string {
  const max = 10 ** digits;
  const value = new DataView(randomBytes(4).buffer).getUint32(0) % max;
  return value.toString().padStart(digits, '0');
}
