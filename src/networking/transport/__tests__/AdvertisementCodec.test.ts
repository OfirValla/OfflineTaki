import {
  decodeAdvertisement,
  encodeAdvertisement,
  sanitizeName,
} from '../AdvertisementCodec';
import type { GameAdvertisement } from '../types';

const base: GameAdvertisement = {
  protocolVersion: 1,
  gameId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  gameName: "Ofir's Game",
  hostName: 'Ofir',
  playerCount: 3,
  maxPlayers: 6,
  requiresJoinCode: false,
};

function utf8Length(text: string): number {
  return encodeURIComponent(text).replace(/%[0-9A-F]{2}/gi, 'x').length;
}

describe('AdvertisementCodec', () => {
  it('round-trips a normal advertisement', () => {
    const encoded = encodeAdvertisement(base);
    expect(decodeAdvertisement(encoded)).toEqual(base);
  });

  it('stays short enough for a Bluetooth advertisement', () => {
    const long = {
      ...base,
      gameName: 'A'.repeat(60),
      hostName: 'B'.repeat(60),
    };
    expect(utf8Length(encodeAdvertisement(long))).toBeLessThanOrEqual(100);
  });

  it('encodes the join-code flag', () => {
    const decoded = decodeAdvertisement(
      encodeAdvertisement({ ...base, requiresJoinCode: true }),
    );
    expect(decoded?.requiresJoinCode).toBe(true);
  });

  it('removes the separator from names so the frame still parses', () => {
    const decoded = decodeAdvertisement(
      encodeAdvertisement({ ...base, gameName: 'Yes|No|Maybe', hostName: '|' }),
    );
    expect(decoded?.gameName).toBe('Yes/No/Maybe');
    expect(decoded?.hostName).toBe('/');
  });

  it('truncates names to 20 characters', () => {
    expect(sanitizeName('x'.repeat(50))).toHaveLength(20);
    expect(sanitizeName('   ')).toBe('?');
  });

  it('rejects frames from other apps or corrupted frames', () => {
    expect(decodeAdvertisement('Pixel 7')).toBeNull();
    expect(decodeAdvertisement('TK|1|nothex|a|b|1|6|-')).toBeNull();
    expect(
      decodeAdvertisement('TK|1|3f2504e04f8911d39a0c0305e82c3301|a|b|x|6|-'),
    ).toBeNull();
    expect(
      decodeAdvertisement('TK|1|3f2504e04f8911d39a0c0305e82c3301|a|b|1|6'),
    ).toBeNull();
    expect(
      decodeAdvertisement('TK|0|3f2504e04f8911d39a0c0305e82c3301|a|b|1|6|-'),
    ).toBeNull();
  });
});
