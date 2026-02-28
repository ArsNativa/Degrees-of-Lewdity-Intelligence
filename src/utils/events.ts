/**
 * Minimal typed event emitter.
 *
 * Usage:
 *   const bus = new EventBus<{ 'status-change': [NetworkStatus]; 'message': [string] }>();
 *   bus.on('status-change', (s) => console.log(s));
 *   bus.emit('status-change', NetworkStatus.OK);
 */
type Listener<A extends unknown[]> = (...args: A) => void;

export class EventBus<EventMap extends Record<string, unknown[]>> {
  private listeners = new Map<keyof EventMap, Set<Listener<any>>>();

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    // Return unsubscribe function
    return () => this.off(event, fn);
  }

  once<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): () => void {
    const wrapper: Listener<EventMap[K]> = (...args) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error(`[EventBus] Error in listener for "${String(event)}":`, e);
      }
    });
  }

  removeAll(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
