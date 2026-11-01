// `@rivetjs/router/live-source`: a value an SSE endpoint (`@rivetjs/router/sse` `eventStream`) keeps current. Leaf
// module (reactivity only, no runtime / router imports): the page opens it in its own `clientEffect`, so the compiler
// sees the page's client effect (the page is a boundary, its trigger wakes it at idle) and the effect's cleanup
// closes the connection when the page or component goes away (route leave). Signals here are not keyed state: the
// browser starts from the `initial` value the component passes in its adopt run (route data), as the server did.
import { signal, untrack } from "@rivetjs/reactivity";

/** `EventSource` state: `connecting` (also while it retries after a drop), `open`, `closed` (closed, or the browser gave up). */
export type LiveStatus = "connecting" | "open" | "closed";

export interface LiveSourceOptions<T> {
  /** Value before the first event (server render, adopt run): usually loader data. */
  initial?: T;
  /** Event data → value (default `JSON.parse`). */
  parse?: (data: string, event: MessageEvent<string>) => T;
  /** Event type(s) that carry the value (default `message`: events sent without `event`). */
  event?: string | readonly string[];
  /** Send cookies on a cross-origin URL (`EventSource` `withCredentials`). Same-origin requests always send them. */
  withCredentials?: boolean;
}

/** The latest value (a signal read); `status()` the connection state; `open()` connects and returns the close function. */
export interface LiveSource<T> {
  (): T;
  status(): LiveStatus;
  /** Connect (browser only): call it from a `clientEffect` — `clientEffect(source.open)` — whose cleanup closes it. */
  open(): () => void;
}

/**
 * A value that follows a Server-Sent Events URL: each event's data (parsed) replaces it. Create it in the component
 * (the server renders `initial`), connect it from a client effect, which closes it on route leave:
 *
 * ```tsx
 * const visitors = liveSource("/events", { initial: data.visitors, parse: (text) => JSON.parse(text).visitors });
 * clientEffect(visitors.open);
 * return <p>{visitors()} ({visitors.status()})</p>;
 * ```
 *
 * `url` may be an accessor: reading it inside `open` (a client effect) reconnects when it changes. `EventSource`
 * reconnects by itself after a network error (status `connecting`), sending the last event `id` as `Last-Event-ID`.
 */
export function liveSource<T>(url: string | URL | (() => string | URL), options: LiveSourceOptions<T> & { initial: T }): LiveSource<T>;
export function liveSource<T>(url: string | URL | (() => string | URL), options?: LiveSourceOptions<T>): LiveSource<T | undefined>;
export function liveSource<T>(url: string | URL | (() => string | URL), options: LiveSourceOptions<T> = {}): LiveSource<T | undefined> {
  const value = signal<T | undefined>(options.initial);
  const status = signal<LiveStatus>("connecting");
  const parse = options.parse ?? ((data: string) => JSON.parse(data) as T);
  const types = typeof options.event === "string" ? [options.event] : (options.event ?? ["message"]);
  const open = (): (() => void) => {
    // Tracked: an accessor URL re-runs the effect (cleanup closes the old connection first).
    const target = typeof url === "function" ? url() : url;
    return untrack(() => {
      if (typeof EventSource === "undefined") return () => {};
      const source = new EventSource(target, options.withCredentials ? { withCredentials: true } : undefined);
      const receive = (event: MessageEvent<string>) => value.set(parse(event.data, event));
      for (const type of types) source.addEventListener(type, receive as EventListener);
      source.onopen = () => status.set("open");
      source.onerror = () => status.set(source.readyState === 2 ? "closed" : "connecting");
      status.set("connecting");
      return () => {
        source.close();
        status.set("closed");
      };
    });
  };
  const read = (() => value()) as LiveSource<T | undefined>;
  read.status = () => status();
  read.open = open;
  return read;
}
