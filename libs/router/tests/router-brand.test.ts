// The router brand `@rivetjs/forms` reaches the router through (`Symbol.for("rivet.router")`, index.ts `_brand`,
// navigate.ts `_go`) and `navigate()`'s ask (`rivet:go`: served by a listening App, else a document load), without a
// browser: document / location stubbed; base path `/app` and `trailingSlash: "always"` mocked in.
import { beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";

vi.mock("../shared/base.ts", async (original) => {
  const real = await original<typeof import("../shared/base.ts")>();
  return { ...real, BASE: "/app", underBase: (pathname: string) => real.underBase(pathname, "/app"), withBase: (to: string) => real.withBase(to, "/app") };
});
vi.mock("../shared/slash.ts", async (original) => ({ ...(await original<typeof import("../shared/slash.ts")>()), TRAILING_SLASH: "always" }));

const g = globalThis as Record<string | symbol, unknown>;
const assigned: string[] = [];
let asks = 0;
const doc = new EventTarget();
doc.addEventListener("rivet:go", () => asks++);
g.document = doc;
g.location = { href: "http://x.test/app/start", origin: "http://x.test", pathname: "/app/start", assign: (href: string) => assigned.push(href) };
const BRAND = Symbol.for("rivet.router");

const { _go, _take, navigate } = await import("../client/navigate.ts");
const { _brand, _clearPrefetch } = await import("../client/index.ts");

beforeEach(() => {
  assigned.length = 0;
  asks = 0;
  _take();
});

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

test("navigate(): an App listening serves the request; none listening loads the document at once", async () => {
  let served = false;
  const serve = () => {
    const [request] = _take();
    request!.done();
  };
  doc.addEventListener("rivet:go", serve);
  await navigate("/items/7").then(() => (served = true));
  doc.removeEventListener("rivet:go", serve);
  assert.ok(served);
  assert.deepEqual(assigned, []);
  void navigate("/items/8");
  assert.deepEqual(assigned, ["http://x.test/app/items/8/"], "no App listening: a document load");
  assert.equal(_take().length, 0, "dropped from the queue");
});
