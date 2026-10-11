import {
  MessageType,
  PROTOCOL_VERSION,
  createMessage,
  decodeMessage,
  encodeMessage,
} from '..';

const context = { gameId: 'game-1', senderId: 'player-a' };

describe('protocol codec', () => {
  it('round-trips a HELLO message', () => {
    const message = createMessage(
      MessageType.Hello,
      context,
      {
        playerName: 'Ofir',
        protocolVersion: PROTOCOL_VERSION,
        appVersion: '0.1.0',
      },
      () => 1234,
    );
    const decoded = decodeMessage(encodeMessage(message));
    expect(decoded).toEqual({ ok: true, value: message });
    expect(message.ts).toBe(1234);
    expect(message.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gives every message a distinct id', () => {
    const a = createMessage(MessageType.Ping, context, { nonce: '1' });
    const b = createMessage(MessageType.Ping, context, { nonce: '1' });
    expect(a.id).not.toBe(b.id);
  });

  it('rejects text that is not JSON', () => {
    expect(decodeMessage('hello there')).toEqual({
      ok: false,
      error: { kind: 'not-json' },
    });
  });

  it('rejects unknown message types', () => {
    const raw = JSON.stringify({
      v: 2,
      t: 'LAUNCH_MISSILES',
      id: 'x',
      gid: 'g',
      from: 'p',
      ts: 0,
      p: {},
    });
    const result = decodeMessage(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects payloads that violate the schema', () => {
    const raw = JSON.stringify({
      v: 2,
      t: MessageType.Chat,
      id: 'x',
      gid: 'g',
      from: 'p',
      ts: 0,
      p: { text: '', senderName: 'A' },
    });
    const result = decodeMessage(raw);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'invalid') {
      expect(result.error.issues).toContain('p.text');
    }
  });

  it('rejects a lobby state with an impossible seat count or unknown player kind', () => {
    const base = {
      v: 2,
      t: MessageType.LobbyState,
      id: 'x',
      gid: 'g',
      from: 'p',
      ts: 0,
    };
    const good = {
      ...base,
      p: {
        phase: 'lobby',
        seatCount: 4,
        peers: [
          {
            playerId: 'a',
            name: 'A',
            isHost: true,
            kind: 'human',
            connected: true,
          },
        ],
      },
    };
    expect(decodeMessage(JSON.stringify(good)).ok).toBe(true);
    expect(
      decodeMessage(JSON.stringify({ ...good, p: { ...good.p, seatCount: 1 } }))
        .ok,
    ).toBe(false);
    expect(
      decodeMessage(JSON.stringify({ ...good, p: { ...good.p, seatCount: 9 } }))
        .ok,
    ).toBe(false);
    const alien = {
      ...good,
      p: { ...good.p, peers: [{ ...good.p.peers[0], kind: 'alien' }] },
    };
    expect(decodeMessage(JSON.stringify(alien)).ok).toBe(false);
  });

  it('rejects a different envelope version', () => {
    const raw = JSON.stringify({
      v: 3,
      t: MessageType.Ping,
      id: 'x',
      gid: 'g',
      from: 'p',
      ts: 0,
      p: { nonce: '1' },
    });
    expect(decodeMessage(raw).ok).toBe(false);
  });
});
