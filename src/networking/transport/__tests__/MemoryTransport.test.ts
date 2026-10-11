import { MemoryNetwork } from '../MemoryTransport';
import type { GameAdvertisement, TransportEvent } from '../types';

const ad: GameAdvertisement = {
  protocolVersion: 1,
  gameId: '00000000-0000-4000-8000-000000000001',
  gameName: 'Test Game',
  hostName: 'Host',
  playerCount: 1,
  maxPlayers: 4,
  requiresJoinCode: false,
};

function record(transport: {
  subscribe: (l: (e: TransportEvent) => void) => () => void;
}) {
  const events: TransportEvent[] = [];
  transport.subscribe(e => events.push(e));
  return events;
}

describe('MemoryNetwork', () => {
  it('delivers gameFound to discoverers before and after advertising starts', async () => {
    const net = new MemoryNetwork();
    const host = net.createTransport('host');
    const early = net.createTransport('early');
    const late = net.createTransport('late');
    const earlyEvents = record(early);
    const lateEvents = record(late);

    await early.startDiscovery();
    await host.startAdvertising(ad);
    await late.startDiscovery();

    expect(earlyEvents.filter(e => e.type === 'gameFound')).toHaveLength(1);
    expect(lateEvents.filter(e => e.type === 'gameFound')).toHaveLength(1);

    await host.stopAdvertising();
    expect(earlyEvents.at(-1)).toEqual({ type: 'gameLost', peerId: 'host' });
  });

  it('connects both ends and delivers messages in order', async () => {
    const net = new MemoryNetwork();
    const host = net.createTransport('host');
    const client = net.createTransport('client');
    const hostEvents = record(host);
    const clientEvents = record(client);

    await host.startAdvertising(ad);
    await client.connect('host');
    expect(
      hostEvents.some(e => e.type === 'peerConnected' && e.peerId === 'client'),
    ).toBe(true);
    expect(
      clientEvents.some(e => e.type === 'peerConnected' && e.peerId === 'host'),
    ).toBe(true);

    for (let i = 0; i < 20; i++) await client.send('host', `m${i}`);
    await net.flush();
    const received = hostEvents
      .filter(e => e.type === 'message')
      .map(e => (e as { payload: string }).payload);
    expect(received).toEqual(Array.from({ length: 20 }, (_, i) => `m${i}`));
  });

  it('refuses to connect to a node that is not advertising', async () => {
    const net = new MemoryNetwork();
    net.createTransport('host');
    const client = net.createTransport('client');
    await expect(client.connect('host')).rejects.toThrow(/not accepting/);
  });

  it('reports local and remote disconnects', async () => {
    const net = new MemoryNetwork();
    const host = net.createTransport('host');
    const client = net.createTransport('client');
    const hostEvents = record(host);
    const clientEvents = record(client);
    await host.startAdvertising(ad);
    await client.connect('host');

    await client.disconnect('host');
    await net.flush();
    expect(clientEvents.at(-1)).toEqual({
      type: 'peerDisconnected',
      peerId: 'host',
      reason: 'local',
    });
    expect(hostEvents.at(-1)).toEqual({
      type: 'peerDisconnected',
      peerId: 'client',
      reason: 'remote',
    });
    expect(net.isConnected('host', 'client')).toBe(false);
  });

  it('can drop and duplicate messages deterministically', async () => {
    const net = new MemoryNetwork();
    const host = net.createTransport('host');
    const client = net.createTransport('client');
    const hostEvents = record(host);
    await host.startAdvertising(ad);
    await client.connect('host');

    // random() is consulted twice per message: duplicate? then drop? (per copy)
    const sequence = [0.9, 0.05, 0.9, 0.9, 0.05, 0.9, 0.9];
    let i = 0;
    net.setFaults(
      { dropRate: 0.1, duplicateRate: 0.1 },
      () => sequence[i++ % sequence.length],
    );

    await client.send('host', 'a'); // 0.9 no dup, 0.05 dropped
    await client.send('host', 'b'); // 0.9 no dup, 0.9 delivered
    await client.send('host', 'c'); // 0.05 duplicated, 0.9 delivered, 0.9 delivered
    await net.flush();

    const received = hostEvents
      .filter(e => e.type === 'message')
      .map(e => (e as { payload: string }).payload);
    expect(received).toEqual(['b', 'c', 'c']);
  });
});
