import {
  LobbyPhase,
  MessageType,
  PROTOCOL_VERSION,
  PlayerKind,
  createMessage,
  encodeMessage,
} from '../protocol';
import { createTable } from '../testing/harness';
import type { GameSession } from '../session/SessionState';
import type { TransportEvent } from '../transport/types';

const names = (s: GameSession) => s.getState().peers.map(p => p.name);
const chatTexts = (s: GameSession) =>
  s
    .getState()
    .messages.filter(m => m.kind === 'chat')
    .map(m => `${m.fromName}: ${m.text}`);

describe('lobby over the in-memory transport', () => {
  it('lets two clients join, see each other, and exchange relayed chat', async () => {
    const t = createTable();
    await t.host.startHosting();
    expect(t.host.getState().status).toBe('hosting');

    const a = t.makeClient('a', 'Daniel');
    const gameA = await t.discover(a.transport);
    expect(gameA.gameName).toBe("Ofir's Game");
    expect(gameA.playerCount).toBe(1);
    expect(gameA.maxPlayers).toBe(6);

    await a.session.join(gameA);
    await t.net.flush();
    expect(a.session.getState().status).toBe('joined');
    expect(a.session.getState().reconnectToken).toEqual(expect.any(String));
    expect(names(a.session)).toEqual(['Ofir']);
    expect(names(t.host)).toEqual(['Daniel']);

    const b = await t.joinClient('b', 'Amit');
    expect(names(t.host)).toEqual(['Daniel', 'Amit']);
    expect(names(a.session).sort()).toEqual(['Amit', 'Ofir']);
    expect(names(b.session).sort()).toEqual(['Daniel', 'Ofir']);

    await a.session.sendChat('Hello from Daniel');
    await t.net.flush();
    await t.host.sendChat('Hello from Ofir');
    await t.net.flush();
    const expected = ['Daniel: Hello from Daniel', 'Ofir: Hello from Ofir'];
    expect(chatTexts(t.host)).toEqual(expected);
    expect(chatTexts(a.session)).toEqual(expected);
    expect(chatTexts(b.session)).toEqual(expected);
  });

  it('removes a client that leaves the lobby and tells the others', async () => {
    const t = createTable();
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    const b = await t.joinClient('b', 'Amit');

    await a.session.leave();
    await t.net.flush();

    expect(names(t.host)).toEqual(['Amit']);
    expect(names(b.session)).toEqual(['Ofir']);
    expect(t.host.getState().messages.at(-1)?.text).toBe('Daniel left');
  });

  it('rejects a client when every seat is taken', async () => {
    const t = createTable({ seatCount: 2 });
    await t.host.startHosting();
    await t.joinClient('a', 'Daniel');
    const b = t.makeClient('b', 'Amit');
    await expect(b.session.join(await t.discover(b.transport))).rejects.toThrow(
      /full/i,
    );
    expect(b.session.getState().status).toBe('rejected');
    expect(t.host.getState().peers).toHaveLength(1);
  });

  it('lets the host change the seat count, never below the humans present', async () => {
    const t = createTable({ seatCount: 4 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');

    expect(await t.host.setSeatCount(1)).toBe(2);
    expect(await t.host.setSeatCount(99)).toBe(8);
    expect(await t.host.setSeatCount(3)).toBe(3);
    await t.net.flush();
    expect(a.session.getState().seatCount).toBe(3);
    expect(t.host.openSeats()).toBe(1);

    const late = t.makeClient('late', 'Noa');
    expect((await t.discover(late.transport)).maxPlayers).toBe(3);
  });

  it('fills open seats with bots at start and deals everyone a hand', async () => {
    const t = createTable({ seatCount: 4 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');

    await t.host.startGame();
    await t.settle();

    expect(t.host.getState().phase).toBe(LobbyPhase.Started);
    expect(names(t.host)).toEqual(['Daniel', 'Bot 1', 'Bot 2']);
    expect(a.session.getState().phase).toBe(LobbyPhase.Started);
    expect(names(a.session)).toEqual(['Ofir', 'Bot 1', 'Bot 2']);
    expect(a.session.getState().game?.you.hand).toHaveLength(8);
    expect(t.host.getState().game?.you.hand).toHaveLength(8);
    expect(a.session.getState().game?.players.map(p => p.cardCount)).toEqual([
      8, 8, 8, 8,
    ]);
    expect(t.net.isAdvertising('host')).toBe(false);
    await expect(t.host.setSeatCount(5)).rejects.toThrow(
      /after the game has started/,
    );
  });

  it('rejects anyone who tries to join after the game started', async () => {
    const t = createTable({ seatCount: 4 });
    await t.host.startHosting();
    const a = t.makeClient('a', 'Daniel');
    const game = await t.discover(a.transport);
    await t.host.startGame();
    await t.settle();
    await expect(a.session.join(game)).rejects.toThrow();
    expect(
      t.host.getState().peers.filter(p => p.kind === PlayerKind.Human),
    ).toHaveLength(0);
  });

  it('rejects a client with a different protocol version', async () => {
    const t = createTable();
    await t.host.startHosting();
    const rogue = t.makeClient('rogue', 'Old App');
    const game = await t.discover(rogue.transport);
    await rogue.transport.connect(game.peerId);
    const hello = createMessage(
      MessageType.Hello,
      { gameId: game.gameId, senderId: 'p-rogue' },
      {
        playerName: 'Old App',
        protocolVersion: PROTOCOL_VERSION + 1,
        appVersion: '0.0.1',
      },
    );
    await rogue.transport.send(game.peerId, encodeMessage(hello));
    await t.net.flush();
    expect(t.host.getState().peers).toHaveLength(0);
    expect(t.net.isConnected('host', 'rogue')).toBe(false);
  });

  it('ignores garbage and messages from peers that never said hello', async () => {
    const t = createTable();
    await t.host.startHosting();
    const sneaky = t.makeClient('sneaky', 'Sneaky');
    const game = await t.discover(sneaky.transport);
    await sneaky.transport.connect(game.peerId);
    await sneaky.transport.send(game.peerId, 'not json at all');
    const chat = createMessage(
      MessageType.Chat,
      { gameId: game.gameId, senderId: 'p-sneaky' },
      { text: 'I never joined', senderName: 'Sneaky' },
    );
    await sneaky.transport.send(game.peerId, encodeMessage(chat));
    await t.net.flush();
    expect(
      t.host.getState().messages.filter(m => m.kind === 'chat'),
    ).toHaveLength(0);
    expect(t.host.getState().peers).toHaveLength(0);
  });

  it('marks clients disconnected when the host stops hosting', async () => {
    const t = createTable();
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    await t.host.leave();
    await t.net.flush();
    expect(t.host.getState().status).toBe('closed');
    expect(a.session.getState().status).toBe('disconnected');
    expect(a.session.getState().error).toMatch(/host/i);
  });

  it('times out when the host never answers HELLO', async () => {
    const t = createTable();
    const silent = t.net.createTransport('silent');
    await silent.startAdvertising({
      protocolVersion: PROTOCOL_VERSION,
      gameId: '00000000-0000-4000-8000-0000000000ff',
      gameName: 'Silent',
      hostName: 'Nobody',
      playerCount: 1,
      maxPlayers: 4,
      requiresJoinCode: false,
    });
    const a = t.makeClient('a', 'Daniel');
    const found = new Promise<TransportEvent>(resolve => {
      const unsubscribe = a.transport.subscribe(e => {
        if (e.type === 'gameFound' && e.game.hostName === 'Nobody') {
          unsubscribe();
          resolve(e);
        }
      });
    });
    await a.transport.startDiscovery();
    const event = await found;
    if (event.type !== 'gameFound') throw new Error('unexpected');
    await expect(a.session.join(event.game)).rejects.toThrow(/did not answer/);
    expect(a.session.getState().status).toBe('disconnected');
  });
});
