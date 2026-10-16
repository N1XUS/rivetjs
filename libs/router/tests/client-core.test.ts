// Client router internals without a browser (globals stubbed): intent prefetch (keep list, eviction,
// abort on navigation), data responses that are not JSON, the settle wait for a page heading, and
// `<Link active>` matching.
import { test } from "vitest";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { encodeData } from "../server/handler.ts";

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
const assigned: string[] = [];
let reply: () => Response = () => new Response(encodeData({ data: [] }), { headers: { "content-type": "application/json" } });
const frames: (() => void)[] = [];
const observers: { notify: () => void; live: boolean }[] = [];
let heading: { focused: boolean } | null = null;
const main = {
  focused: false,
  hasAttribute: () => true,
  setAttribute() {},
  focus() {
    this.focused = true;
  },
};

const g = globalThis as Record<string, unknown>;
const loc = { href: "http://x.test/start", origin: "http://x.test", pathname: "/start", search: "", hash: "", assign: (href: string) => assigned.push(href) };
g.location = loc;
g.history = {
  state: null,
  replaceState(state: unknown) {
    (this as { state: unknown }).state = state;
  },
  scrollRestoration: "auto",
};
g.addEventListener = () => {};
g.scrollTo = () => {};
g.scrollX = 0;
g.scrollY = 0;
g.sessionStorage = { getItem: () => null, setItem() {} };
g.requestAnimationFrame = (fn: () => void) => frames.push(fn);
g.MutationObserver = class {
  entry: { notify: () => void; live: boolean };
  constructor(fn: () => void) {
    observers.push((this.entry = { notify: () => this.entry.live && fn(), live: false }));
  }
  observe() {
    this.entry.live = true;
  }
  disconnect() {
    this.entry.live = false;
  }
};
g.document = {
  title: "Page",
  body: { append() {} },
  querySelector: (selector: string) =>
    selector.includes("h1") ? heading && { ...heading, hasAttribute: () => true, focus: () => (heading!.focused = true) } : selector === "main" ? main : null,
  getElementById: () => null,
  createElement: () => ({ setAttribute() {}, style: {}, isConnected: true, textContent: "" }),
  dispatchEvent: () => true,
};
g.fetch = async (url: string, init: RequestInit = {}) => (calls.push({ url, init }), reply());
// `<Link>` is JSX (compiled by the build); these internals do not need it.
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === "./link.tsx" && context.parentURL?.endsWith("/client/index.ts")
      ? { url: "data:text/javascript,export const Link = () => null;", shortCircuit: true }
      : next(specifier, context),
});
const client = await import("../client/index.ts");

const work = { signal: new AbortController().signal, get: () => undefined } as never;
const router = { navigate: () => {} };
const at = (path: string) => new URL(path, "http://x.test");
const settled = (promise: Promise<unknown>) =>
  Promise.race([
    promise.then(
      () => "settled",
      () => "rejected",
    ),
    new Promise((done) => setTimeout(() => done("pending"), 20)),
  ]);
const signalOf = (path: string) => calls.find((call) => call.url.startsWith(path + "?"))?.init.signal;
const go = (path: string) => {
  loc.href = "http://x.test" + path;
  loc.pathname = path;
};

test("data requests send no dead x-rivet-data header", async () => {
  calls.length = 0;
  client.prefetchData(at("/h1"));
  await client.routeData(work, { url: at("/h2") }, router);
  assert.equal(calls.length, 2);
  for (const { init } of calls) assert.equal(new Headers(init.headers).has("x-rivet-data"), false);
  client._clearPrefetch();
});

test("warmed data fetched for another keep list is not reused (stale layout data)", async () => {
  calls.length = 0;
  client.prefetchData(at("/shop/1"), "server", "/,/shop");
  // At navigation the client no longer keeps /shop's data: the warmed answer would leave it out.
  await client.routeData(work, { url: at("/shop/1") }, router, "server", "/");
  assert.equal(calls.length, 2);
  assert.match(calls[1]!.url, /_rivet_keep=%2F(&|$)/);
  // The same keep list reuses it.
  calls.length = 0;
  client.prefetchData(at("/shop/2"), "server", "/");
  await client.routeData(work, { url: at("/shop/2") }, router, "server", "/");
  assert.equal(calls.length, 1);
});

test("warmed data is capped: the oldest entries are aborted and dropped", () => {
  calls.length = 0;
  for (let i = 0; i < 100; i++) client.prefetchData(at("/many/" + i));
  assert.equal(calls.length, 100);
  assert.equal(signalOf("/many/0")?.aborted, true);
  assert.equal(signalOf("/many/99")?.aborted, false);
  const live = calls.filter((call) => !call.init.signal?.aborted).length;
  assert.ok(live > 0 && live <= 32, `${live} live prefetches`);
  client._clearPrefetch();
  assert.equal(signalOf("/many/99")?.aborted, true);
});

test("a navigation aborts warmed requests for other URLs and keeps its own", () => {
  calls.length = 0;
  client.prefetchData(at("/a"));
  client.prefetchData(at("/b"));
  go("/b");
  client.notePopstate();
  assert.equal(signalOf("/a")?.aborted, true);
  assert.equal(signalOf("/b")?.aborted, false);
  client._clearPrefetch();
  // Settle that traversal (restores scroll, leaves focus) so later tests start from a link navigation.
  heading = { focused: false };
  client.settle(at("/b"));
  heading = null;
  frames.length = 0;
});

test("a data response that is not JSON (content type) loads the document instead", async () => {
  assigned.length = 0;
  reply = () => new Response("<!doctype html><title>Proxy error</title>", { status: 502, headers: { "content-type": "text/html" } });
  assert.equal(await settled(client.routeData(work, { url: at("/report?id=1") }, router)), "pending");
  assert.deepEqual(assigned, ["http://x.test/report?id=1"]);
  // Malformed JSON from the endpoint is a failure (error view, dev overlay), not a reload.
  assigned.length = 0;
  reply = () => new Response("{not json", { headers: { "content-type": "application/json" } });
  assert.equal(await settled(client.routeData(work, { url: at("/broken") }, router)), "rejected");
  assert.deepEqual(assigned, []);
  reply = () => new Response(encodeData({ data: [] }), { headers: { "content-type": "application/json" } });
});

test("settle without a heading waits while the DOM changes, not ~30 frames", () => {
  heading = null;
  main.focused = false;
  frames.length = 0;
  client.settle(at("/no-heading"));
  // One frame for late content; a quiet frame then settles (focus falls back to <main>).
  assert.equal(main.focused, false);
  frames.shift()!();
  assert.equal(main.focused, true);
  frames.length = 0;
  assert.equal(
    observers.every((observer) => !observer.live),
    true,
  );
});

test("settle keeps waiting while content streams in and focuses the heading that arrives", () => {
  heading = null;
  main.focused = false;
  frames.length = 0;
  client.settle(at("/late-heading"));
  observers.at(-1)!.notify();
  frames.shift()!();
  // Content changed during that frame: wait another one, by then the heading is in.
  assert.equal(main.focused, false);
  heading = { focused: false };
  while (frames.length) frames.shift()!();
  assert.equal(heading.focused, true);
  assert.equal(main.focused, false);
  heading = null;
});

test("currentOf: exact page, prefix sections on segment boundaries, one trailing slash", () => {
  assert.equal(client.currentOf("/app/about", "/app/about/", "exact"), "page");
  assert.equal(client.currentOf("/app/shop", "/app/shop/1", "exact"), undefined);
  assert.equal(client.currentOf("/app/shop", "/app/shop/1", "prefix"), "true");
  assert.equal(client.currentOf("/app/shop", "/app/shopping", "prefix"), undefined);
  assert.equal(client.currentOf("/", "/anything", "prefix"), "true");
  assert.equal(client.currentOf("/", "/", "exact"), "page");
});

const json = (body: unknown) => () => new Response(encodeData(body), { headers: { "content-type": "application/json" } });
const flushed = () => new Promise((done) => setTimeout(done, 5));

test("a load superseded while its warmed data is in flight has no side effects (title, redirect)", async () => {
  const doc = g.document as { title: string };
  for (const body of [
    { data: [], head: { title: "Stale" } },
    { redirect: "https://elsewhere.test/x", status: 302 },
  ]) {
    let release!: () => void;
    const gate = new Promise<void>((done) => (release = done));
    const bytes = new TextEncoder().encode(encodeData(body));
    reply = () =>
      new Response(
        new ReadableStream({
          async start(controller) {
            await gate;
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    assigned.length = 0;
    doc.title = "Page";
    client.prefetchData(at("/stale"));
    const controller = new AbortController();
    const load = client.routeData({ signal: controller.signal, get: () => undefined } as never, { url: at("/stale") }, router);
    controller.abort();
    release();
    assert.equal(await settled(load), "rejected");
    await flushed();
    assert.equal(doc.title, "Page");
    assert.deepEqual(assigned, []);
  }
  reply = json({ data: [] });
});

test("{ redirect } to a non-HTTP(S) URL loads the page's document, never the target", async () => {
  for (const redirect of ["javascript:alert(1)", "data:text/html,x"]) {
    assigned.length = 0;
    reply = json({ redirect, status: 302 });
    assert.equal(await settled(client.routeData(work, { url: at("/guarded") }, router)), "pending");
    assert.deepEqual(assigned, ["http://x.test/guarded"]);
  }
  reply = json({ redirect: "https://sso.test/login", status: 302 });
  assigned.length = 0;
  await settled(client.routeData(work, { url: at("/guarded") }, router));
  assert.deepEqual(assigned, ["https://sso.test/login"]);
  reply = json({ data: [] });
});

test("dataURL keeps the page query as written and replaces the page URL's own router params", () => {
  assert.equal(client.dataURL(at("/s?flag&q=a%20b")), "/s?flag&q=a%20b&_rivet=data");
  assert.equal(client.dataURL(at("/s?flag&_rivet_keep=evil&q=+"), "server", "/,."), "/s?flag&q=+&_rivet=data&_rivet_keep=%2F%2C.");
  assert.equal(client.dataURL(at("/s#h")), "/s?_rivet=data");
});

test("page table: links (and data redirects) to paths no page route matches are left to the browser", async () => {
  // Minimal DOM: the event target is the anchor itself.
  class Anchor {
    attrs: Record<string, string>;
    constructor(attrs: Record<string, string>) {
      this.attrs = attrs;
    }
    closest() {
      return this;
    }
    hasAttribute(name: string) {
      return name in this.attrs;
    }
    getAttribute(name: string) {
      return this.attrs[name] ?? null;
    }
    get href() {
      return new URL(this.attrs.href!, loc.href).href;
    }
    get target() {
      return this.attrs.target ?? "";
    }
    get rel() {
      return this.attrs.rel ?? "";
    }
  }
  g.Element = Anchor;
  const event = (href: string, attrs: Record<string, string> = {}) => ({ target: new Anchor({ href, ...attrs }) }) as unknown as Event;
  const modules = [
    ["/", () => "home"],
    ["/items/export", client._endpoint],
    ["/items/:id", () => "item"],
    ["/docs/*rest", () => "docs"],
  ] as const;
  for (const path of ["/", "/items/1", "/items/1/", "/docs", "/docs/a/b", "/items/1?q#h"])
    assert.ok(client.routableAnchor(event(path), modules), path + " is routable");
  for (const path of ["/items/export", "/items", "/items/1/2", "/legacy.html", "/nope"]) assert.equal(client.routableAnchor(event(path), modules), null, path);
  // Without the table (older generated apps): every same-origin link, as before.
  assert.ok(client.routableAnchor(event("/legacy.html")));
  // `data-rivet-reload` still forces a document for a page route.
  assert.equal(client.routableAnchor(event("/items/1", { "data-rivet-reload": "" }), modules), null);
  // A catch-all app: every in-base path is a page.
  const all = [["/*rest", () => "all"]] as const;
  for (const path of ["/", "/x/y", "/legacy.html"]) assert.ok(client.routableAnchor(event(path), all), path);
  // The click handler leaves unmatched links alone (no preventDefault, no navigation).
  const navigated: string[] = [];
  const nav = { navigate: (to: string | URL) => void navigated.push(String(to)) };
  const click = (href: string) => {
    let prevented = false;
    const e = { ...event(href), button: 0, defaultPrevented: false, preventDefault: () => (prevented = true) } as unknown as MouseEvent;
    client.interceptClick(e, nav, modules);
    return prevented;
  };
  assert.equal(click("/legacy.html"), false);
  assert.equal(click("/items/export"), false);
  assert.deepEqual(navigated, []);
  // A data redirect to such a path loads its document; to a page route it stays a client navigation.
  assert.equal(client.loadModule(at("/items/7"), modules) instanceof Promise, true);
  for (const [redirect, assigns] of [
    ["/items/export", ["http://x.test/items/export"]],
    ["/legacy.html", ["http://x.test/legacy.html"]],
    ["/items/9", []],
  ] as const) {
    assigned.length = 0;
    navigated.length = 0;
    reply = json({ redirect, status: 302 });
    assert.equal(await settled(client.routeData(work, { url: at("/guarded") }, nav)), "pending");
    assert.deepEqual(assigned, assigns, redirect);
    assert.deepEqual(navigated, assigns.length ? [] : ["http://x.test" + redirect], redirect);
  }
  reply = json({ data: [] });
  delete g.Element;
});
