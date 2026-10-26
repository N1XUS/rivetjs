// Stream a page into a web Response: document start, resumable app, document end.
import { renderToWriter, SlabWriter, type ServerValue } from "@rivetjs/runtime/server";
import { escapeText } from "@rivetjs/runtime/escape";
import { renderResumable, type ResumeManifest, type ShellHook } from "@rivetjs/runtime/server-resume";
import { withIdScope } from "@rivetjs/runtime/id";
import type { Head } from "../shared/data.ts";
import type { HeadManaged } from "../shared/head.ts";
import { DIRECT_BODY, type BodySink, type DirectBody } from "./body.ts";
export { headTags, htmlAttributes, bodyAttributes, bodyTags, type HeadTagOptions, type HeadManaged } from "../shared/head.ts";

/** Document around the app. `start` ends inside the app container; `end` closes it. */
export interface DocumentParts {
  start: string;
  end: string;
}
/** What a document shell receives: head, nonce, URL, status and stylesheets. */
export interface DocumentInput {
  readonly head: Head | undefined;
  readonly nonce: string | undefined;
  readonly url: URL;
  readonly status: number;
  /** Stylesheet URLs to link (Vite manifest CSS in production, source paths in dev): global, then the route's. */
  readonly styles: readonly string[];
  /** Stylesheets of `styles` written as `<style>` (URL → CSS; `rivetRouter({ inlineStylesheets })`): `headTags` reads it. */
  readonly inlineStyles?: Readonly<Record<string, string>>;
  /** Request locale (i18n `locals.locale`); shells write `<html lang dir>` from it. */
  readonly locale?: string;
  readonly dir?: "ltr" | "rtl";
  /** Head tags are client-managed (`@rivetjs/kit`): shells pass the input to `headTags(head, input)`. */
  readonly managed?: HeadManaged;
}
/** Renders the HTML document around a page. */
export type DocumentShell = (input: DocumentInput) => DocumentParts;
/** Options of `renderPage()`. */
export interface RenderPageOptions {
  /** Resume manifest (production client build). Without it the page renders without resumability. */
  manifest?: ResumeManifest;
  document: DocumentShell;
  /** Out-of-order streaming for pending `Async` boundaries; `deadline` ms hands the rest to the browser. */
  stream?: { deadline?: number };
  /**
   * Preload planner (`renderResumable` `preload`, `PreloadOptions`): fetch-ahead timing `ahead` (`idle` default / `load` /
   * `intent`); `lean` = `intent`: nothing before an interaction.
   */
  preload?: { ahead?: "idle" | "load" | "intent"; lean?: boolean };
  signal?: AbortSignal;
  nonce?: string;
  /**
   * Failures after the response started (status already sent): this reports; a returned digest goes
   * into the failure marker. The document then ends cleanly: a nonce'd script dispatching
   * `rivet:resume-error` (`detail: { phase: "render", digest, error }`) and the shell's `end`.
   */
  onError?: (error: unknown) => string | void;
  /** Markup written right before and after the app (dev: client mount container, data, scripts). */
  around?: { start: string; end: string };
  /** Locale variant index of translated templates (i18n; default 0). */
  variant?: number;
  /**
   * Head hold (`@rivetjs/kit` components): app output is buffered until the shell has rendered, then
   * the document starts with `head()` (route exports merged with what components pushed).
   */
  hold?: { head(): Head | undefined };
  /**
   * Dev check (`AppConfig.devResume` mode `"check"`): the recorder runs, so its errors surface, but the
   * page's root state and loader are cut (the browser client-renders). Not with `stream`.
   */
  discardState?: boolean;
  /** Markup written after the app's output (and its streamed boundaries), before `around.end` (deferred loaders' client redirect). */
  epilogue?: () => string;
  /** @internal Route rule `shell` (`shell-cache.ts`): the body writer (`enqueued`: as `BodyWriter`'s) and the recorder hook. */
  body?: (enqueued: () => void) => BodyWriter;
  shell?: ShellHook;
  /**
   * @internal Route rule `shell`, H-holes hit (`shell-cache.ts`): the page factory is the stored shell's retained boundaries
   * (`@rivetjs/runtime/server-shell` `shellHoles`); the document start, `around.start` and the head hold are not written
   * (the stored prefix is out).
   */
  holes?: () => ServerValue;
  /** Incremental lists (`createApp({ incr })`, `@rivetjs/runtime/server-incr`): the list cache and the request's partition. */
  incr?: object;
  incrPartition?: string | undefined;
}

/** Coalesced write size (bytes): fewer, larger body chunks. */
const FLUSH_AT = 16 * 1024;
/** Bytes handed off but not consumed yet (no reader / sink, or a reader that has not asked) before the renderer waits. */
const QUEUE = 64 * 1024;
/** Byte slab the writes coalesce in; chunks are views of it (a slab is reused only after a direct sink released every view). */
const SLAB = 64 * 1024;
/** Strings up to this length are copied as ASCII by hand (cheaper than `encodeInto` + a view per write). */
const ASCII_LOOP = 64;
const encoder = new TextEncoder();
/** A slab with the host's in-place UTF-8 writer (Node / Bun `Buffer#utf8Write`: returns the byte count). */
type NativeSlab = Uint8Array & { utf8Write?: (text: string, offset: number, length: number) => number };
// Node / Bun: slabs are Buffers, so the renderer's text paths (`putText`, raw rows) and `write` encode with one
// native `utf8Write` call instead of a per-char loop / `encodeInto` + a subarray view (ssr-bench text grid,
// rivet-router lane: putText 24% of CPU on Uint8Array slabs). Other hosts (Deno, workers): plain Uint8Array.
const NodeBuffer = (globalThis as { Buffer?: { allocUnsafeSlow(size: number): Uint8Array; prototype: object } }).Buffer;
const nativeSlabs = NodeBuffer !== undefined && typeof (NodeBuffer.prototype as NativeSlab).utf8Write === "function";
const allocate = (size: number): Uint8Array => (nativeSlabs ? NodeBuffer!.allocUnsafeSlow(size) : new Uint8Array(size));

/** A slab and its handed-off views not released yet (`pending`); `retired`: the writer moved on. */
interface Slab {
  bytes: Uint8Array;
  pending: number;
  retired: boolean;
}
// Process-wide pool of SLAB-sized slabs, refilled only by direct sinks (a web stream consumer never
// says when a chunk's bytes are free): fresh ArrayBuffers per response add external-memory pressure.
const pool: Slab[] = [];
const POOL_LIMIT = 32;
const recycle = (slab: Slab): void => {
  if (slab.bytes.length !== SLAB || pool.length >= POOL_LIMIT) return;
  slab.retired = false;
  pool.push(slab);
};
const retire = (slab: Slab): void => {
  slab.retired = true;
  if (slab.pending === 0) recycle(slab);
};
/**
 * The body's byte writer (SlabWriter: writeText / writeBytes / writeInteger / raw-slab protocol shared with
 * NodeStreamWriter). Writes coalesce in a slab and are handed off at FLUSH_AT bytes, on every write while
 * the consumer is behind (`threshold` 0), or in a microtask (the renderer paused: a pending boundary, the
 * end), so the shell before an await still leaves at once. The renderer hands over its pre-encoded template
 * fragments and integers instead of strings to concatenate and encode per chunk.
 *
 * Consumer: none yet (chunks park, QUEUE bytes at most before the renderer waits), the web `ReadableStream`
 * (high-water mark 0: `pull` = a read waits; parked chunks go out, later ones straight to a waiting read),
 * or a direct sink (`attach`, node adapter: views of pooled slabs, released by the sink; no stream at all).
 */
export class BodyWriter extends SlabWriter {
  declare bytes: Uint8Array | null;
  declare slab: Slab | null;
  declare controller: ReadableStreamDefaultController<Uint8Array>;
  /** Chunks (and their slabs) handed off before a consumer took them. */
  declare parked: Uint8Array[];
  declare parkedSlabs: Slab[];
  declare parkedBytes: number;
  /** A stream read is waiting for the next chunk. */
  declare wanted: boolean;
  /** 0: no consumer yet, 1: the web stream is read, 2: a direct sink is attached. */
  declare mode: 0 | 1 | 2;
  declare sink: BodySink | null;
  /** The render ended (`close`) / failed (`fail`) before a consumer took the parked chunks. */
  declare ended: boolean;
  declare failure: { error: unknown } | null;
  /** The consumer cancelled: the next hand-off throws and ends the render. */
  declare cancelled: boolean;
  /** The consumer is behind (QUEUE bytes parked): every write flushes and returns the shared wait. */
  declare full: boolean;
  // One shared wait per full queue: a second write before the first wait settled (a renderer path that
  // does not await every write) gets the same promise instead of orphaning the first one's wake.
  declare waiting: Promise<void> | null;
  declare wake: (() => void) | null;
  /** Runs after each hand-off (the Response may open). */
  declare enqueued: () => void;
  declare later: () => void;
  /** A sink wait rejected (the client went away): cancel, so the next hand-off throws and the render ends. */
  declare gone: () => void;
  constructor(enqueued: () => void) {
    super(FLUSH_AT, SLAB, false, undefined);
    this.slab = null;
    this.parked = [];
    this.parkedSlabs = [];
    this.parkedBytes = 0;
    this.wanted = false;
    this.mode = 0;
    this.sink = null;
    this.ended = false;
    this.failure = null;
    this.cancelled = false;
    this.full = false;
    this.waiting = null;
    this.wake = null;
    this.enqueued = enqueued;
    this.later = () => {
      try {
        this.flush();
      } catch {
        /* Cancelled by the consumer: the next write fails and ends the render. */
      }
    };
    this.gone = () => this.cancel();
  }
  /** The consumer caught up (or cancelled): writes coalesce again; a waiting renderer resumes. */
  ready(): void {
    this.full = false;
    this.threshold = FLUSH_AT;
    const resume = this.wake;
    this.wake = this.waiting = null;
    resume?.();
  }
  /** Stream `pull`: a read waits. Parked chunks go out at once; otherwise the next hand-off goes to it. */
  pull(): void {
    if (this.mode === 2) return;
    this.mode = 1;
    if (this.parked.length) {
      for (const chunk of this.parked) this.controller.enqueue(chunk);
      this.unpark();
    } else if (!this.failure && !this.ended) {
      this.wanted = true;
      return;
    }
    if (this.failure) this.controller.error(this.failure.error);
    else if (this.ended) this.controller.close();
    this.ready();
  }
  /** Direct consumer: every parked and later chunk goes to `sink`. False once the stream was read. */
  attach(sink: BodySink): boolean {
    if (this.mode !== 0 || this.cancelled) return false;
    this.mode = 2;
    this.sink = sink;
    const parked = this.parked,
      slabs = this.parkedSlabs;
    this.unpark();
    let wait: Promise<void> | undefined;
    for (let i = 0; i < parked.length; i++) {
      const slab = slabs[i]!;
      wait = sink.write(parked[i]!, () => --slab.pending === 0 && slab.retired && recycle(slab)) ?? wait;
    }
    if (this.failure) sink.error(this.failure.error);
    else if (this.ended) (this.finish(), sink.end());
    else if (wait) {
      this.full = true;
      this.threshold = 0;
      this.waiting = wait.then(() => this.ready(), this.gone);
    } else this.ready();
    return true;
  }
  unpark(): void {
    this.parked = [];
    this.parkedSlabs = [];
    this.parkedBytes = 0;
  }
  /** The stream consumer cancelled. */
  cancel(): void {
    this.cancelled = true;
    this.unpark();
    this.ready();
  }
  /** The body is complete. */
  close(): void {
    this.ended = true;
    if (this.mode === 2) {
      this.finish();
      this.sink!.end();
    } else if (this.mode === 1 && !this.parked.length) this.controller.close();
  }
  /** The render failed: the body errors (a consumer that comes later sees the error). */
  fail(error: unknown): void {
    this.failure = { error };
    this.unpark();
    if (this.mode === 2) {
      this.finish();
      this.sink!.error(error);
    } else if (this.mode === 1) this.controller.error(error);
  }
  /** Direct sink: the current slab goes back to the pool once its views are released. */
  finish(): void {
    if (this.slab) retire(this.slab);
    this.slab = this.bytes = null;
  }
  override schedule(): void {
    this.scheduled = true;
    queueMicrotask(this.later);
  }
  renew(size: number): void {
    if (this.slab) retire(this.slab);
    const slab = size <= SLAB ? (pool.pop() ?? { bytes: allocate(SLAB), pending: 0, retired: false }) : { bytes: allocate(size), pending: 0, retired: false };
    this.slab = slab;
    this.bytes = slab.bytes;
    this.start = this.offset = 0;
  }
  flush(): Promise<void> | undefined {
    this.scheduled = false;
    if (this.offset !== this.start) {
      if (this.cancelled) throw new TypeError("Response body cancelled");
      const slab = this.slab!;
      const chunk = this.bytes!.subarray(this.start, this.offset);
      this.start = this.offset;
      // The handed-off view keeps its bytes: later writes go past it, or into another slab.
      slab.pending++;
      if (this.bytes!.length - this.offset < FLUSH_AT) this.renew(0);
      if (this.mode === 2) {
        const wait = this.sink!.write(chunk, () => --slab.pending === 0 && slab.retired && recycle(slab));
        this.enqueued();
        // Callers that do not await the wait (the scheduled flush `later`, renderer paths that drop it) must not leave
        // its rejection (the client went away mid-backpressure) unhandled: that ends a Node process (LAZY-FLIP).
        if (wait) wait.then(undefined, this.gone);
        return wait;
      }
      if (this.wanted) {
        this.wanted = false;
        this.controller.enqueue(chunk);
      } else {
        this.parked.push(chunk);
        this.parkedSlabs.push(slab);
        this.parkedBytes += chunk.length;
        if (this.parkedBytes >= QUEUE) {
          this.full = true;
          this.threshold = 0;
        }
      }
      this.enqueued();
    }
    return this.full ? (this.waiting ??= new Promise<void>((done) => (this.wake = done))) : undefined;
  }
  write(chunk: string): Promise<void> | undefined {
    const length = chunk.length;
    if (!length) return;
    let waiting;
    if (this.bytes === null) this.renew(0);
    if (this.bytes!.length - this.offset < length * 3) {
      waiting = this.flush();
      this.reserve(length * 3);
    }
    const slab = this.bytes!;
    // Explicit length: workerd's (nodejs_compat) Buffer#utf8Write throws ERR_OUT_OF_RANGE without it.
    if (nativeSlabs) this.offset += (slab as NativeSlab).utf8Write!(chunk, this.offset, slab.length - this.offset);
    else if (length <= ASCII_LOOP) {
      // Short strings (escaped text, attribute values): plain ASCII copy, encoder only past it.
      const offset = this.offset;
      let i = 0;
      for (; i < length; i++) {
        const code = chunk.charCodeAt(i);
        if (code >= 0x80) break;
        slab[offset + i] = code;
      }
      this.offset = offset + i;
      if (i < length) this.offset += encoder.encodeInto(i ? chunk.slice(i) : chunk, slab.subarray(this.offset)).written;
    } else this.offset += encoder.encodeInto(chunk, slab.subarray(this.offset)).written;
    if (this.offset - this.start >= this.threshold) return this.flush() ?? waiting;
    if (!this.scheduled) this.schedule();
    return waiting;
  }
  oversize(bytes: Uint8Array): Promise<void> | undefined {
    this.renew(bytes.length);
    this.bytes!.set(bytes);
    this.offset = bytes.length;
    return this.flush();
  }
}

/** Root boundaries script: the start of the recorder's tail (boundaries, loader), the last thing it writes. */
const ROOT_STATE = '<script type="rivet/boundaries"';
/** A writer that drops everything from the root boundaries script on. */
const stateless = (writer: { write(chunk: string): void | Promise<void> }) => {
  let cut = false;
  return {
    write(chunk: string): void | Promise<void> {
      if (cut) return;
      const at = chunk.indexOf(ROOT_STATE);
      if (at < 0) return writer.write(chunk);
      cut = true;
      return writer.write(chunk.slice(0, at));
    },
  };
};

/** `Promise.race([render, TICK])` yields PENDING when the render promise had not settled yet. */
const PENDING = Symbol("pending");
const TICK = Promise.resolve(PENDING);

/** Mid-stream failure marker: tells the page (and monitoring) the document is incomplete. */
export function failureMarker(nonce: string | undefined, digest: string | undefined): string {
  const attrs = nonce !== undefined ? ` nonce="${nonce.replace(/[^\w+/=-]/g, "")}"` : "";
  const detail = JSON.stringify({
    phase: "render",
    ...(digest ? { digest: digest.replace(/[^\w-]/g, "") } : {}),
    error: "Render failed" + (digest ? ` (digest ${digest.replace(/[^\w-]/g, "")})` : ""),
  });
  return `<script${attrs}>document.dispatchEvent(new CustomEvent("rivet:resume-error",{detail:${detail}}))</script>`;
}

/**
 * Render `factory` between the document parts as a streamed UTF-8 body. Writes respect the
 * consumer's pace: the renderer waits while the stream's queue is full. Always a `Response`: a
 * failure before any byte left errors the body (`renderDocument` rejects instead).
 */
export function renderPage(factory: () => ServerValue, input: DocumentInput, options: RenderPageOptions, init: { status: number; headers: Headers }): Response {
  return stream(factory, input, options, init, false) as Response;
}

/**
 * `renderPage`, but the `Response` is created once the first body bytes are ready (or the render
 * ended): a failure before that throws / rejects, so the caller can answer with an error page and
 * status instead of a 200 with a broken body. A synchronous page answers synchronously.
 */
export function renderDocument(
  factory: () => ServerValue,
  input: DocumentInput,
  options: RenderPageOptions,
  init: { status: number; headers: Headers },
): Response | Promise<Response> {
  return stream(factory, input, options, init, true);
}

// The Response's body stream and direct hook close over the writer only, never over `stream`'s scope (one V8
// context for all its closures: factory, page data, recorder, the rendered graph). Node keeps a Response's web
// stream (and its source) alive through scavenges until the next mark-compact, unread or not, so whatever the
// source reaches outlives the request in the young generation and is promoted: resume /resume 1000 rows promoted
// ~550 KB per request (its whole render) into old space → a mark-compact every ~75 requests under a 512 MiB
// container. Through `out` only, the stream holds the writer (slabs released, sink) and nothing of the render.
const ENDED = (): void => {};
/** High-water mark 0: `pull` runs only while a read waits, so an unread body can still be attached. */
const bodyStream = (out: BodyWriter): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>(
    {
      start(c) {
        out.controller = c;
      },
      pull: () => out.pull(),
      // Cancelled: the next hand-off throws and the render ends.
      cancel: () => out.cancel(),
    },
    { highWaterMark: 0 },
  );
const directBody =
  (out: BodyWriter): DirectBody =>
  (sink) =>
    out.attach(sink);

function stream(
  factory: () => ServerValue,
  input: DocumentInput,
  options: RenderPageOptions,
  init: { status: number; headers: Headers },
  deferred: boolean,
): Response | Promise<Response> {
  const holes = options.holes;
  const hold = holes ? undefined : options.hold;
  let parts: DocumentParts | null = hold ? null : options.document(input);
  // Deferred: no Response until the renderer is really waiting (pending content, not a failure that
  // is already settled) and bytes are queued, or the render ended; a failure before it rejects. Eager
  // (`renderPage`): responded from the start. `queued`: bytes are in the stream, no Response handed out
  // yet (still free to fail); `armed`: the renderer waits, the next queued bytes open the Response.
  let responded = !deferred,
    sent = false,
    queued = false,
    armed = false,
    failure: { error: unknown } | null = null,
    opened = null as ((response: Response) => void) | null,
    failed = null as ((error: unknown) => void) | null;
  const respond = (): Response => {
    responded = true;
    init.headers.set("content-type", "text/html; charset=utf-8");
    const response = new Response(body, init);
    // Host adapters (node) take the bytes straight from the writer (`server/body.ts`).
    Object.defineProperty(response, DIRECT_BODY, { value: direct });
    return response;
  };
  const enqueued = () => {
    sent = true;
    if (!responded) armed ? open() : (queued = true);
  };
  const out = options.body ? options.body(enqueued) : new BodyWriter(enqueued);
  const flush = (): void => void out.flush();
  const arm = (): void => {
    armed = true;
    if (out.offset > out.start) flush();
    else if (queued) open();
  };
  const open = (): void => {
    if (!opened) return void (queued = true);
    const done = opened;
    opened = null;
    done(respond());
  };
  const direct = directBody(out);
  const body = bodyStream(out);
  // Held: chunks queue until the shell is done (the marker after the app), then go out after the start.
  // Still a byte writer while holding (RA5): pre-encoded fragments queue as they are (the renderer's
  // cached, never-mutated bytes) and integers as strings, so a component-head page keeps the byte path.
  let held: (string | Uint8Array)[] | null = hold ? [] : null;
  const writer = hold
    ? {
        write(chunk: string): void | Promise<void> {
          if (held) return void held.push(chunk);
          return out.write(chunk);
        },
        writeBytes(bytes: Uint8Array): void | Promise<void> {
          if (held) return void held.push(bytes);
          return out.writeBytes(bytes);
        },
        writeInteger(value: number): void | Promise<void> {
          if (held) return void held.push(String(value));
          return out.writeInteger(value);
        },
        writeText(text: string): void | Promise<void> {
          if (held) return void held.push(escapeText(text));
          return out.writeText(text);
        },
      }
    : out;
  const release = (): null => {
    if (!held) return null;
    parts = options.document({ ...input, head: hold!.head() });
    const pending = held;
    held = null;
    // Synchronous enqueue: the following writes apply backpressure as usual.
    void out.write(parts.start);
    for (const chunk of pending) void (typeof chunk === "string" ? out.write(chunk) : out.writeBytes(chunk));
    return null;
  };
  const app: () => ServerValue = holes ?? (hold ? () => [factory(), release] : factory);
  let ended = false;
  void (async () => {
    try {
      // Await only real waits (backpressure, pending content): a bare `await` would yield to the
      // coalescing microtask and split a synchronous page into several chunks.
      let wait: void | Promise<void>;
      if (!hold && !holes && (wait = writer.write(parts!.start))) await wait;
      if (options.around && !holes && (wait = writer.write(options.around.start))) await wait;
      const signal = options.signal;
      const variant = options.variant;
      // One id counter per render (`rv0`, `rv1`, …): the same page renders the same ids whatever the
      // process rendered before (reproducible HTML / ETags, incremental prerender canaries). Around the
      // render call, not inside `factory`: the renderer visits what the factory returns (and pending
      // `Async` content later) under this owner, so every component sees the scope.
      wait = withIdScope("rv", () =>
        options.manifest
          ? renderResumable(app, options.discardState ? stateless(writer) : writer, {
              manifest: options.manifest,
              // Same-origin URLs in the state serialize relative (prerendered pages: no build-time origin).
              origin: input.url.origin,
              ...(signal ? { signal } : {}),
              ...(options.nonce !== undefined ? { nonce: options.nonce } : {}),
              ...(options.stream && !options.discardState ? { stream: options.stream } : {}),
              ...(options.preload ? { preload: options.preload } : {}),
              ...(variant ? { variant } : {}),
              ...(options.shell ? { shell: options.shell } : {}),
              ...(options.incr ? { incr: options.incr, ...(options.incrPartition !== undefined ? { incrPartition: options.incrPartition } : {}) } : {}),
            })
          : renderToWriter(app, writer, { ...(signal ? { signal } : {}), ...(variant ? { variant } : {}) }),
      );
      if (wait) {
        // Deferred: a failure the renderer already settled (a component threw before any await; the
        // streamed shell's rejection one tick later) must still reach the caller, so probe twice whether
        // the render promise is really pending before opening the Response.
        if (!responded && (await Promise.race([wait, TICK])) === PENDING && (await Promise.race([wait, TICK])) === PENDING) arm();
        await wait;
      }
      release();
      const epilogue = options.epilogue?.();
      if (epilogue && (wait = writer.write(epilogue))) await wait;
      if (options.around && (wait = writer.write(options.around.end))) await wait;
      if ((wait = writer.write(parts!.end))) await wait;
      flush();
      ended = true;
      out.close();
      if (!responded) open();
    } catch (error) {
      ended = true;
      const abort = () => {
        try {
          out.fail(error);
        } catch {
          /* Already cancelled by the consumer. */
        }
      };
      // No Response handed out yet: the caller answers (error page, status; or drops an aborted request).
      if (!responded) {
        failure = { error };
        abort();
        return failed?.(error);
      }
      if (options.signal?.aborted) return abort();
      const digest = options.onError?.(error) || undefined;
      // Shell already out: end the document cleanly with the marker (no truncated, errored body).
      // Nothing sent yet (`renderPage`) or the shell not rendered (held head): the body errors.
      if (!parts || !sent) return abort();
      try {
        void out.write(failureMarker(options.nonce, digest));
        void out.write(parts.end);
        flush();
        out.close();
      } catch {
        abort();
      }
    } finally {
      // Ended: the hand-off callback is the writer's last tie to this scope (see `bodyStream`).
      out.enqueued = ENDED;
    }
  })();
  if (failure) throw (failure as { error: unknown }).error;
  if (responded || queued || ended) return respond();
  return new Promise<Response>((resolve, reject) => ((opened = resolve), (failed = reject)));
}
