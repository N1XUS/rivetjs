// Rivet: browser stand-in for the `node:events` / `stream` EventEmitter the upstream test helpers import (the suite
// runs in Chromium); only the methods the helpers call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

export class EventEmitter {
  #listeners = new Map<string, Set<Listener>>();
  setMaxListeners(_count: number): this {
    return this;
  }
  addListener(type: string, listener: Listener): this {
    let set = this.#listeners.get(type);
    if (!set) this.#listeners.set(type, (set = new Set()));
    set.add(listener);
    return this;
  }
  removeListener(type: string, listener: Listener): this {
    this.#listeners.get(type)?.delete(listener);
    return this;
  }
  emit(type: string, ...args: unknown[]): boolean {
    const set = this.#listeners.get(type);
    if (!set?.size) return false;
    for (const listener of [...set]) listener(...args);
    return true;
  }
}

export default EventEmitter;
