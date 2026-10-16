// How forms reach the app router without importing it (`router.ts`): the router brand under
// `Symbol.for("rivet.router")`, a resumed page's App booted by one `rivet:go` ask (again on `rivet:attach`) and
// awaited through `rivet:router`, the 10 s fallback, other origins and non-HTTP(S) redirects. Document stubbed.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";

const g = globalThis as Record<string | symbol, unknown>;
const BRAND = Symbol.for("rivet.router");
const assigned: string[] = [];
let reloads = 0,
  asks = 0,
  marker = true;
const doc = Object.assign(new EventTarget(), {
  querySelector: (selector: string) => (selector === "[data-rivet-go]" && marker ? {} : null),
  $r: undefined as { b?(): void; r?(): unknown } | undefined,
});
doc.addEventListener("rivet:go", () => asks++);
g.document = doc;
g.location = { href: "http://x.test/form", origin: "http://x.test", assign: (href: string) => assigned.push(href), reload: () => reloads++ };

const { navigate, invalidate, clearPrefetch } = await import("../router.ts");
type Go = (url: URL, invalidate?: unknown) => Promise<void>;
const install = (go: Go, clear = () => {}) => ((g[BRAND] = { go, clear }), doc.dispatchEvent(new Event("rivet:router")));

beforeEach(() => {
  delete g[BRAND];
  assigned.length = 0;
  reloads = asks = 0;
  marker = true;
  doc.$r = undefined;
});
afterEach(() => vi.useRealTimers());

test("a booted router: navigate / invalidate / clearPrefetch go through the brand", async () => {
  const calls: unknown[][] = [];
  let cleared = 0;
  install(
    async (url, fresh) => void calls.push([url.href, fresh]),
    () => cleared++,
  );
  await navigate(new URL("http://x.test/done"));
  await invalidate({ data: [1] } as never);
  await invalidate();
  clearPrefetch();
  assert.deepEqual(calls, [
    ["http://x.test/done", undefined],
    ["http://x.test/form", { data: [1] }],
    ["http://x.test/form", true],
  ]);
  assert.equal(cleared, 1);
  assert.equal(asks, 0);
});

test("before the router: clearPrefetch is a no-op; a client-rendered App answers the first ask at once", async () => {
  clearPrefetch();
  const calls: string[] = [];
  doc.addEventListener("rivet:go", () => g[BRAND] || install(async (url) => void calls.push(url.href)), { once: true });
  await navigate(new URL("http://x.test/next"));
  assert.deepEqual(calls, ["http://x.test/next"]);
  assert.equal(asks, 1);
});

test("resumed page before the App listens: boots, asks again on rivet:attach, waits for rivet:router (no polling)", async () => {
  vi.useFakeTimers();
  let booted = 0;
  doc.$r = { b: () => booted++, r: () => null };
  const calls: string[] = [];
  const done = navigate(new URL("http://x.test/next"));
  assert.equal(asks, 1);
  await vi.advanceTimersByTimeAsync(5_000);
  assert.equal(booted, 1);
  assert.equal(asks, 1, "no retry timer");
  doc.dispatchEvent(new Event("rivet:attach"));
  assert.equal(asks, 2);
  // The App chunk loaded and its rivet:go handler installed the brand.
  install(async (url) => void calls.push(url.href));
  await done;
  assert.deepEqual(calls, ["http://x.test/next"]);
  assert.deepEqual(assigned, []);
});

test("no answer within 10 s: a document load (navigate) / reload (invalidate)", async () => {
  vi.useFakeTimers();
  doc.$r = { b() {}, r: () => ({}) };
  void navigate(new URL("http://x.test/next"));
  void invalidate();
  await vi.advanceTimersByTimeAsync(9_999);
  assert.deepEqual(assigned, []);
  await vi.advanceTimersByTimeAsync(1);
  assert.deepEqual(assigned, ["http://x.test/next"]);
  assert.equal(reloads, 1);
});

test("no router on the page, another origin: the document at once; non-HTTP(S) rejects", async () => {
  marker = false;
  void navigate(new URL("http://x.test/a"));
  marker = true;
  install(async () => assert.fail("another origin never goes through the router"));
  void navigate(new URL("https://elsewhere.test/b"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(assigned.toSorted(), ["http://x.test/a", "https://elsewhere.test/b"]);
  await assert.rejects(navigate(new URL("javascript:alert(1)")), TypeError);
  assert.equal(assigned.length, 2);
});
