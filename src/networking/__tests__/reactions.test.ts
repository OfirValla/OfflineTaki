import {
  MessageType,
  createMessage,
  decodeMessage,
  encodeMessage,
} from '../protocol';
import type { SessionEvent } from '../session/SessionState';
import { createTable } from '../testing/harness';

describe('emoji reactions', () => {
  it('reach every phone, land in the chat log and raise an event', async () => {
    const t = createTable({ seatCount: 3 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');
    const b = await t.joinClient('b', 'Amit');
    const hostEvents: SessionEvent[] = [];
    t.host.subscribeEvents(e => hostEvents.push(e));

    await a.session.sendReaction('😂');
    await t.settle();

    for (const s of [t.host, a.session, b.session]) {
      const reactions = s.getState().reactions;
      expect(reactions).toHaveLength(1);
      expect(reactions[0]).toMatchObject({
        playerId: 'p-a',
        name: 'Daniel',
        emoji: '😂',
      });
      expect(s.getState().messages.at(-1)).toMatchObject({
        kind: 'chat',
        fromName: 'Daniel',
        text: '😂',
      });
    }
    expect(hostEvents.filter(e => e.type === 'reaction')).toHaveLength(1);

    await t.host.sendReaction('👏');
    await t.settle();
    expect(b.session.getState().reactions.map(r => r.emoji)).toEqual([
      '😂',
      '👏',
    ]);
  });

  it('drops reactions that arrive faster than the rate limit', async () => {
    const t = createTable({ seatCount: 2 });
    await t.host.startHosting();
    const a = await t.joinClient('a', 'Daniel');

    await a.session.sendReaction('🔥');
    await a.session.sendReaction('🔥');
    await a.session.sendReaction('🔥');
    await t.settle();

    expect(a.session.getState().reactions).toHaveLength(3); // the sender always sees its own
    expect(t.host.getState().reactions).toHaveLength(1); // the table only gets the first
  });

  it('refuses emoji outside the fixed list and from peers that never joined', async () => {
    const raw = JSON.stringify({
      v: 2,
      t: MessageType.Reaction,
      id: 'x',
      gid: 'g',
      from: 'p',
      ts: 0,
      p: { emoji: '💩', senderName: 'A' },
    });
    expect(decodeMessage(raw).ok).toBe(false);

    const t = createTable({ seatCount: 3 });
    await t.host.startHosting();
    const sneaky = t.makeClient('sneaky', 'Sneaky');
    const game = await t.discover(sneaky.transport);
    await sneaky.transport.connect(game.peerId);
    const message = createMessage(
      MessageType.Reaction,
      { gameId: game.gameId, senderId: 'p-sneaky' },
      { emoji: '😎', senderName: 'Sneaky' },
    );
    await sneaky.transport.send(game.peerId, encodeMessage(message));
    await t.settle();
    expect(t.host.getState().reactions).toHaveLength(0);
  });
});
