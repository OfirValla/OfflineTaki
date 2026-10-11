export type Listener<T> = (event: T) => void;
export type Unsubscribe = () => void;

/** Minimal synchronous event emitter with a single event type. */
export class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();

  subscribe(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: T): void {
    // Copy so that listeners may unsubscribe while being notified.
    for (const listener of Array.from(this.listeners)) {
      listener(event);
    }
  }

  get size(): number {
    return this.listeners.size;
  }

  clear(): void {
    this.listeners.clear();
  }
}
