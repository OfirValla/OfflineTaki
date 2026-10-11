import type { EngineEvent } from '../../game';

export interface VersionedEvent {
  version: number;
  event: EngineEvent;
}

/**
 * Recent engine events by version, so a client with a small gap can catch up from events
 * instead of a full snapshot. Bounded: older events fall off and force a snapshot.
 */
export class EventLog {
  private readonly entries: VersionedEvent[] = [];
  private latest = 0;

  constructor(private readonly capacity = 256) {}

  get latestVersion(): number {
    return this.latest;
  }

  reset(version: number): void {
    this.entries.length = 0;
    this.latest = version;
  }

  /** Appends events numbered `latest + 1 ...` and returns them with their versions. */
  append(events: EngineEvent[]): VersionedEvent[] {
    const added = events.map(event => ({ version: ++this.latest, event }));
    this.entries.push(...added);
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
    return added;
  }

  /** Events after `knownVersion`, or null when they are no longer all available. */
  since(knownVersion: number): VersionedEvent[] | null {
    if (knownVersion >= this.latest) return [];
    const first = this.entries[0];
    if (!first || first.version > knownVersion + 1) return null;
    return this.entries.filter(e => e.version > knownVersion);
  }
}
