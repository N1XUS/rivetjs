// The router brand `@rivetjs/forms` reaches the router through (`Symbol.for("rivet.router")`, index.ts `_brand`,
// navigate.ts `_go`) and `navigate()`'s event-first wait for a resumed App (`rivet:attach`, one timeout), without a
// browser: document / location stubbed; base path `/app` and `trailingSlash: "always"` mocked in.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";

vi.mock("../shared/base.ts", async (original) => {
  const real = await original<typeof import("../shared/base.ts")>();
  return { ...real, BASE: "/app", underBase: (pathname: string) => real.underBase(pathname, "/app"), withBase: (to: string) => real.withBase(to, "/app") };
});
vi.mock("../shared/slash.ts", async (original) => ({ ...(await original<typeof import("../shared/slash.ts")>()), TRAILING_SLASH: "always" }));

const g = globalThis as Record<string | symbol, unknown>;
const assigned: string[] = [];
let asks = 0;
let marker = true;
const doc = Object.assign(new EventTarget(), {
  querySelector: (selector: string) => (selector === "[data-rivet-go]" && marker ? {} : null),
  $r: undefined as { b?(): void; r?(): unknown } | undefined,
});
doc.addEventListener("rivet:go", () => asks++);
g.document = doc;
g.location = { href: "http://x.test/app/start", origin: "http://x.test", pathname: "/app/start", assign: (href: string) => assigned.push(href) };
const BRAND = Symbol.for("rivet.router");

const { _go, _take, navigate } = await import("../client/navigate.ts");
const { _brand, _clearPrefetch } = await import("../client/index.ts");

beforeEach(() => {
  assigned.length = 0;
  asks = 0;
  marker = true;
  doc.$r = undefined;
  _take();
});
afterEach(() => vi.useRealTimers());

test("_go: in-base navigations queue in canonical form and ask the App; outside the base loads the document", async () => {
  void _go(new URL("http://x.test/app/items/1?q=1"));
  const [request] = _take();
  assert.equal(request!.url.pathname, "/app/items/1/", "trailing slash folded (always)");
  assert.equal(request!.url.search, "?q=1");
  assert.equal(request!.invalidate, undefined);
  assert.equal(asks, 1, "one rivet:go ask");
  void _go(new URL("http://x.test/other/page"));
  assert.deepEqual(assigned, ["http://x.test/other/page"]);
  assert.equal(_take().length, 0);
});

test("_go: invalidations keep the URL as shown and pass fresh data through", async () => {
  const fresh = { data: [{ a: 1 }], deps: [["k"]] } as never;
  void _go(new URL("http://x.test/app/start"), fresh);
  void _go(new URL("http://x.test/app/start"), true);
  const [first, second] = _take();
  assert.equal(first!.url.pathname, "/app/start", "no slash fold for the shown URL");
  assert.equal(first!.invalidate, fresh);
  assert.equal(second!.invalidate, true);
});

test("_brand: installs clear + go, announces the first install once, replaces the entry points on each call", () => {
  delete g[BRAND];
  let announced = 0;
  doc.addEventListener("rivet:router", () => announced++);
  _brand(_go);
  const first = g[BRAND] as { clear(): void; go: unknown };
  assert.equal(first.go, _go);
  assert.equal(first.clear, _clearPrefetch);
  const other = (() => Promise.resolve()) as typeof _go;
  _brand(other);
  assert.equal((g[BRAND] as { go: unknown }).go, other, "a re-instantiated router (dev HMR) replaces go");
  assert.equal(announced, 1);
});

test("navigate() before a resumed App listens: asks again on rivet:attach, served without polling", async () => {
  vi.useFakeTimers();
  let booted = 0;
  doc.$r = { b: () => booted++, r: () => null };
  let served = false;
  const done = navigate("/items/7").then(() => (served = true));
  assert.equal(asks, 1);
  assert.equal(booted, 1, "boots the runtime");
  await vi.advanceTimersByTimeAsync(5_000);
  assert.equal(asks, 1, "no retry timer");
  // The runtime attached the App's listener: one more ask, the App serves the queue.
  doc.dispatchEvent(new Event("rivet:attach"));
  assert.equal(asks, 2);
  const [request] = _take();
  assert.equal(request!.url.pathname, "/app/items/7/");
  request!.done();
  await done;
  assert.ok(served);
  doc.dispatchEvent(new Event("rivet:attach"));
  assert.equal(asks, 2, "listener removed once served");
  assert.deepEqual(assigned, []);
});

test("navigate(): no answer within 10 s loads the document; no App marker loads it at once", async () => {
  vi.useFakeTimers();
  doc.$r = { b() {}, r: () => ({}) };
  void navigate("/items/8");
  await vi.advanceTimersByTimeAsync(9_999);
  assert.deepEqual(assigned, []);
  await vi.advanceTimersByTimeAsync(1);
  assert.deepEqual(assigned, ["http://x.test/app/items/8/"]);
  assert.equal(_take().length, 0, "dropped from the queue");
  marker = false;
  void navigate("/items/9");
  assert.deepEqual(assigned, ["http://x.test/app/items/8/", "http://x.test/app/items/9/"]);
});
