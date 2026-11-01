// `@rivetjs/router/sse`: Server-Sent Events from an endpoint without hand-written streams. `eventStream(event, producer)`
// returns the `text/event-stream` Response; the producer gets `send` / `close` / `ready` and returns its cleanup, which
// runs exactly once (client gone = `event.signal` abort or the body cancelled, the producer's `close()`, or an error).
// Dependency free, web-standard (ReadableStream + TextEncoder): every adapter streams it as is; the node adapter never
// compresses `text/event-stream` (per-connection codec state, events must leave at once).

/** Fields of one event besides its data (SSE `event:` / `id:`). Neither may hold a line break. */
export interface EventFields {
  /** Event type (`event:` line): the browser dispatches it to `addEventListener(type)` instead of `onmessage`. */
  event?: string;
  /** Event id (`id:` line): the browser sends the last one back as `Last-Event-ID` when it reconnects. */
  id?: string | number;
}

/**
 * Send one event. `data`: a string is sent as is (each line its own `data:` line, so multi-line text arrives intact),
 * anything else as JSON. Returns false once the stream is closed, or while the client is behind (the queue holds
 * `highWaterMark` bytes or more): wait for `ready()` before sending more when you produce faster than it reads.
 */
export type SendEvent = (data: unknown, fields?: EventFields) => boolean;

/** What the producer may return: its cleanup (stop timers, unsubscribe), also as a promise (an async producer). */
export type EventCleanup = void | (() => void) | Promise<void | (() => void)>;

export interface EventStreamOptions {
  /**
   * Comment line sent every `heartbeat` ms (default 15 000) so proxies and load balancers keep an idle connection open
   * (many close it after 30–60 s without bytes). `false` / 0: none.
   */
  heartbeat?: number | false;
  /** Reconnection delay the browser waits after the connection drops (`retry:` field, ms), sent first. */
  retry?: number;
  /** Bytes the stream queues before `send` returns false (default 64 KiB). */
  highWaterMark?: number;
  /** Extra response headers (`set-cookie`, `vary`, …); content type and caching headers are set by `eventStream`. */
  headers?: HeadersInit;
}

const encoder = new TextEncoder();
const BREAK = /[\r\n]/;
const LINES = /\r\n|\r|\n/;

/** One event in SSE framing: `event:` / `id:` lines, one `data:` line per data line, a blank line. */
export function formatEvent(data: unknown, fields?: EventFields): string {
  let out = "";
  if (fields?.event != null) {
    const event = String(fields.event);
    if (BREAK.test(event)) throw new TypeError("eventStream: an event type cannot contain a line break");
    out += `event: ${event}\n`;
  }
  if (fields?.id != null) {
    const id = String(fields.id);
    // A NUL makes browsers ignore the id; a line break would end the field.
    if (BREAK.test(id) || id.includes("\0")) throw new TypeError("eventStream: an event id cannot contain a line break or NUL");
    out += `id: ${id}\n`;
  }
  const text = typeof data === "string" ? data : JSON.stringify(data);
  if (text === undefined) throw new TypeError("eventStream: data must be a string or a JSON value");
  for (const line of text.split(LINES)) out += `data: ${line}\n`;
  return out + "\n";
}

/**
 * A Server-Sent Events response. `producer(send, close, ready)` runs at once; `send(data, { event, id })` writes an event,
 * `close()` ends the stream, `ready()` resolves when the client has room again (or the stream closed). The cleanup it
 * returns runs exactly once: when the client goes away (`event.signal` aborts, the body is cancelled), after `close()`,
 * or when an async producer rejects (the stream then errors). A producer that throws synchronously throws out of
 * `eventStream` (the handler's usual error path). `event`: the endpoint's `RequestEvent` (or a `Request`: anything with
 * the request's `signal`).
 *
 * ```ts
 * export const GET = onGet((event) =>
 *   eventStream(event, (send) => {
 *     const timer = setInterval(() => send({ visitors: currentVisitors() }), 2000);
 *     return () => clearInterval(timer);
 *   }),
 * );
 * ```
 */
export function eventStream(
  event: { readonly signal: AbortSignal },
  producer: (send: SendEvent, close: () => void, ready: () => Promise<void>) => EventCleanup,
  options: EventStreamOptions = {},
): Response {
  const { heartbeat = 15_000, retry, highWaterMark = 64 * 1024 } = options;
  if (retry !== undefined && !(Number.isInteger(retry) && retry >= 0)) throw new TypeError("eventStream: `retry` must be a non-negative integer (ms)");
  const signal = event.signal;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let done = false;
  let cleanup: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let waiters: (() => void)[] = [];
  const wake = () => {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };
  /** Ends everything once: timer, abort listener, waiters, the producer's cleanup. */
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    signal.removeEventListener("abort", aborted);
    wake();
    const run = cleanup;
    cleanup = undefined;
    run?.();
  };
  const aborted = () => {
    if (done) return;
    try {
      controller.close();
    } catch {
      /* Already closed or errored. */
    }
    finish();
  };
  const body = new ReadableStream<Uint8Array>(
    {
      start: (c) => void (controller = c),
      pull: wake,
      cancel: finish,
    },
    new ByteLengthQueuingStrategy({ highWaterMark }),
  );
  const write = (text: string): boolean => {
    if (done) return false;
    controller.enqueue(encoder.encode(text));
    return (controller.desiredSize ?? 0) > 0;
  };
  const send: SendEvent = (data, fields) => {
    if (done) return false;
    return write(formatEvent(data, fields));
  };
  const close = () => aborted();
  const ready = () => (done || (controller.desiredSize ?? 0) > 0 ? Promise.resolve() : new Promise<void>((resolve) => waiters.push(resolve)));
  const headers = new Headers(options.headers);
  headers.set("content-type", "text/event-stream; charset=utf-8");
  headers.set("cache-control", "no-cache, no-transform");
  // nginx: do not buffer this response (`proxy_buffering` per response).
  headers.set("x-accel-buffering", "no");
  const response = new Response(body, { status: 200, headers });
  if (signal.aborted) {
    aborted();
    return response;
  }
  signal.addEventListener("abort", aborted, { once: true });
  // First bytes at once: the response head reaches the browser (EventSource `open`) before the first event.
  write(retry !== undefined ? `retry: ${retry}\n\n` : ":\n\n");
  if (heartbeat) {
    timer = setInterval(() => {
      // Behind already: a heartbeat would only queue more.
      if ((controller.desiredSize ?? 0) > 0) write(":\n\n");
    }, heartbeat);
    // A stream alone does not keep the process alive (tests, graceful shutdown).
    (timer as { unref?: () => void }).unref?.();
  }
  let result: EventCleanup;
  try {
    result = producer(send, close, ready);
  } catch (error) {
    finish();
    throw error;
  }
  const adopt = (value: void | (() => void)) => {
    if (typeof value !== "function") return;
    if (done) value();
    else cleanup = value;
  };
  if (result instanceof Promise)
    result.then(adopt, (error: unknown) => {
      if (done) return;
      try {
        controller.error(error);
      } catch {
        /* Already closed. */
      }
      finish();
    });
  else adopt(result);
  return response;
}
