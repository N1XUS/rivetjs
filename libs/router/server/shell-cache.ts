// Shell cache: route rule `shell` (partial prerendering; spec docs/design/specs/2026-10-20-ppr-shell-design.md §3, lane
// PPR-T23 = spec T2 + T3; deferred loaders = T1, `deferred.ts`). A document is cut where its first streamed boundary
// would start (the end of the root state tail: state script, loader, stream add-on). A fill renders the visitor's own
// request with its request reads tracked; a fill that read nothing outside the key stores the prefix (CSP nonce
// attributes cut out = nonce slots), the shell loaders' results and an `h` hash. A hit runs the guards, sends the stored
// prefix with the live nonce at once, then replays the page (H-replay: stored shell data, live deferred loaders), checks
// that the replay's prefix equals the stored one byte for byte and streams the holes from there. Entries live in the
// route rules' page store (bytes, CLOCK, `revalidate`). Loaded by `createApp` only for apps with `shell` rules.
import type { AppHandler, AppRoute, Cookies, RequestEvent, ShellPhase, ShellRequest } from "./handler.ts";
import type { LoaderDeps } from "../shared/data.ts";
import { DIRECT_BODY, type BodySink, type DirectBody } from "./body.ts";
import { noncedSources } from "../shared/csp-hash.ts";
import { DATA_PARAM } from "../shared/data.ts";
import { deferredHandle } from "./deferred.ts";
import type { CachedPage, HeaderOf, Resolved, ShellHost, ShellServe, _Cache as Cache } from "./route-cache.ts";

const SHELL = Symbol.for("rivet.shell");
const RENDER_FAILED = Symbol.for("rivet.renderFailed");
/** Test hook (`globalThis[Symbol.for("rivet.shellTest")] = { holes: n }`): the next `n` hits write a wrong holes `h`. */
const TEST = Symbol.for("rivet.shellTest");
const DOCS = "https://rivetjs.severyn.pro/guides/routing/headers-and-caching#partial-prerendering-shell-cache";
/** The root state script: the start of the shell's tail (`render.ts` `ROOT_STATE`). */
const ROOT_STATE = '<script type="rivet/state" data-region="0"';
const END_SCRIPT = "</script>";
const NONCE_LEAD = ' nonce="';
/** `locals` members a shell loader may read: the key's partition (locale variant, direction). */
const PARTITION = new Set(["locale", "dir"]);
/** Event members a shell loader may read without a note (request-independent for the key). */
const FREE = new Set(["params", "route", "isDataRequest", "dev", "signal", "depends"]);
/** Request headers a re-fill never forwards (`route-cache.ts` `VISITOR`). */
const VISITOR = /^(?:cookie|authorization|forwarded|x-forwarded-.+|x-real-ip|true-client-ip|x-client-ip|cf-.+|fastly-client-ip)$/;
/** Rejected fills per route before it stops attempting (until `revalidate()`). */
const STICKY = 3;
const KIND = "shell";

/** A stored shell (a page-store entry: key `…\0shell`). */
interface ShellEntry extends CachedPage {
  readonly kind: typeof KIND;
  /** The prefix without its nonce attributes; `slots`: offsets in it where ` nonce="…"` goes. */
  readonly bare: Uint8Array;
  readonly slots: readonly number[];
  readonly nonced: boolean;
  readonly h: string;
  readonly route: string;
  readonly data: readonly unknown[];
  readonly byURL: readonly number[];
  readonly deps: LoaderDeps | undefined;
  /** Headers the shell loaders set (`setHeader`), and the render's `Link`. */
  readonly extra: readonly (readonly [string, string])[];
}

const encoder = new TextEncoder();
type NodeBuffer = { from(buffer: ArrayBufferLike, offset: number, length: number): { latin1Slice(): string } };
const NodeBuffer = (globalThis as unknown as { Buffer?: NodeBuffer }).Buffer;
const latin1Decoder = NodeBuffer ? null : new TextDecoder("latin1");
const latin1 = (bytes: Uint8Array): string =>
  NodeBuffer ? NodeBuffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).latin1Slice() : latin1Decoder!.decode(bytes);
const utf8 = new TextDecoder();
const attrOf = (nonce: string | undefined): string => (nonce ? NONCE_LEAD + nonce + '"' : "");
const clean = (nonce: string | undefined): string | undefined => (nonce === undefined ? undefined : nonce.replace(/[^\w+/=-]/g, "") || undefined);

/** FNV-1a (32 bit) over the bare prefix and the fingerprint text, as 8 hex digits. */
function fnv(bytes: Uint8Array, text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i]!, 0x01000193);
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
/** The shell's `h` (after the prefix; part of the stored shell). */
const shellScript = (nonce: string | undefined, h: string): string => `<script${attrOf(nonce)}>self.$rvh="${h}"</script>`;
/** Before the first hole: holes rendered against another shell (another `h`) reload the page once. */
const holesScript = (nonce: string | undefined, h: string): string =>
  `<script${attrOf(nonce)}>(function(h,k){try{if(self.$rvh!==h){if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");stop();location.reload()}}else if(sessionStorage.getItem(k))sessionStorage.removeItem(k)}catch(e){}})("${h}","rivet:shell")</script>`;
/** A replay that did not reproduce the stored shell: no holes; the page reports it and reloads once (a full render). */
const mismatchScript = (nonce: string | undefined): string =>
  `<script${attrOf(nonce)}>document.dispatchEvent(new CustomEvent("rivet:resume-error",{detail:{phase:"render",error:"Shell mismatch"}}));(function(k){try{if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");stop();location.reload()}}catch(e){}})("rivet:shell")</script>`;

// Node / Bun / Deno: native memcmp over the views (`Buffer#compare` takes any Uint8Array); elsewhere a byte loop. Measured
// 2026-10-21 (editorial shell lane): the JS loop over a 12 KB prefix was ~5 % of a hit's CPU.
const nativeCompare = (
  globalThis as { Buffer?: { prototype: { compare(this: Uint8Array, target: Uint8Array, ts: number, te: number, ss: number, se: number): number } } }
).Buffer?.prototype.compare;
/** The first index `i < take` where `view[i] !== prefix[from + i]`, or -1. */
function differs(view: Uint8Array, prefix: Uint8Array, from: number, take: number): number {
  if (nativeCompare && nativeCompare.call(view, prefix, from, from + take, 0, take) === 0) return -1;
  for (let i = 0; i < take; i++) if (view[i] !== prefix[from + i]) return i;
  return -1;
}

/**
 * Where the shell ends in `text` (latin1 view of the document so far): after the root state tail — the state script,
 * the loader script and (with pending boundaries, `data-stream`) the stream add-on. -1: not yet (or never).
 */
export function shellCut(text: string): number {
  const at = text.indexOf(ROOT_STATE);
  if (at < 0) return -1;
  const open = text.indexOf(">", at);
  if (open < 0) return -1;
  let scripts = text.slice(at, open).includes(' data-stream="') ? 3 : 2;
  for (let from = open; ;) {
    const end = text.indexOf(END_SCRIPT, from);
    if (end < 0) return -1;
    from = end + END_SCRIPT.length;
    if (--scripts === 0) return from;
  }
}

/** The outgoing body of a composed / captured document: parks chunks until a consumer (web stream or direct sink). */
class Relay {
  mode: 0 | 1 | 2 = 0;
  parked: [Uint8Array, () => void][] = [];
  sink: BodySink | null = null;
  controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  wanted = false;
  ended = false;
  failure: { error: unknown } | null = null;
  readonly stream: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>(
    {
      start: (controller) => void (this.controller = controller),
      pull: () => this.pull(),
      cancel: () => this.cancel(),
    },
    { highWaterMark: 0 },
  );
  /** A chunk (a view the source may reuse once `done` ran). Returns the sink's wait. */
  write(view: Uint8Array, done: () => void): Promise<void> | undefined {
    if (this.ended) return void done();
    if (this.mode === 2) return this.sink!.write(view, done);
    if (this.mode === 1 && this.wanted && !this.parked.length) {
      this.wanted = false;
      this.controller!.enqueue(view.slice());
      done();
      return undefined;
    }
    this.parked.push([view, done]);
    return undefined;
  }
  text(text: string): Promise<void> | undefined {
    return text ? this.write(encoder.encode(text), noop) : undefined;
  }
  pull(): void {
    if (this.mode === 2) return;
    this.mode = 1;
    if (this.parked.length) {
      for (const [view, done] of this.parked) (this.controller!.enqueue(view.slice()), done());
      this.parked = [];
    } else if (!this.ended && !this.failure) {
      this.wanted = true;
      return;
    }
    if (this.failure) this.controller!.error(this.failure.error);
    else if (this.ended) this.controller!.close();
  }
  attach(sink: BodySink): boolean {
    if (this.mode !== 0) return false;
    this.mode = 2;
    this.sink = sink;
    const parked = this.parked;
    this.parked = [];
    try {
      for (const [view, done] of parked) sink.write(view, done);
    } catch {
      return true;
    }
    if (this.failure) sink.error(this.failure.error);
    else if (this.ended) sink.end();
    return true;
  }
  cancel(): void {
    for (const [, done] of this.parked) done();
    this.parked = [];
    this.ended = true;
    this.mode = 1;
  }
  end(): void {
    if (this.ended) return;
    this.ended = true;
    if (this.mode === 2) this.sink!.end();
    else if (this.mode === 1 && !this.parked.length) this.controller!.close();
  }
  error(error: unknown): void {
    if (this.ended) return;
    this.failure = { error };
    if (this.mode === 2) ((this.ended = true), this.sink!.error(error));
    else if (this.mode === 1) ((this.ended = true), this.controller!.error(error));
  }
  response(headers: Headers): Response {
    const response = new Response(this.stream, { status: 200, headers });
    Object.defineProperty(response, DIRECT_BODY, { value: ((sink) => this.attach(sink)) satisfies DirectBody });
    return response;
  }
}
const noop = (): void => {};

/** Read a page body: `chunk(view, done)` per chunk (its wait applies backpressure), then `end` / `fail`. */
function readBody(
  response: Response,
  chunk: (view: Uint8Array, done: () => void) => Promise<void> | undefined,
  end: () => void,
  fail: (error: unknown) => void,
): void {
  const direct = (response as { [DIRECT_BODY]?: DirectBody })[DIRECT_BODY];
  if (direct && !response.body?.locked)
    try {
      if (direct({ write: chunk, end, error: fail })) return;
    } catch {
      // `chunk` threw on a parked chunk (the consumer stopped): the render ends at its next write.
      return;
    }
  if (!response.body) return end();
  const reader = response.body.getReader();
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return end();
        const wait = chunk(value, noop);
        if (wait) await wait;
      }
    } catch (error) {
      fail(error);
    }
  })();
}

/** Query admission: the URL's query is exactly the key's (unkeyed parameters render without the shell). */
function keyedQuery(cache: Cache, search: string): boolean {
  if (!search || search === "?") return true;
  if (cache.query === true) return true;
  if (cache.query === false) return false;
  const params = new URLSearchParams(search);
  for (const name of params.keys()) if (!cache.query.includes(name)) return false;
  const kept = new URLSearchParams();
  for (const name of cache.query) for (const value of params.getAll(name)) kept.append(name, value);
  return search === "?" + kept;
}

/** `URLSearchParams` that notes named reads of parameters outside the rule's key (`get` / `getAll` / `has`). */
class TrackedParams extends URLSearchParams {
  declare note: (what: string) => void;
  declare keyed: readonly string[] | true;
  override get(name: string): string | null {
    this.check(name);
    return super.get(name);
  }
  override getAll(name: string): string[] {
    this.check(name);
    return super.getAll(name);
  }
  override has(name: string, value?: string): boolean {
    this.check(name);
    return value === undefined ? super.has(name) : super.has(name, value);
  }
  check(name: string): void {
    if (this.keyed !== true && !this.keyed.includes(String(name))) this.note("url.searchParams." + name);
  }
}
/** A copy of `url` whose `searchParams` note named reads outside the key (`query` true: the URL as is). */
function trackedURL(url: URL, cache: Cache, note: (what: string) => void): URL {
  if (cache.query === true) return url;
  const copy = new URL(url.href);
  const params = new TrackedParams(copy.search);
  params.note = note;
  params.keyed = cache.query === false ? [] : cache.query;
  Object.defineProperty(copy, "searchParams", { value: params, enumerable: false });
  return copy;
}

/** One shell rule request: a hit (composed response), a fill (tracked render, stored at the cut) or nothing. */
class Run implements ShellRequest {
  declare host: ShellHost;
  declare shells: Shells;
  declare cache: Cache;
  declare resolved: Resolved;
  declare request: Request;
  declare nonce: string | undefined;
  declare base: string;
  declare path: string;
  declare refill: ShellEntry | null;
  declare resolve: ((response: Response) => void) | null;
  declare mode: "hit" | "fill" | null;
  declare entry: ShellEntry | null;
  declare state: string;
  // Fill.
  declare key: string;
  declare route: AppRoute | null;
  declare reads: Set<string>;
  declare extra: [string, string][];
  declare data: readonly unknown[] | null;
  declare byURL: readonly number[];
  declare deps: LoaderDeps | undefined;
  declare cut: boolean;
  declare gate: Promise<unknown> | null;
  declare open: ((error?: unknown) => void) | null;
  declare filling: { path: string; tags: readonly string[]; void: boolean } | null;
  declare dev: boolean;
  declare link: string | null;
  declare phase: ShellPhase | null;
  declare search: string;
  constructor(
    shells: Shells,
    request: Request,
    cache: Cache,
    resolved: Resolved,
    base: string,
    path: string,
    search: string,
    nonce: string | undefined,
    refill: ShellEntry | null,
  ) {
    this.search = search;
    this.phase = null;
    this.link = null;
    this.composer = undefined;
    this.host = shells.host;
    this.shells = shells;
    this.request = request;
    this.cache = cache;
    this.resolved = resolved;
    this.base = base;
    this.path = path;
    this.nonce = clean(nonce);
    this.refill = refill;
    this.resolve = null;
    this.mode = null;
    this.entry = null;
    this.state = "";
    this.key = "";
    this.route = null;
    this.reads = new Set();
    this.extra = [];
    this.data = null;
    this.byURL = [];
    this.deps = undefined;
    this.cut = false;
    this.gate = null;
    this.open = null;
    this.filling = null;
    this.dev = shells.host.dev;
  }

  /** The handler, after guards + `headers()`. */
  begin(route: AppRoute, event: RequestEvent, headers: Headers): ShellPhase | undefined {
    const locals = event.locals;
    const key = this.base + "\0" + String(locals.locale ?? "") + "\0" + String(locals.dir ?? "") + "\0" + KIND;
    if (this.dev) return this.fill(route, key);
    const store = this.host.store;
    const now = Date.now();
    const entry = this.refill ? undefined : (store.get(key) as ShellEntry | undefined);
    if (entry?.kind === KIND) {
      // Stored with nonce slots (or without): a request with the other kind renders as usual.
      if (entry.nonced !== (this.nonce !== undefined)) return undefined;
      if (now < entry.stale) {
        if (now >= entry.fresh && !this.shells.fills.has(key) && now >= entry.retry) this.shells.refresh(this, entry);
        return this.hit(entry, headers, now < entry.fresh ? "SHELL-HIT" : "SHELL-STALE");
      }
      if (now >= entry.stale) store.delete(key);
    }
    if ((store.sticky.get(route.id) ?? 0) >= STICKY || this.shells.fills.has(key)) return undefined;
    if (!this.refill && this.host.secondMiss(this.cache, this.search, (name) => this.request.headers.get(name)) && !this.host.doorkeeper.has(key)) {
      if (this.host.doorkeeper.size >= 10_000) this.host.doorkeeper.clear();
      this.host.doorkeeper.add(key);
      return undefined;
    }
    return this.fill(route, key);
  }

  hit(entry: ShellEntry, live: Headers, state: string): ShellPhase {
    this.mode = "hit";
    this.entry = entry;
    entry.used = true;
    const headers = new Headers();
    for (const [name, value] of entry.extra) headers.set(name, value);
    live.forEach((value, name) => name !== "set-cookie" && headers.set(name, value));
    for (const cookie of live.getSetCookie()) headers.append("set-cookie", cookie);
    headers.set("content-type", "text/html; charset=utf-8");
    const policy = this.nonce !== undefined ? this.host.csp.policy(this.nonce) : false;
    if (policy && !headers.has("content-security-policy")) headers.set("content-security-policy", policy);
    headers.set("cache-control", this.cache.control);
    if (this.cache.varies.length) headers.set("vary", this.cache.varies.join(", "));
    headers.set("x-rivet-cache", state);
    const composer = new Composer(this, entry);
    this.composer = composer;
    this.resolve!(this.host.withHeaders(composer.relay.response(headers), this.resolved.headers));
    return { data: entry.data, byURL: entry.byURL, ...(entry.deps ? { deps: entry.deps } : {}) };
  }
  declare composer: Composer | undefined;

  fill(route: AppRoute, key: string): ShellPhase {
    this.mode = "fill";
    this.key = key;
    this.route = route;
    if (!this.dev) {
      this.shells.fills.add(key);
      this.filling = { path: this.path, tags: this.cache.tags, void: false };
      this.host.store.filling.add(this.filling);
    }
    // Deferred handles deliver only once the shell is out: a shell that waits for one in order (a component rendering
    // the handle, `Async` without a fallback, `Suspense` + `resource`) would freeze one visitor's data into the shell.
    this.gate = new Promise((done) => (this.open = done));
    const label = (index: number) => (index < route.layouts.length ? `layout "${route.keys?.[index] ?? index}"` : `page "${route.id}"`) + " loader";
    const phase: ShellPhase = (this.phase = {
      event: (view, index) => this.track(view, label(index)),
      loaded: (data, byURL, deps) => ((this.data = data), (this.byURL = byURL), (this.deps = deps)),
      handle: (promise, dev) => this.handle(promise, dev),
      url: trackedURL(new URL(this.request.url), this.cache, (what) => this.note("render reads " + what)),
    });
    return phase;
  }
  note(what: string): void {
    this.reads.add(what);
  }

  /** A shell loader's event view: request input outside the key is noted (allow-list: unknown members count as reads). */
  track(view: RequestEvent, who: string): RequestEvent {
    const note = (what: string) => this.note(who + " reads " + what);
    const varies = this.cache.varies;
    let url: URL | undefined, cookies: Cookies | undefined, locals: Record<string, unknown> | undefined, request: Request | undefined;
    return new Proxy(view, {
      get: (target, key) => {
        if (typeof key === "symbol" || FREE.has(key)) return Reflect.get(target, key, target);
        switch (key) {
          case "url":
            return (url ??= trackedURL(Reflect.get(target, key, target) as URL, this.cache, note));
          case "setHeader":
            return (name: string, value: string) => (this.extra.push([name.toLowerCase(), value]), target.setHeader(name, value));
          case "setHeaders":
            return (values: Readonly<Record<string, string>>) => {
              target.setHeaders(values);
              for (const name in values) this.extra.push([name.toLowerCase(), values[name]!]);
            };
          case "cookies": {
            const jar = target.cookies;
            return (cookies ??= {
              get: (name) => (note("cookies." + name), jar.get(name)),
              getAll: () => (note("cookies"), jar.getAll()),
              set: (name, value, options) => (note("cookies.set"), jar.set(name, value, options)),
              delete: (name, options) => (note("cookies.delete"), jar.delete(name, options)),
            });
          }
          case "locals":
            return (locals ??= new Proxy(target.locals, {
              get: (object, name) => (typeof name === "string" && !PARTITION.has(name) && note("locals." + name), Reflect.get(object, name)),
              has: (object, name) => (typeof name === "string" && !PARTITION.has(name) && note("locals." + name), Reflect.has(object, name)),
              ownKeys: (object) => (note("locals"), Reflect.ownKeys(object)),
            }));
          case "request": {
            const raw = Reflect.get(target, key, target) as Request;
            return (request ??= trackedRequest(raw, varies, note));
          }
          default:
            note(key === "platform" ? "platform (client address)" : "event." + key);
            return Reflect.get(target, key, target);
        }
      },
    });
  }

  /** A deferred slot's handle in a fill: gated until the cut; settling before the shell is out = consumed in order. */
  handle(promise: Promise<unknown>, dev: boolean): object {
    const gated = this.gate!.then((error) => (error ? Promise.reject(error) : promise));
    gated.catch(noop);
    const settled = () =>
      setTimeout(() => {
        if (this.cut || !this.open) return;
        // Dev check mode (`devResume`): nothing streams, deferred data waits in place by design.
        if (this.phase?.plain) return this.release();
        this.note("the shell waits for deferred loader data (rendered outside an `<Async fallback>` boundary)");
        const error = dev
          ? Object.assign(
              new TypeError(
                "Deferred loader data rendered in the shell of a `shell` route: render it through `<Async load={() => data} fallback={…}>` so it streams as a hole (" +
                  DOCS +
                  ")",
              ),
              { name: "DeferredDataError" },
            )
          : undefined;
        this.release(error);
      }, 0);
    promise.then(settled, settled);
    return deferredHandle(gated, dev);
  }
  release(error?: unknown): void {
    const open = this.open;
    this.open = null;
    open?.(error);
  }

  /** The handler's answer: hit → the replay (the composed response is out); fill → captured; else as rendered. */
  answer(handle: () => Promise<Response>): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      this.resolve = resolve;
      handle().then(
        (response) => {
          if (this.composer) this.composer.replay(response);
          else if (this.mode === "fill") this.capture(response).then(resolve, reject);
          else resolve(this.host.withHeaders(response, this.resolved.headers));
        },
        (error) => {
          this.release();
          this.done();
          if (this.composer) this.composer.fail(error);
          else reject(error);
        },
      );
    });
  }
  done(): void {
    if (this.filling) this.host.store.filling.delete(this.filling);
    this.filling = null;
    if (this.mode === "fill" && !this.dev) this.shells.fills.delete(this.key);
  }

  /** Fill: hold the document until the cut, decide, store; answer with the bytes (and the `h` scripts when stored). */
  capture(response: Response): Promise<Response> {
    const type = response.headers.get("content-type") ?? "";
    if (response.status !== 200 || !/^text\/html\b/i.test(type) || !response.body) {
      this.release();
      this.done();
      this.reject([`status ${response.status}`]);
      return Promise.resolve(this.host.withHeaders(response, this.resolved.headers));
    }
    return new Promise<Response>((resolve) => {
      const relay = new Relay();
      const held: Uint8Array[] = [];
      let text = "";
      let answered = false;
      this.link = response.headers.get("link");
      const answer = (state: string | null) => {
        answered = true;
        const headers = new Headers(response.headers);
        headers.set("cache-control", this.cache.control);
        if (state) headers.set("x-rivet-cache", state.replace(/[^\x20-\x7e]/g, "?"));
        resolve(this.host.withHeaders(relay.response(headers), this.resolved.headers));
      };
      const flushHeld = (insert: string, at: number) => {
        let offset = 0;
        for (const chunk of held) {
          const end = offset + chunk.length;
          if (insert && at >= offset && at < end) {
            if (at > offset) relay.write(chunk.subarray(0, at - offset), noop);
            relay.text(insert);
            relay.write(chunk.subarray(at - offset), noop);
            insert = "";
          } else relay.write(chunk, noop);
          offset = end;
        }
        if (insert) relay.text(insert);
        held.length = 0;
      };
      const dev = this.dev;
      const reason = () => (this.reads.size ? "SHELL-BYPASS " + [...this.reads][0] : null);
      readBody(
        response,
        (view, done) => {
          if (this.cut) return relay.write(view, done);
          // Before the cut: held (copied: the source reuses its slabs) until the shell is complete.
          const copy = view.slice();
          done();
          held.push(copy);
          text += latin1(copy);
          const at = shellCut(text);
          if (at < 0) return undefined;
          this.cut = true;
          this.release();
          const prefix = new Uint8Array(at);
          let offset = 0;
          for (const chunk of held) {
            const take = Math.min(chunk.length, at - offset);
            if (take <= 0) break;
            prefix.set(chunk.subarray(0, take), offset);
            offset += take;
          }
          const h = this.decide(prefix, text.slice(0, at));
          this.done();
          flushHeld(h ? shellScript(this.nonce, h) + holesScript(this.nonce, h) : "", at);
          // Dev probe (never stored): the header names the first reason the shell would not be stored.
          answer(dev ? reason() : h ? (this.refill ? "SHELL-REFILL" : "SHELL-MISS") : null);
          return undefined;
        },
        () => {
          if (!this.cut) {
            this.release();
            this.done();
            if (dev) this.decide(new Uint8Array(0), "");
            else this.reject(["no resume state tail (the page has no resumable state, or failed before its shell ended)"]);
            flushHeld("", -1);
            if (!answered) answer(dev ? reason() : null);
          }
          relay.end();
        },
        (error) => {
          this.release();
          this.done();
          if (!answered) {
            flushHeld("", -1);
            answer(null);
          }
          relay.error(error);
        },
      );
    });
  }

  /** At the cut: store the shell (returns its `h`) or say why not. */
  decide(prefix: Uint8Array, text: string): string | null {
    const why = [...this.reads];
    if (this.dev) {
      if (why.length) this.shells.log(this.route!.id, why);
      return null;
    }
    if (text.includes('<script type="rivet/boundaries"')) why.push("the derived resume model is not supported by the shell cache yet");
    if ((this.request as unknown as Record<symbol, unknown>)[RENDER_FAILED] === true) why.push("the shell render reported a failure");
    if (this.filling?.void) why.push("revalidate() ran during the fill");
    if (this.data === null) why.push("no loader phase");
    let bare = prefix;
    const slots: number[] = [];
    const nonce = this.nonce;
    if (nonce) {
      const found = noncedSources(text, nonce, true, (from, to) => utf8.decode(prefix.subarray(from, to)));
      if (!found) why.push("its CSP nonce appears outside the renderer's script / style tags");
      else if (found.attrs.length) {
        const cut = NONCE_LEAD.length + nonce.length + 1;
        bare = new Uint8Array(prefix.length - found.attrs.length * cut);
        let from = 0,
          to = 0;
        for (const at of found.attrs) {
          bare.set(prefix.subarray(from, at), to);
          to += at - from;
          slots.push(to);
          from = at + cut;
        }
        bare.set(prefix.subarray(from), to);
      }
    }
    if (why.length) {
      this.reject(why);
      return null;
    }
    const route = this.route!;
    const h = fnv(bare, this.host.build + "\0" + route.id + "\0" + this.key);
    let estimate = 0;
    try {
      estimate = JSON.stringify(this.data)?.length ?? 0;
    } catch {
      estimate = 1024;
    }
    const now = Date.now();
    const store = this.host.store;
    const entry: ShellEntry = {
      kind: KIND,
      key: this.key,
      path: this.path,
      tags: this.cache.tags,
      body: bare,
      headers: this.extra,
      etag: "",
      modified: "",
      modifiedAt: 0,
      created: now,
      fresh: now + this.cache.maxAge * 1000,
      stale: now + (this.cache.maxAge + this.cache.swr) * 1000,
      used: false,
      size: bare.length + this.key.length * 2 + estimate,
      failures: 0,
      retry: 0,
      charge: (bytes) => store.grow(entry, bytes),
      bare,
      slots,
      nonced: nonce !== undefined,
      h,
      route: route.id,
      data: this.data!,
      byURL: this.byURL,
      deps: this.deps,
      extra: this.link !== null && !this.extra.some(([name]) => name === "link") ? [...this.extra, ["link", this.link]] : this.extra,
    };
    store.set(entry);
    store.sticky.delete(route.id);
    return h;
  }
  reject(why: string[]): void {
    if (this.dev || !this.route) return void (this.route && why.length && this.shells.log(this.route.id, why));
    const store = this.host.store;
    store.sticky.set(this.route.id, (store.sticky.get(this.route.id) ?? 0) + 1);
    if (this.refill) this.refill.retry = Date.now() + Math.min(1000 * 2 ** this.refill.failures++, 300_000);
  }
}

/** A request's headers as a shell loader sees them: named reads outside `varies` and any listing are noted. */
function trackedRequest(request: Request, varies: readonly string[], note: (what: string) => void): Request {
  const headers = request.headers;
  const named = (name: string) => {
    const lower = String(name).toLowerCase();
    if (!varies.includes(lower)) note("request.headers." + lower);
  };
  const trackedHeaders = new Proxy(headers, {
    get: (target, key) => {
      if (key === "get") return (name: string) => (named(name), target.get(name));
      if (key === "has") return (name: string) => (named(name), target.has(name));
      const value = Reflect.get(target, key, target);
      if (typeof value === "function") {
        note("request.headers");
        return value.bind(target);
      }
      return value;
    },
  });
  return new Proxy(request, {
    get: (target, key) => {
      if (key === "headers") return trackedHeaders;
      if (typeof key === "string" && key !== "url" && key !== "method" && key !== "signal") note("request." + key);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** A hit: the stored prefix with the live nonce (out at once), then the replay's holes once its prefix matched. */
class Composer {
  declare run: Run;
  declare entry: ShellEntry;
  declare relay: Relay;
  declare prefix: Uint8Array;
  constructor(run: Run, entry: ShellEntry) {
    this.run = run;
    this.entry = entry;
    this.relay = new Relay();
    const nonce = run.nonce;
    let prefix = entry.bare;
    if (nonce && entry.slots.length) {
      const attr = encoder.encode(attrOf(nonce));
      prefix = new Uint8Array(entry.bare.length + entry.slots.length * attr.length);
      let from = 0,
        to = 0;
      for (const at of entry.slots) {
        prefix.set(entry.bare.subarray(from, at), to);
        to += at - from;
        prefix.set(attr, to);
        to += attr.length;
        from = at;
      }
      prefix.set(entry.bare.subarray(from), to);
    }
    this.prefix = prefix;
    this.relay.write(prefix, noop);
    this.relay.text(shellScript(nonce, entry.h));
  }
  /** The replay's document: compared with the stored prefix (never sent), the rest streams after the holes script. */
  replay(response: Response): void {
    const run = this.run,
      relay = this.relay,
      prefix = this.prefix;
    run.done();
    if (response.status !== 200 || !response.body) {
      void response.body?.cancel().catch(noop);
      return this.mismatch(`status ${response.status}`);
    }
    let matched = 0;
    let broken = false;
    readBody(
      response,
      (view, done) => {
        if (broken) {
          done();
          throw new TypeError("shell mismatch");
        }
        if (matched === prefix.length) return relay.write(view, done);
        const take = Math.min(view.length, prefix.length - matched);
        const at = differs(view, prefix, matched, take);
        if (at >= 0) {
          broken = true;
          done();
          this.mismatch("the replay's shell differs from the stored one (byte " + (matched + at) + ")");
          throw new TypeError("shell mismatch");
        }
        matched += take;
        if (matched < prefix.length) return void done();
        const test = (globalThis as unknown as Record<symbol, { holes?: number } | undefined>)[TEST];
        const h = test?.holes ? (test.holes--, this.entry.h + "-") : this.entry.h;
        relay.text(holesScript(run.nonce, h));
        if (take === view.length) return void done();
        return relay.write(view.subarray(take), done);
      },
      () => {
        if (!broken && matched < prefix.length) return this.mismatch("the replay ended before its shell did");
        relay.end();
      },
      (error) => {
        if (broken) return;
        if (matched < prefix.length) return this.mismatch(error instanceof Error ? error.message : String(error));
        relay.error(error);
      },
    );
  }
  /** Never holes against a mismatched shell: drop the entry, stop filling the route, the page reloads once. */
  mismatch(why: string): void {
    const run = this.run,
      store = run.host.store;
    if (store.get(this.entry.key) === this.entry) store.delete(this.entry.key);
    store.sticky.set(this.entry.route, STICKY);
    run.shells.log(this.entry.route, ["shell mismatch on a hit: " + why], true);
    this.relay.text(mismatchScript(run.nonce));
    this.relay.end();
  }
  fail(error: unknown): void {
    this.mismatch(error instanceof Error ? error.message : String(error));
  }
}

/** The shell cache of one `withRouteRules` store. */
class Shells {
  declare host: ShellHost;
  readonly fills = new Set<string>();
  readonly logged = new Set<string>();
  constructor(host: ShellHost) {
    this.host = host;
  }
  /** Why a route's shell is not stored: dev logs every new reason once per route; a mismatch always warns (bounded). */
  log(route: string, why: readonly string[], always = false): void {
    if (!this.host.dev && !always) return;
    const key = route + "\0" + why.join("\0");
    if (this.logged.has(key) || this.logged.size >= 256) return;
    this.logged.add(key);
    console.warn(`[rivet] routeRules shell: route "${route}" not stored: ${why.join("; ")} (${DOCS})`);
  }
  /** Stale entry: one background re-fill as a detached, anonymous request (no credentials, no visitor headers). */
  refresh(from: Run, entry: ShellEntry): void {
    const sent = new Headers();
    from.request.headers.forEach((value, name) => {
      if (!VISITOR.test(name) || from.cache.varies.includes(name)) sent.set(name, value);
    });
    const detached = new Request(from.request.url, { headers: sent });
    const run = new Run(
      this,
      detached,
      from.cache,
      from.resolved,
      from.base,
      from.path,
      from.search,
      from.nonce !== undefined ? freshNonce() : undefined,
      entry,
    );
    (detached as unknown as Record<symbol, ShellRequest>)[SHELL] = run;
    const context = run.nonce !== undefined ? { nonce: run.nonce } : {};
    run
      .answer(() => this.host.handler(detached, context))
      .then((response) => {
        if (response.headers.get("x-rivet-cache") !== "SHELL-REFILL") entry.retry = Date.now() + Math.min(1000 * 2 ** entry.failures++, 300_000);
        return response.body?.cancel();
      })
      .catch(() => void (entry.retry = Date.now() + Math.min(1000 * 2 ** entry.failures++, 300_000)));
  }
}
const freshNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};

/** The route rules' shell entry point (`withRouteRules`): undefined = render without the shell. */
export function createShells(host: ShellHost): ShellServe {
  const shells = new Shells(host);
  return (request, context, resolved, origin, path, search) => {
    const cache = resolved.shell!;
    if (request.method !== "GET" || search.includes(DATA_PARAM) || (host.fixed !== undefined && origin !== host.fixed)) return undefined;
    // Unkeyed query parameters: the page may depend on them, so it renders as usual (no shell, no fill).
    if (!keyedQuery(cache, search)) return undefined;
    const header: HeaderOf = (name) => request.headers.get(name);
    const run = new Run(shells, request, cache, resolved, host.keyOf(cache, origin, path, search, header), path, search, context?.nonce, null);
    (request as unknown as Record<symbol, ShellRequest>)[SHELL] = run;
    return run.answer(() => (host.handler as AppHandler)(request, context));
  };
}
