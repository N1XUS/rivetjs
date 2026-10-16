// Route rules (`server/route-cache.ts`, spec docs/design/specs/2026-10-12-route-cache.md): patterns, headers, the
// in-process page cache (fresh / stale-while-revalidate / ISR, single flight, admission, bounds), validators + 304,
// hash CSP for stored pages (nonce'd elements only), `revalidate` (+ in-flight race), keys (origin, decoded paths,
// response Vary, i18n), anonymous fills, error fallbacks, refresh failures, createApp / codegen / Vite option wiring
// and the node adapter fast path.
// Run: `npx vitest run --project router libs/router/tests/route-cache.test.ts`.
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { brotliDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  compileRules,
  normalPath,
  revalidate,
  withRouteRules,
  ROUTE_CACHE,
  type CacheLookup,
  type CachePolicy,
  type RouteCacheOptions,
  type RouteRules,
} from "../server/route-cache.ts";
import { createApp } from "../server/app.ts";
import type { AppHandler } from "../server/handler.ts";
import { serve } from "../adapters/node.ts";

afterEach(() => void vi.useRealTimers());

const NONE: CachePolicy = { policy: () => false, hash: null };
const HTML = { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" };
/** A handler counting its renders; `answer` shapes a response. */
function counting(
  answer: (request: Request, n: number) => Response = (request, n) =>
    new Response(`<html><head></head><body>${n} ${request.url}</body></html>`, { headers: HTML }),
) {
  const seen: Request[] = [];
  const handler: AppHandler = async (request) => (seen.push(request), answer(request, seen.length));
  return { handler, seen };
}
/** `withRouteRules` with the fixed origin `http://x` (first misses store; an unfixed origin admits on the second). */
const rules = (handler: AppHandler, routeRules: RouteRules, csp: CachePolicy, base = "", options: RouteCacheOptions = {}) =>
  withRouteRules(handler, routeRules, csp, base, { origin: "http://x", ...options });
const get = (handler: AppHandler, path: string, headers: Record<string, string> = {}, method = "GET") =>
  handler(new Request("http://x" + path, { method, headers }), { nonce: "n0nce" });

test("compileRules: exact, one-segment and trailing /** patterns; specific rules win; malformed rules throw", () => {
  const resolve = compileRules(
    {
      "/**": { headers: { "x-all": "1", "x-who": "all" } },
      "/blog/**": { swr: 60, headers: { "x-who": "blog" } },
      "/blog/*/edit": { cache: false },
      "/about": { isr: true },
    },
    true,
  );
  assert.deepEqual(resolve("/")?.headers, [
    ["x-all", "1"],
    ["x-who", "all"],
  ]);
  assert.equal(resolve("/")?.cache, undefined);
  assert.equal(resolve("/blog")?.cache?.maxAge, 60);
  assert.equal(resolve("/blog/a/b")?.cache?.swr, Infinity);
  assert.equal(new Map(resolve("/blog/a")!.headers).get("x-who"), "blog");
  assert.equal(resolve("/blog/a/edit")?.cache, undefined);
  assert.equal(resolve("/about")?.cache?.maxAge, Infinity);
  assert.equal(resolve("/about/")?.cache?.maxAge, Infinity);
  assert.equal(resolve("/about/x")?.cache, undefined);
  assert.equal(resolve("/blog")?.cache?.control, "public, max-age=0, s-maxage=60, stale-while-revalidate=31536000");
  assert.equal(compileRules({ "/a": { cache: { maxAge: 5 } } })("/a")?.cache?.control, "public, max-age=0, s-maxage=5");
  // ISR: CDNs revalidate every time (revalidate() cannot purge them) unless `cdn` opts in.
  assert.equal(resolve("/about")?.cache?.control, "public, max-age=0, s-maxage=0, must-revalidate");
  assert.equal(compileRules({ "/a": { isr: 60 } }, true)("/a")?.cache?.control, "public, max-age=0, s-maxage=0, must-revalidate");
  assert.equal(
    compileRules({ "/a": { isr: true, cdn: { maxAge: 600, swr: true } } }, true)("/a")?.cache?.control,
    "public, max-age=0, s-maxage=600, stale-while-revalidate=31536000",
  );
  assert.equal(compileRules({ "/a": {} })("/b"), undefined);
  for (const [rules, message] of [
    [{ "a/b": {} }, /must start with/],
    [{ "/a**": {} }, /whole segment/],
    [{ "/**/a": {} }, /only at the end/],
    [{ "/a": { swr: 1, isr: 1 } }, /one of cache, swr, isr/],
    [{ "/a": { cache: { maxAge: -1 } } }, /seconds ≥ 0/],
    [{ "/a": { cache: { maxAge: 1, ttl: 1 } } }, /unknown cache option "ttl"/],
    [{ "/a": { revalidate: 1 } }, /unknown option "revalidate"/],
    [{ "/a": { headers: { "bad name": "x" } } }, /invalid header/],
    [{ "/a": { headers: { "x-a": "a\r\nb" } } }, /invalid header/],
    [{ "/a": { isr: true } }, /isr needs a fixed origin/],
    [{ "/a": { cache: { maxAge: Infinity } } }, /isr needs a fixed origin/],
    [{ "/a": { cdn: { maxAge: 1 } } }, /cdn needs a cache/],
    [{ "/a": { swr: 1, cdn: { maxAge: 1, ttl: 1 } } }, /unknown cdn option "ttl"/],
    [{ "/a": { cache: { maxAge: 1, varies: ["Cookie"] } } }, /cannot name cookie/],
  ] as const)
    assert.throws(() => compileRules(rules as unknown as RouteRules), message);
});

test("cache: a miss renders once, later requests are hits with validators and CDN cache headers", async () => {
  const { handler, seen } = counting();
  const app = rules(handler, { "/blog/**": { cache: { maxAge: 60 } } }, NONE);
  const first = await get(app, "/blog/a");
  assert.equal(first.headers.get("x-rivet-cache"), "MISS");
  assert.equal(first.headers.get("cache-control"), "public, max-age=0, s-maxage=60");
  const etag = first.headers.get("etag")!;
  assert.match(etag, /^W\/"[\w-]+"$/);
  assert.ok(first.headers.get("last-modified"));
  const body = await first.text();
  const second = await get(app, "/blog/a");
  assert.equal(second.headers.get("x-rivet-cache"), "HIT");
  assert.equal(second.headers.get("etag"), etag);
  assert.equal(second.headers.get("age"), "0");
  assert.equal(await second.text(), body);
  assert.equal(seen.length, 1);
  // HEAD is served from the stored page, without a body.
  const head = await get(app, "/blog/a", {}, "HEAD");
  assert.equal(head.headers.get("x-rivet-cache"), "HIT");
  assert.equal(await head.text(), "");
  // Paths without a cache rule pass through untouched.
  assert.equal((await get(app, "/other")).headers.get("x-rivet-cache"), null);
  assert.equal(seen.length, 2);
});

test("validators: If-None-Match (weak, lists, *) and If-Modified-Since answer 304 without a body", async () => {
  const { handler } = counting();
  const app = rules(handler, { "/a": { cache: { maxAge: 60 } } }, NONE);
  const etag = (await get(app, "/a")).headers.get("etag")!;
  for (const match of [etag, etag.slice(2), `"other", ${etag}`, "*"]) {
    const response = await get(app, "/a", { "if-none-match": match });
    assert.equal(response.status, 304, match);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("etag"), etag);
    assert.equal(response.headers.get("content-type"), null);
  }
  assert.equal((await get(app, "/a", { "if-none-match": '"other"' })).status, 200);
  assert.equal((await get(app, "/a", { "if-modified-since": new Date(Date.now() + 5000).toUTCString() })).status, 304);
  assert.equal((await get(app, "/a", { "if-modified-since": new Date(Date.now() - 60_000).toUTCString() })).status, 200);
  // If-None-Match wins over If-Modified-Since.
  assert.equal((await get(app, "/a", { "if-none-match": '"other"', "if-modified-since": new Date(Date.now() + 5000).toUTCString() })).status, 200);
});

test("bypass: data requests, credentials, other methods, uncacheable responses", async () => {
  const { handler, seen } = counting((request, n) => {
    const path = new URL(request.url).pathname;
    if (path === "/cookie") return new Response("<p>c</p>", { headers: { ...HTML, "set-cookie": "a=1" } });
    if (path === "/private") return new Response("<p>p</p>", { headers: { ...HTML, "cache-control": "private, no-store" } });
    if (path === "/json") return new Response("{}", { headers: { "content-type": "application/json" } });
    if (path === "/missing") return new Response("<p>404</p>", { status: 404, headers: HTML });
    return new Response(`<p>${n}</p>`, { headers: HTML });
  });
  const app = rules(handler, { "/**": { cache: { maxAge: 60 } } }, NONE);
  const twice = async (path: string, headers: Record<string, string> = {}, method = "GET") => {
    await get(app, path, headers, method);
    return (await get(app, path, headers, method)).headers.get("x-rivet-cache");
  };
  assert.equal(await twice("/a?_rivet=data"), null);
  assert.equal(await twice("/a", { cookie: "s=1" }), null);
  assert.equal(await twice("/a", { authorization: "Bearer x" }), null);
  assert.equal(await twice("/a", {}, "POST"), null);
  for (const path of ["/cookie", "/private", "/json", "/missing"]) assert.equal(await twice(path), null, path);
  assert.equal(seen.length, 16);
  // `cookies: true`: requests with cookies share the stored page.
  const shared = rules(counting().handler, { "/**": { cache: { maxAge: 60, cookies: true } } }, NONE);
  await get(shared, "/a", { cookie: "s=1" });
  assert.equal((await get(shared, "/a", { cookie: "s=2" })).headers.get("x-rivet-cache"), "HIT");
});

test("stale-while-revalidate: an expired page is served stale while one background render refreshes it; past swr it renders", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const { handler, seen } = counting();
  const app = rules(handler, { "/a": { cache: { maxAge: 10, swr: 20 } } }, NONE);
  const first = await (await get(app, "/a")).text();
  vi.advanceTimersByTime(11_000);
  const stale = await get(app, "/a");
  assert.equal(stale.headers.get("x-rivet-cache"), "STALE");
  assert.equal(stale.headers.get("age"), "11");
  assert.equal(await stale.text(), first);
  await get(app, "/a"); // concurrent with the refresh: still stale, no second render
  let fresh!: Response;
  await vi.waitFor(async () => assert.equal((fresh = await get(app, "/a")).headers.get("x-rivet-cache"), "HIT"));
  assert.equal(seen.length, 2);
  assert.match(await fresh.text(), /^<html><head><\/head><body>2 /);
  vi.advanceTimersByTime(31_000);
  assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "MISS");
  assert.equal(seen.length, 3);
  // `isr: true`: stored until revalidate().
  const isr = rules(counting().handler, { "/i": { isr: true } }, NONE, "", { origin: "http://x" });
  await get(isr, "/i");
  vi.advanceTimersByTime(1e12);
  assert.equal((await get(isr, "/i")).headers.get("x-rivet-cache"), "HIT");
});

test("single flight: concurrent misses share one render", async () => {
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  let renders = 0;
  const handler: AppHandler = async () => {
    renders++;
    await gate;
    return new Response("<p>x</p>", { headers: HTML });
  };
  const app = rules(handler, { "/a": { swr: 60 } }, NONE);
  const answers = [get(app, "/a"), get(app, "/a"), get(app, "/a")];
  release();
  const states = (await Promise.all(answers)).map((response) => response.headers.get("x-rivet-cache"));
  assert.deepEqual(states, ["MISS", "HIT", "HIT"]);
  assert.equal(renders, 1);
});

test("keys: query strings (stored on their second request, ignored, or listed parameters only) and varied headers", async () => {
  const { handler, seen } = counting();
  const app = rules(
    handler,
    {
      "/q": { cache: { maxAge: 60 } },
      "/none": { cache: { maxAge: 60, query: false } },
      "/some": { cache: { maxAge: 60, query: ["page"] } },
      "/lang": { cache: { maxAge: 60, varies: ["Accept-Language"] } },
    },
    NONE,
  );
  const state = async (path: string, headers?: Record<string, string>) => (await get(app, path, headers)).headers.get("x-rivet-cache");
  assert.equal(await state("/q?a=1"), null); // first sight: rendered, not stored
  assert.equal(await state("/q?a=1"), "MISS");
  assert.equal(await state("/q?a=1"), "HIT");
  assert.equal(await state("/q?a=2"), null);
  assert.equal(await state("/none"), "MISS");
  assert.equal(await state("/none?utm=x"), "HIT");
  assert.equal(await state("/some?page=2&utm=a"), null);
  assert.equal(await state("/some?page=2&utm=a"), "MISS");
  assert.equal(await state("/some?utm=b&page=2"), "HIT");
  // A keyed header value is client-chosen input: stored on its second miss too.
  assert.equal(await state("/lang", { "accept-language": "de" }), null);
  assert.equal(await state("/lang", { "accept-language": "de" }), "MISS");
  assert.equal(await state("/lang", { "accept-language": "de" }), "HIT");
  assert.equal(await state("/lang", { "accept-language": "fr" }), null);
  assert.equal(await state("/lang"), "MISS"); // no value: first miss
  assert.equal(seen.length, 10);
});

test("revalidate: by path (with or without the base, /** below), by tag", async () => {
  const { handler, seen } = counting();
  const app = rules(handler, { "/rv/**": { cache: { maxAge: 60, tags: ["rv"] } }, "/rva": { isr: true } }, NONE, "/app", { origin: "http://x" });
  const state = async (path: string) => (await get(app, path)).headers.get("x-rivet-cache");
  for (const path of ["/app/rv/a", "/app/rv/b", "/app/rva"]) await state(path);
  assert.equal(revalidate({ path: "/rv/a" }), 1);
  assert.equal(await state("/app/rv/a"), "MISS");
  assert.equal(await state("/app/rv/b"), "HIT");
  assert.equal(revalidate({ path: "/app/rv/**" }), 2);
  assert.equal(await state("/app/rv/b"), "MISS");
  assert.equal(revalidate({ tag: "rv" }), 1); // /rv/b (stored again above); /rva has no tag
  assert.equal(await state("/app/rva"), "HIT");
  assert.equal(revalidate({ tag: "nope" }), 0);
  // Outside the base: no rule applies.
  assert.equal(await state("/rv/a"), null);
  assert.equal(seen.length, 6);
});

test("bounds: entries past maxEntries / maxBytes are evicted (CLOCK: a recently hit page survives a sweep)", async () => {
  const { handler } = counting();
  const app = rules(handler, { "/*": { cache: { maxAge: 60 } } }, NONE, "", { maxEntries: 2 });
  const state = async (path: string) => (await get(app, path)).headers.get("x-rivet-cache");
  await state("/a");
  await state("/b");
  assert.equal(await state("/a"), "HIT"); // referenced
  await state("/c"); // evicts /b (unreferenced), /a gets a second chance
  assert.equal(await state("/a"), "HIT");
  assert.equal(await state("/b"), "MISS");
  const tiny = rules(handler, { "/*": { cache: { maxAge: 60 } } }, NONE, "", { maxBytes: 100 });
  await get(tiny, "/big");
  assert.equal((await get(tiny, "/big")).headers.get("x-rivet-cache"), "MISS"); // over a quarter of maxBytes: never stored
});

test("headers: rule headers on every response of the path (pages, misses, hits, uncached, 304)", async () => {
  const { handler } = counting();
  const app = rules(handler, { "/**": { headers: { "x-frame-options": "DENY" } }, "/c": { swr: 5, headers: { "x-c": "1" } } }, NONE);
  assert.equal((await get(app, "/plain", {}, "POST")).headers.get("x-frame-options"), "DENY");
  const miss = await get(app, "/c");
  assert.equal(miss.headers.get("x-c"), "1");
  assert.equal(miss.headers.get("x-frame-options"), "DENY");
  const hit = await get(app, "/c");
  assert.equal(hit.headers.get("x-c"), "1");
  // Immutable headers (a fetched Response): copied.
  const frozen = rules(async () => Response.redirect("http://x/b", 302), { "/**": { headers: { "x-a": "1" } } }, NONE);
  assert.equal((await get(frozen, "/a")).headers.get("x-a"), "1");
});

const nonced: AppHandler = async (_request, context) =>
  new Response(
    `<html><head><script nonce="${context?.nonce}">boot()</script></head><body><script type="module" src="/a.js" nonce="${context?.nonce}"></script></body></html>`,
    {
      headers: { ...HTML, "content-security-policy": `script-src 'nonce-${context?.nonce}' 'strict-dynamic'` },
    },
  );
test("CSP: the app's nonce policy becomes a hash policy for the stored page; the miss keeps its own nonce", async () => {
  const policy: CachePolicy = { policy: (nonce) => `script-src 'nonce-${nonce}' 'strict-dynamic'`, hash: {} };
  const app = rules(nonced, { "/a": { swr: 60 } }, policy);
  const miss = await get(app, "/a");
  assert.match(await miss.text(), /nonce="n0nce"/);
  assert.equal(miss.headers.get("content-security-policy"), "script-src 'nonce-n0nce' 'strict-dynamic'");
  const hit = await get(app, "/a");
  const html = await hit.text();
  assert.doesNotMatch(html, /nonce/);
  const sha = createHash("sha256").update("boot()").digest("base64");
  assert.equal(hit.headers.get("content-security-policy"), `script-src 'sha256-${sha}' 'self'; object-src 'none'; base-uri 'none'`);
  // A route's own policy (not the app's) and `csp` functions (hash: null) keep the rendered nonce.
  const own = rules(nonced, { "/a": { swr: 60 } }, { policy: () => "other", hash: {} });
  await get(own, "/a");
  const kept = await get(own, "/a");
  assert.match(await kept.text(), /nonce="n0nce"/);
  assert.equal(kept.headers.get("content-security-policy"), "script-src 'nonce-n0nce' 'strict-dynamic'");
});

const entry = (renders: { n: number }, extra: Record<string, unknown> = {}) => ({
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {},
  page: () => () => `render ${++renders.n}`,
  document: () => ({ start: "<!doctype html><html><head></head><body>", end: "</body></html>" }),
  ...extra,
});
test("createApp: routeRules from the entry (rivetRouter) or the config; dev keeps headers only; the handler exposes ROUTE_CACHE", async () => {
  const renders = { n: 0 };
  const app = createApp({ entry: entry(renders, { routeRules: { "/a": { swr: 60, headers: { "x-a": "1" } } } }) as never, routeCache: { origin: "http://x" } });
  const first = await app(new Request("http://x/a"), { nonce: "abc" });
  assert.equal(first.headers.get("x-rivet-cache"), "MISS");
  assert.equal(first.headers.get("x-a"), "1");
  assert.equal(first.headers.get("content-security-policy"), "script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'");
  assert.match(await first.text(), /render 1/);
  const hit = await app(new Request("http://x/a"), { nonce: "def" });
  assert.equal(hit.headers.get("x-rivet-cache"), "HIT");
  assert.match(await hit.text(), /render 1/);
  // No inline scripts: the hash policy allows only same-origin script files.
  assert.equal(hit.headers.get("content-security-policy"), "script-src 'self'; object-src 'none'; base-uri 'none'");
  assert.equal(typeof (app as unknown as Record<symbol, unknown>)[ROUTE_CACHE], "function");
  // Config rules replace the entry's.
  const other = createApp({ entry: entry(renders, { routeRules: { "/a": { swr: 60 } } }) as never, routeRules: { "/b": { swr: 60 } } });
  assert.equal((await other(new Request("http://x/a"), { nonce: "x" })).headers.get("x-rivet-cache"), null);
  // Dev: no page store.
  const dev = createApp({ entry: entry(renders, { routeRules: { "/a": { swr: 60, headers: { "x-a": "1" } } } }) as never, dev: true });
  await dev(new Request("http://x/a"), { nonce: "x" });
  const again = await dev(new Request("http://x/a"), { nonce: "x" });
  assert.equal(again.headers.get("x-rivet-cache"), null);
  assert.equal(again.headers.get("x-a"), "1");
  // No rules: the plain handler.
  assert.equal((createApp({ entry: entry(renders) as never }) as unknown as Record<symbol, unknown>)[ROUTE_CACHE], undefined);
});

test("createApp renderCache: pages render inside the fragment cache scope", async () => {
  const { createRenderCache, cached } = await import("@rivetjs/runtime/server-cache");
  let calls = 0;
  const Footer = cached(() => `footer ${++calls}`, { id: "footer" });
  const renders = { n: 0 };
  const app = createApp({ entry: { ...entry(renders), page: () => () => Footer({}) } as never, renderCache: createRenderCache(), csp: false });
  const pages: string[] = [];
  for (let i = 0; i < 5; i++) pages.push(await (await app(new Request("http://x/a"))).text());
  // Admitted on its second miss, then replayed: without the scope every request would render the footer anew.
  assert.equal(calls, 2);
  assert.equal(new Set(pages.slice(1)).size, 1, pages.join("\n"));
});

test("rivetRouter routeRules: checked at config time, exported by the server entry", async () => {
  const { generate } = await import("../build/codegen.ts");
  const { routeTable } = await import("../build/routes.ts");
  const { rivetRouter } = await import("../build/vite.ts");
  const table = routeTable(["index.tsx"]);
  const rules = { "/blog/**": { swr: 60 } };
  assert.match(
    generate(table, { routesDir: "src/routes", routeRules: rules }).files["entry.server.tsx"]!,
    /export const routeRules = \{"\/blog\/\*\*":\{"swr":60\}\};/,
  );
  assert.doesNotMatch(generate(table, { routesDir: "src/routes" }).files["entry.server.tsx"]!, /routeRules/);
  assert.throws(() => rivetRouter({ routeRules: { blog: {} } }), /must start with/);
  assert.throws(() => rivetRouter({ routeRules: { "/a": { cache: { maxAge: Infinity } } } }), /JSON data/);
  assert.ok(rivetRouter({ routeRules: rules }).length);
});

test("node adapter: stored pages are served before a Request is built (304, br once per page, HEAD)", async () => {
  const renders = { n: 0 };
  const app = createApp({ entry: { ...entry(renders), page: () => () => "x".repeat(4000) + ++renders.n } as never, routeRules: { "/a": { swr: 60 } } });
  const serving = await serve({ handler: app, port: 0 });
  try {
    // No fixed origin: any Host is client-chosen, so a key is stored on its second miss.
    const first = await fetch(serving.url + "/a");
    assert.equal(first.headers.get("x-rivet-cache"), null);
    await first.text();
    const miss = await fetch(serving.url + "/a");
    assert.equal(miss.headers.get("x-rivet-cache"), "MISS");
    const etag = miss.headers.get("etag")!;
    await miss.text();
    const plain = await fetch(serving.url + "/a", { headers: { "accept-encoding": "identity" } });
    assert.equal(plain.headers.get("x-rivet-cache"), "HIT");
    assert.equal(plain.headers.get("x-content-type-options"), "nosniff");
    assert.match(await plain.text(), /x{4000}2/);
    const { request } = await import("node:http");
    const raw = (headers: Record<string, string>, method = "GET") =>
      new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((done, fail) => {
        const req = request(serving.url + "/a", { method, headers }, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => done({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on("error", fail);
        req.end();
      });
    assert.equal(plain.headers.get("vary"), "Accept-Encoding");
    const br = await raw({ "accept-encoding": "br" });
    assert.equal(br.headers["content-encoding"], "br");
    assert.equal(br.headers.vary, "Accept-Encoding");
    assert.match(brotliDecompressSync(br.body).toString(), /x{4000}2/);
    const cond = await raw({ "if-none-match": etag });
    assert.equal(cond.status, 304);
    assert.equal(cond.headers.vary, "Accept-Encoding");
    assert.equal(cond.body.length, 0);
    const head = await raw({}, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.headers["x-rivet-cache"], "HIT");
    assert.equal(renders.n, 2);
  } finally {
    await serving.close();
  }
});

test("keys: the request origin is part of the key; a fixed origin stores only its own pages", async () => {
  const { handler, seen } = counting();
  const app = withRouteRules(handler, { "/a": { swr: 60 } }, NONE);
  const at = (origin: string) => app(new Request(origin + "/a"), { nonce: "n" });
  // No fixed origin: the Host is client-chosen, so every key is stored on its second miss (a flood of forged
  // hosts never evicts pages).
  assert.equal((await at("http://x")).headers.get("x-rivet-cache"), null);
  assert.equal((await at("http://x")).headers.get("x-rivet-cache"), "MISS");
  // A forged Host (another origin) never gets the stored page of x, nor poisons it.
  assert.equal((await at("http://evil.example")).headers.get("x-rivet-cache"), null);
  const forged = await at("http://evil.example");
  assert.equal(forged.headers.get("x-rivet-cache"), "MISS");
  assert.match(await forged.text(), /http:\/\/evil\.example\/a/);
  const real = await at("http://x");
  assert.equal(real.headers.get("x-rivet-cache"), "HIT");
  assert.match(await real.text(), /2 http:\/\/x\/a/);
  assert.equal(seen.length, 4);
  // A fixed origin: other origins bypass the cache.
  const fixed = rules(counting().handler, { "/a": { isr: true } }, NONE, "", { origin: "http://x/" });
  const fixedAt = (origin: string) => fixed(new Request(origin + "/a"), { nonce: "n" });
  assert.equal((await fixedAt("http://x")).headers.get("x-rivet-cache"), "MISS");
  assert.equal((await fixedAt("http://evil.example")).headers.get("x-rivet-cache"), null);
  assert.equal((await fixedAt("http://x")).headers.get("x-rivet-cache"), "HIT");
  // The node fast path keys by the origin the adapter computed.
  const lookup = (fixed as unknown as Record<symbol, CacheLookup>)[ROUTE_CACHE]!;
  assert.ok(lookup("GET", "http://x", "/a", "", () => null));
  assert.equal(
    lookup("GET", "http://evil.example", "/a", "", () => null),
    undefined,
  );
  assert.throws(() => withRouteRules(handler, { "/a": { isr: true } }, NONE), /isr needs a fixed origin/);
});

test("paths: rules match and keys use the decoded path; non-canonical encodings are served but never stored", async () => {
  assert.deepEqual(normalPath("/a/b"), { match: "/a/b", canonical: true });
  assert.deepEqual(normalPath("/%61dmin"), { match: "/admin", canonical: false });
  assert.deepEqual(normalPath("/caf%C3%A9"), { match: "/café", canonical: true });
  assert.deepEqual(normalPath("/caf%c3%a9"), { match: "/café", canonical: false });
  assert.deepEqual(normalPath("/a%2Fb"), { match: "/a%2Fb", canonical: true });
  assert.deepEqual(normalPath("/a%20b"), { match: "/a b", canonical: true });
  assert.deepEqual(normalPath("/%E0%A4%A"), { match: "/%E0%A4%A", canonical: false });
  const { handler, seen } = counting();
  const app = rules(
    handler,
    {
      "/**": { swr: 60 },
      "/admin/**": { cache: false, headers: { "x-frame-options": "DENY" } },
      "/blog/*": { cache: { maxAge: 60, swr: true, tags: ["blog"] } },
    },
    NONE,
  );
  const at = async (path: string) => {
    const response = await get(app, path);
    return [response.headers.get("x-rivet-cache"), response.headers.get("x-frame-options")];
  };
  // An encoded spelling does not escape the /admin rule (no cache, its headers).
  assert.deepEqual(await at("/%61dmin/users"), [null, "DENY"]);
  assert.deepEqual(await at("/%61dmin/users"), [null, "DENY"]);
  // Non-canonical spellings of a cached page: rendered every time, never stored, never a new copy.
  assert.deepEqual(await at("/blog/%61"), [null, null]);
  assert.deepEqual(await at("/blog/%61"), [null, null]);
  assert.deepEqual(await at("/blog/a"), ["MISS", null]);
  assert.deepEqual(await at("/blog/%61"), [null, null]);
  // The canonical encoding of a non-ASCII path is stored under its decoded path.
  assert.deepEqual(await at("/blog/caf%C3%A9"), ["MISS", null]);
  assert.deepEqual(await at("/blog/caf%C3%A9"), ["HIT", null]);
  assert.equal(revalidate({ path: "/blog/café" }), 1);
  assert.equal(seen.length, 7);
});

test("anonymous fills: cookies: true pages render without the visitor's Cookie / Authorization", async () => {
  const { handler, seen } = counting((request, n) => new Response(`<p>${n} ${request.headers.get("cookie")}</p>`, { headers: HTML }));
  const app = rules(handler, { "/**": { cache: { maxAge: 60, cookies: true } } }, NONE);
  const miss = await get(app, "/a", { cookie: "session=alice" });
  assert.equal(miss.headers.get("x-rivet-cache"), "MISS");
  assert.equal(await miss.text(), "<p>1 null</p>");
  const hit = await get(app, "/a", { cookie: "session=bob" });
  assert.equal(await hit.text(), "<p>1 null</p>");
  assert.equal(seen[0]!.headers.get("cookie"), null);
  assert.equal(seen[0]!.headers.get("authorization"), null);
});

test("response Vary: credentials need a keyed rule, other names join the key, Vary goes out with stored pages", async () => {
  const { handler, seen } = counting((request, n) => {
    const path = new URL(request.url).pathname;
    const vary = path === "/star" ? "*" : path.startsWith("/creds") ? "Cookie, Accept-Language" : path === "/fetch" ? "Sec-Fetch-Site" : "";
    return new Response(`<p>${n}</p>`, { headers: { ...HTML, ...(vary ? { vary } : {}) } });
  });
  const app = rules(
    handler,
    {
      "/**": { swr: 60 },
      "/creds-keyed": { cache: { maxAge: 60, varies: ["accept-language"] } },
      "/lang": { cache: { maxAge: 60, varies: ["Accept-Language"] } },
    },
    NONE,
  );
  const state = async (path: string, headers?: Record<string, string>) => {
    const response = await get(app, path, headers);
    return [response.headers.get("x-rivet-cache"), response.headers.get("vary")];
  };
  // Vary: * and a credential-chosen page without a keyed rule: never stored.
  assert.deepEqual(await state("/star"), [null, "*"]);
  assert.deepEqual(await state("/creds"), [null, "Cookie, Accept-Language"]);
  assert.deepEqual(await state("/creds"), [null, "Cookie, Accept-Language"]);
  // Keyed by the rule: stored per value (each value on its second miss), Vary on misses and hits.
  assert.deepEqual(await state("/creds-keyed", { "accept-language": "de" }), [null, "Cookie, Accept-Language"]);
  assert.deepEqual(await state("/creds-keyed", { "accept-language": "de" }), ["MISS", "cookie, accept-language"]);
  assert.deepEqual(await state("/creds-keyed", { "accept-language": "de" }), ["HIT", "cookie, accept-language"]);
  assert.deepEqual(await state("/creds-keyed", { "accept-language": "fr" }), [null, "Cookie, Accept-Language"]);
  assert.deepEqual(await state("/lang", { "accept-language": "de" }), [null, null]); // passthrough: the response's own Vary
  assert.deepEqual(await state("/lang", { "accept-language": "de" }), ["MISS", "accept-language"]);
  assert.deepEqual(await state("/lang", { "accept-language": "de" }), ["HIT", "accept-language"]);
  // A response Vary name beyond the rule's: part of the key from then on (a new value: stored on its second miss).
  assert.deepEqual(await state("/fetch", { "sec-fetch-site": "none" }), ["MISS", "sec-fetch-site"]);
  assert.deepEqual(await state("/fetch", { "sec-fetch-site": "none" }), ["HIT", "sec-fetch-site"]);
  assert.deepEqual(await state("/fetch", { "sec-fetch-site": "same-origin" }), [null, "Sec-Fetch-Site"]);
  assert.deepEqual(await state("/fetch", { "sec-fetch-site": "same-origin" }), ["MISS", "sec-fetch-site"]);
  assert.deepEqual(await state("/fetch", { "sec-fetch-site": "same-origin" }), ["HIT", "sec-fetch-site"]);
  assert.equal(seen.length, 11);
});

test("i18n: prefix never / as-needed pages are cached per locale input, redirects never", async () => {
  const { i18nGuard } = await import("@rivetjs/i18n/router");
  const make = (prefix: "never" | "as-needed", rules: RouteRules) => {
    const renders = { n: 0 };
    const guard = i18nGuard({ locales: ["en", "de"], defaultLocale: "en", routing: { prefix }, baseUrl: "https://x.test" });
    const app = createApp({
      entry: {
        routes: [{ id: "p", pattern: "/*rest", layouts: [], server: () => Promise.resolve({ guard }), page: true }],
        universal: {},
        page: () => () => `render ${++renders.n}`,
      } as never,
      document: (input) => ({ start: `<html lang="${input.locale}"><body>`, end: "</body></html>" }),
      i18n: { locales: ["en", "de"] },
      csp: false,
      routeRules: rules,
      routeCache: { origin: "https://x.test" },
    });
    const get = async (path: string, headers: Record<string, string> = {}) => {
      const response = await app(new Request("https://x.test" + path, { headers }), { nonce: "n" });
      return [
        response.status,
        response.headers.get("x-rivet-cache"),
        response.status === 200 ? (await response.text()).slice(0, 16) : response.headers.get("location"),
      ];
    };
    return { get, renders };
  };
  // prefix "never" without a keyed rule: Vary: cookie, accept-language → not stored (no visitor's locale served to all).
  const plain = make("never", { "/**": { swr: 60 } });
  assert.deepEqual(await plain.get("/a", { "accept-language": "de" }), [200, null, '<html lang="de">']);
  assert.deepEqual(await plain.get("/a", { "accept-language": "en" }), [200, null, '<html lang="en">']);
  // Keyed by Accept-Language: one copy per language.
  const keyed = make("never", { "/**": { cache: { maxAge: 60, varies: ["accept-language"] } } });
  assert.deepEqual(await keyed.get("/a", { "accept-language": "de" }), [200, null, '<html lang="de">']);
  assert.deepEqual(await keyed.get("/a", { "accept-language": "de" }), [200, "MISS", '<html lang="de">']);
  assert.deepEqual(await keyed.get("/a", { "accept-language": "en" }), [200, null, '<html lang="en">']);
  assert.deepEqual(await keyed.get("/a", { "accept-language": "en" }), [200, "MISS", '<html lang="en">']);
  assert.deepEqual(await keyed.get("/a", { "accept-language": "de" }), [200, "HIT", '<html lang="de">']);
  // Cookie visitors bypass (their cookie may name a locale).
  assert.deepEqual(await keyed.get("/a", { "accept-language": "en", cookie: "rivet_locale=de" }), [200, null, '<html lang="de">']);
  // prefix "as-needed": a same-site visit of / (default locale) is stored for same-site visits only; a German
  // visitor from elsewhere still gets the redirect to /de.
  const needed = make("as-needed", { "/**": { cache: { maxAge: 60, varies: ["accept-language"] } } });
  const same = { "accept-language": "en", "sec-fetch-site": "same-origin" };
  assert.deepEqual(await needed.get("/", same), [200, null, '<html lang="en">']);
  assert.deepEqual(await needed.get("/", same), [200, "MISS", '<html lang="en">']);
  assert.deepEqual(await needed.get("/", same), [200, "HIT", '<html lang="en">']);
  assert.deepEqual(await needed.get("/", { "accept-language": "de", "sec-fetch-site": "cross-site" }), [302, null, "/de"]);
  assert.deepEqual(await needed.get("/", { "accept-language": "de", "sec-fetch-site": "cross-site" }), [302, null, "/de"]);
  assert.deepEqual(await needed.get("/", { "accept-language": "en", "sec-fetch-site": "cross-site" }), [200, null, '<html lang="en">']);
  assert.deepEqual(await needed.get("/", { "accept-language": "en", "sec-fetch-site": "cross-site" }), [200, "MISS", '<html lang="en">']);
  // O2: `cookies: true` shares the store with cookie requests, so a cookie-chosen page (`Vary: cookie`) is never
  // stored, even keyed by `varies`; the cookie visitor gets a render of their own request (their locale).
  const shared = make("never", { "/**": { cache: { maxAge: 60, varies: ["accept-language"], cookies: true } } });
  const german = { "accept-language": "en", cookie: "rivet_locale=de" };
  for (let i = 0; i < 3; i++) assert.deepEqual(await shared.get("/a", german), [200, null, '<html lang="de">']);
  // The first one renders twice (anonymous fill, then their own); the "not storable" verdict then holds for a while,
  // so later requests of that key render once, as themselves.
  assert.equal(shared.renders.n, 4);
  for (let i = 0; i < 3; i++) assert.deepEqual(await shared.get("/a", { "accept-language": "en" }), [200, null, '<html lang="en">']);
});

test("CSP: only elements carrying the render's nonce are hashed; injected markup stays blocked; a stray nonce is never stored", async () => {
  const policy: CachePolicy = { policy: (nonce) => `script-src 'nonce-${nonce}' 'strict-dynamic'`, hash: {} };
  const page =
    (injected: string): AppHandler =>
    async (_request, context) =>
      new Response(
        `<html><head><script nonce="${context?.nonce}">boot()</script></head><body><article>${injected}</article>` +
          `<script src="https://cdn.example/lib.js" nonce="${context?.nonce}"></script></body></html>`,
        { headers: { ...HTML, "content-security-policy": policy.policy(context!.nonce!) as string } },
      );
  const sha = (text: string) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
  // Stored XSS in content: an inline script and a third-party script file without the nonce.
  const app = rules(page(`<script>steal()</script><script src="https://evil.example/x.js"></script>`), { "/a": { swr: 60 } }, policy);
  await get(app, "/a");
  const hit = await get(app, "/a");
  assert.equal(hit.headers.get("x-rivet-cache"), "HIT");
  const csp = hit.headers.get("content-security-policy")!;
  assert.equal(csp, `script-src ${sha("boot()")} 'self' https://cdn.example; object-src 'none'; base-uri 'none'`);
  assert.ok(!csp.includes(sha("steal()")) && !csp.includes("evil.example"));
  assert.doesNotMatch(await hit.text(), /nonce/);
  // The nonce outside a renderer tag (an attribute value, script text): not stored.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (const [path, injected] of [
    ["/text", "<p>NONCE</p>"],
    ["/attr", `<a title="x nonce=&quot;NONCE&quot;">x</a>`],
  ] as const) {
    const leaky = rules(
      async (_request, context) =>
        new Response(`<html><body>${injected.replace("NONCE", context!.nonce!)}<script nonce="${context!.nonce}">boot()</script></body></html>`, {
          headers: { ...HTML, "content-security-policy": policy.policy(context!.nonce!) as string },
        }),
      { [path]: { swr: 60 } },
      policy,
    );
    assert.equal((await get(leaky, path)).headers.get("x-rivet-cache"), null, path);
    assert.equal((await get(leaky, path)).headers.get("x-rivet-cache"), null, path);
  }
  // A policy that trusts the nonce but is not converted (a `csp` function): never stored (one nonce for everyone).
  const kept = rules(page(""), { "/a": { swr: 60 } }, { policy: policy.policy, hash: null });
  await get(kept, "/a");
  assert.equal((await get(kept, "/a")).headers.get("x-rivet-cache"), null);
  vi.restoreAllMocks();
});

test("revalidate race: a render started before revalidate() does not store its page", async () => {
  let release!: () => void;
  let renders = 0;
  const handler: AppHandler = async () => {
    renders++;
    if (renders === 1) await new Promise<void>((done) => (release = done));
    return new Response(`<p>${renders}</p>`, { headers: HTML });
  };
  const app = rules(handler, { "/a": { isr: true } }, NONE, "", { origin: "http://x" });
  const pending = get(app, "/a");
  await new Promise((done) => setTimeout(done, 1));
  revalidate({ path: "/a" });
  release();
  const first = await pending;
  assert.equal(first.headers.get("x-rivet-cache"), null);
  assert.equal(await first.text(), "<p>1</p>");
  assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "MISS");
  assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "HIT");
  assert.equal(renders, 2);
});

test("error fallbacks: a page whose render reported a failure is answered but not stored", async () => {
  const { template } = await import("@rivetjs/runtime/server");
  let fail = true;
  const renders = { n: 0 };
  const reported: unknown[] = [];
  const app = createApp({
    entry: {
      ...entry(renders),
      page: () => () => {
        renders.n++;
        if (!fail) return template(["<p>fine</p>"]);
        return [template(["<p>shell</p>"]), Promise.reject(new Error("late"))];
      },
    } as never,
    csp: false,
    onError: (error) => void reported.push(error),
    routeRules: { "/a": { swr: 60 } },
  });
  const first = await app(new Request("http://x/a"), { nonce: "n" });
  assert.equal(first.status, 200);
  assert.match(await first.text(), /rivet:resume-error/);
  assert.equal(first.headers.get("x-rivet-cache"), null);
  assert.equal(reported.length, 1);
  fail = false;
  assert.equal((await app(new Request("http://x/a"), { nonce: "n" })).headers.get("x-rivet-cache"), "MISS");
  assert.equal((await app(new Request("http://x/a"), { nonce: "n" })).headers.get("x-rivet-cache"), "HIT");
  assert.equal(renders.n, 2);
});

test("refresh failures: a 404 drops the stale page; a 5xx keeps it and backs off (no render per request)", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  let status = 200;
  const { handler, seen } = counting((_request, n) => new Response(`<p>${n}</p>`, { status, headers: HTML }));
  const app = rules(handler, { "/a": { cache: { maxAge: 10, swr: true } } }, NONE);
  await get(app, "/a");
  vi.advanceTimersByTime(11_000);
  status = 500;
  const settle = () => new Promise((done) => setTimeout(done, 5));
  assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "STALE");
  await settle();
  assert.equal(seen.length, 2);
  // Backing off: stale answers without renders.
  for (let i = 0; i < 5; i++) assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "STALE");
  await settle();
  assert.equal(seen.length, 2);
  vi.advanceTimersByTime(1_000);
  await get(app, "/a");
  await settle();
  assert.equal(seen.length, 3);
  vi.advanceTimersByTime(1_000); // second failure: 2 s
  await get(app, "/a");
  await settle();
  assert.equal(seen.length, 3);
  // Deleted: a 404 refresh drops the page; the next request renders (and answers 404).
  vi.advanceTimersByTime(1_000);
  status = 404;
  assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "STALE");
  await settle();
  const gone = await get(app, "/a");
  assert.equal(gone.status, 404);
  assert.equal(gone.headers.get("x-rivet-cache"), null);
});

test("refresh: a 3xx or a Set-Cookie answer drops the stale page (moved / now personal), never serves it again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const settle = () => new Promise((done) => setTimeout(done, 5));
  for (const answer of [
    () => new Response(null, { status: 301, headers: { location: "http://x/b" } }),
    () => new Response("<p>personal</p>", { headers: { ...HTML, "set-cookie": "session=1" } }),
  ]) {
    let refresh = false;
    const { handler } = counting((_request, n) => (refresh ? answer() : new Response(`<p>${n}</p>`, { headers: HTML })));
    const app = rules(handler, { "/a": { cache: { maxAge: 10, swr: true } } }, NONE);
    assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "MISS");
    vi.advanceTimersByTime(11_000);
    refresh = true;
    assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "STALE");
    await settle();
    const after = await get(app, "/a");
    assert.equal(after.headers.get("x-rivet-cache"), null);
    assert.ok(after.status === 301 || after.headers.has("set-cookie"));
  }
});

test("visitor-neutral fills: no client address, forwarded / CDN client headers (unless keyed)", async () => {
  const seen: { headers: Headers; address: unknown }[] = [];
  const handler: AppHandler = async (request, context) => (
    seen.push({ headers: request.headers, address: (context as { address?: unknown } | undefined)?.address }),
    new Response("<p>x</p>", { headers: HTML })
  );
  const app = rules(handler, { "/a": { swr: 60 }, "/geo": { cache: { maxAge: 60, varies: ["cf-ipcountry"] } } }, NONE);
  const visitor = {
    "x-forwarded-for": "203.0.113.7",
    "x-forwarded-proto": "https",
    forwarded: "for=203.0.113.7",
    "x-real-ip": "203.0.113.7",
    "true-client-ip": "203.0.113.7",
    "cf-connecting-ip": "203.0.113.7",
    "cf-ipcountry": "DE",
    "accept-language": "de",
  };
  const call = (path: string) => app(new Request("http://x" + path, { headers: visitor }), { nonce: "n", address: "203.0.113.7" } as never);
  assert.equal((await call("/a")).headers.get("x-rivet-cache"), "MISS");
  const fill = seen[0]!;
  for (const name of Object.keys(visitor)) if (name !== "accept-language") assert.equal(fill.headers.get(name), null, name);
  assert.equal(fill.headers.get("accept-language"), "de");
  assert.equal(fill.address, undefined);
  // A keyed header is forwarded (the page is chosen by it).
  await call("/geo");
  await call("/geo");
  assert.equal(seen.at(-1)!.headers.get("cf-ipcountry"), "DE");
  assert.equal(seen.at(-1)!.headers.get("cf-connecting-ip"), null);
});

test("revalidate race: only fills of a matching path / tag are voided (per key, not store-wide)", async () => {
  const gates = new Map<string, () => void>();
  const renders: string[] = [];
  const handler: AppHandler = async (request) => {
    const path = new URL(request.url).pathname;
    renders.push(path);
    await new Promise<void>((done) => gates.set(path, done));
    return new Response(`<p>${path}</p>`, { headers: HTML });
  };
  const app = rules(handler, { "/a": { swr: 60 }, "/b": { swr: 60 }, "/t": { cache: { maxAge: 60, tags: ["news"] } } }, NONE);
  const tick = () => new Promise((done) => setTimeout(done, 1));
  const pending = ["/a", "/b", "/t"].map((path) => get(app, path));
  await tick();
  revalidate({ path: "/b" });
  revalidate({ tag: "news" });
  for (const release of gates.values()) release();
  const [a, b, t] = await Promise.all(pending);
  assert.equal(a!.headers.get("x-rivet-cache"), "MISS"); // another path's revalidate() leaves it stored
  assert.equal(b!.headers.get("x-rivet-cache"), null);
  assert.equal(t!.headers.get("x-rivet-cache"), null);
  gates.clear();
  assert.equal((await get(app, "/a")).headers.get("x-rivet-cache"), "HIT");
  assert.deepEqual(renders, ["/a", "/b", "/t"]);
});

test("bounds: compressed copies charged by an adapter count against maxBytes", async () => {
  const { handler } = counting();
  const app = rules(handler, { "/*": { cache: { maxAge: 60 } } }, NONE, "", { maxBytes: 4000 });
  await get(app, "/a");
  await get(app, "/b");
  const lookup = (app as unknown as Record<symbol, CacheLookup>)[ROUTE_CACHE]!;
  const a = lookup("GET", "http://x", "/a", "", () => null)!;
  assert.ok(a.size > a.body.byteLength);
  assert.ok(lookup("GET", "http://x", "/b", "", () => null));
  a.charge(3800);
  assert.equal(
    lookup("GET", "http://x", "/b", "", () => null),
    undefined,
  );
  assert.ok(lookup("GET", "http://x", "/a", "", () => null));
});
