import { test } from "vitest";
import assert from "node:assert/strict";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";
import { deny, error, notFound, redirect } from "../shared/errors.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const decode = async (response: Response): Promise<unknown> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};
const page = (input: RenderInput) =>
  new Response(JSON.stringify({ id: input.route.id, data: input.data, params: input.params, action: input.action }), {
    status: input.status,
    headers: { ...Object.fromEntries(input.headers), "content-type": "text/html" },
  });

function app(routes: AppRoute[], log: string[] = []) {
  return createHandler({
    routes,
    render: page,
    renderError: ({ status, message, route }) => new Response(`error ${status} ${message} ${route?.id ?? "-"}`, { status }),
    onError: (e, _request, info) => log.push("report " + String(e) + (info ? " " + info.digest : "")),
  });
}

test("guards run outer to inner and stop the chain; loaders run in parallel after all guards", async () => {
  const log: string[] = [];
  let release: () => void = () => {};
  const both = new Promise<void>((done) => (release = done));
  let started = 0;
  const loader = (value: string) => async () => {
    log.push("load " + value);
    if (++started === 2) release();
    await both; // deadlocks unless both loaders run concurrently
    return value;
  };
  const handler = app([
    {
      id: "admin/[id]",
      pattern: "/admin/:id",
      page: true,
      layouts: [
        mod({
          guard: (e) => {
            log.push("guard root");
            e.locals.user = e.cookies.get("user");
          },
          load: loader("layout"),
        }),
        undefined,
      ],
      server: mod({
        guard: (e) => {
          log.push("guard page");
          if (e.locals.user !== "ada") return redirect("/login");
        },
        load: loader("page"),
      }),
    },
  ]);
  const out = await handler(new Request("http://x/admin/7", { headers: { cookie: "user=bob" } }));
  assert.equal(out.status, 302);
  assert.equal(out.headers.get("location"), "/login");
  assert.deepEqual(log, ["guard root", "guard page"]);
  log.length = 0;
  // The layout without a server module contributes undefined (null after JSON).
  const ok = await handler(new Request("http://x/admin/7", { headers: { cookie: "user=ada" } }));
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(await ok.text()), { id: "admin/[id]", data: ["layout", null, "page"], params: { id: "7" } });
  assert.deepEqual(log, ["guard root", "guard page", "load layout", "load page"]);
  assert.equal(ok.headers.get("cache-control"), "no-cache");
});

test("thrown control flow maps to statuses; unknown errors are 500 and reported without leaking", async () => {
  const log: string[] = [];
  const route = (id: string, server: ServerModule): AppRoute => ({ id, pattern: "/" + id, page: true, layouts: [], server: mod(server) });
  const handler = app(
    [
      route("deny", { guard: () => deny() }),
      route("missing", {
        load: () => {
          throw notFound("No such post");
        },
      }),
      route("teapot", {
        load: () => {
          throw error(418, "Short and stout");
        },
      }),
      route("crash", {
        load: () => {
          throw new Error("db password wrong");
        },
      }),
    ],
    log,
  );
  const text = async (path: string) => {
    const r = await handler(new Request("http://x" + path));
    return [r.status, await r.text()];
  };
  assert.deepEqual(await text("/deny"), [403, "error 403 Forbidden deny"]);
  assert.deepEqual(await text("/missing"), [404, "error 404 No such post missing"]);
  assert.deepEqual(await text("/teapot"), [418, "error 418 Short and stout teapot"]);
  // Hidden 5xx messages carry a digest that matches the server's report.
  const [status, body] = await text("/crash");
  assert.equal(status, 500);
  const digest = /^error 500 Internal Server Error \(digest ([0-9a-f]{10})\) crash$/.exec(String(body))?.[1];
  assert.ok(digest, String(body));
  assert.deepEqual(await text("/nowhere"), [404, "error 404 Not found -"]);
  assert.deepEqual(log, ["report Error: db password wrong " + digest]);
});

test("data endpoint runs guards and loaders and encodes rich values; redirects become data", async () => {
  const when = new Date(0);
  const handler = app([
    {
      id: "post",
      pattern: "/post/:slug",
      page: true,
      layouts: [],
      server: mod({
        guard: (e) => (e.params.slug === "secret" ? redirect("/login") : undefined),
        load: (e) => ({ slug: e.params.slug, when, tags: new Set(["a"]), views: 10n, query: e.url.search }),
      }),
    },
  ]);
  const ok = await handler(new Request("http://x/post/hi?_rivet=data&q=1"));
  assert.equal(ok.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await decode(ok), { data: [{ slug: "hi", when, tags: new Set(["a"]), views: 10n, query: "?q=1" }], status: 200 });
  const moved = await handler(new Request("http://x/post/secret?_rivet=data"));
  assert.equal(moved.status, 200);
  assert.deepEqual(await decode(moved), { redirect: "/login", status: 302 });
  const gone = await handler(new Request("http://x/nope?_rivet=data"));
  assert.equal(gone.status, 404);
  assert.deepEqual(await decode(gone), { error: { status: 404, message: "Not found" } });
});

test("actions: same-origin only, re-run loaders, JSON result on request, cookies and headers", async () => {
  let count = 0;
  const handler = app([
    {
      id: "counter",
      pattern: "/counter",
      page: true,
      layouts: [],
      server: mod({
        headers: () => ({ "x-route": "counter" }),
        load: () => count,
        actions: {
          add: async (e) => {
            const form = await e.request.formData();
            count += Number(form.get("by"));
            e.cookies.set("last", String(count), { maxAge: 60 });
            return { count };
          },
        },
      }),
    },
  ]);
  const post = (headers: Record<string, string>) =>
    handler(new Request("http://x/counter?/add", { method: "POST", body: new URLSearchParams({ by: "2" }), headers }));
  assert.equal((await post({ origin: "http://evil" })).status, 403);
  assert.equal((await post({ "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal(count, 0);
  const rendered = await post({ origin: "http://x" });
  assert.deepEqual(JSON.parse(await rendered.text()), { id: "counter", data: [2], params: {}, action: { name: "add", result: { count: 2 } } });
  assert.equal(rendered.headers.get("x-route"), "counter");
  assert.equal(rendered.headers.get("set-cookie"), "last=2; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax");
  const asJson = await post({ origin: "http://x", accept: "application/json" });
  assert.deepEqual(await decode(asJson), { action: { name: "add", result: { count: 4 } } });
  assert.equal((await handler(new Request("http://x/counter?/nope", { method: "POST", headers: { origin: "http://x" } }))).status, 404);
  assert.equal((await handler(new Request("http://x/counter", { method: "PUT" }))).status, 405);
});

test("endpoint routes dispatch by method", async () => {
  const handler = app([{ id: "api/health", pattern: "/api/health", page: false, layouts: [], server: mod({ GET: () => Response.json({ ok: true }) }) }]);
  assert.deepEqual(await (await handler(new Request("http://x/api/health"))).json(), { ok: true });
  const head = await handler(new Request("http://x/api/health", { method: "HEAD" }));
  assert.equal(head.status, 200);
  const post = await handler(new Request("http://x/api/health", { method: "POST" }));
  assert.equal(post.status, 405);
});

test("data requests skip the loaders of kept layouts (guards still run); the response lists them", async () => {
  const calls: string[] = [];
  const layout = (id: string, extra: ServerModule = {}): (() => Promise<ServerModule>) =>
    mod({ guard: () => void calls.push("guard " + id), load: () => (calls.push("load " + id), id + " data"), ...extra });
  const route: AppRoute = {
    id: "shop/[item]",
    pattern: "/shop/:item",
    page: true,
    keys: ["/", "/shop"],
    layouts: [layout("root"), layout("shop")],
    server: mod({ load: (e) => (calls.push("load page"), { item: e.params.item, keep: e.url.searchParams.get("_rivet_keep") }) }),
  };
  const handler = app([route]);
  const get = async (search: string) => (await decode(await handler(new Request("http://x/shop/a?" + search)))) as { data: unknown[]; keep?: number[] };

  const all = await get("_rivet=data");
  assert.deepEqual(all, { data: ["root data", "shop data", { item: "a", keep: null }], status: 200 });
  assert.deepEqual(calls.splice(0), ["guard root", "guard shop", "load root", "load shop", "load page"]);

  // Unknown ids are ignored; the keep parameter never reaches loaders.
  const kept = await get("_rivet=data&_rivet_keep=/shop,/nope");
  assert.deepEqual(kept, { data: ["root data", undefined, { item: "a", keep: null }], status: 200, keep: [1] });
  assert.deepEqual(calls.splice(0), ["guard root", "guard shop", "load root", "load page"]);

  const both = await get("_rivet=data&_rivet_keep=/,/shop");
  assert.deepEqual(both.keep, [0, 1]);
  assert.deepEqual(calls.splice(0), ["guard root", "guard shop", "load page"]);

  // A guard still ends the request for a kept layout.
  const guarded = app([{ ...route, layouts: [layout("root"), layout("shop", { guard: () => redirect("/login") })] }]);
  assert.deepEqual(await decode(await guarded(new Request("http://x/shop/a?_rivet=data&_rivet_keep=/,/shop"))), { redirect: "/login", status: 302 });

  // Document requests ignore it; `keepable` vetoes per layout.
  const html = await handler(new Request("http://x/shop/a?_rivet_keep=/,/shop"));
  assert.deepEqual(JSON.parse(await html.text()).data, ["root data", "shop data", { item: "a", keep: "/,/shop" }]);
  calls.length = 0;
  const vetoed = createHandler({ routes: [route], render: page, keepable: () => [true, false] });
  const body = (await decode(await vetoed(new Request("http://x/shop/a?_rivet=data&_rivet_keep=/,/shop")))) as { keep?: number[] };
  assert.deepEqual(body.keep, [0]);
  assert.deepEqual(calls, ["guard root", "guard shop", "load shop", "load page"]);
});

test("data and page responses list the layouts whose loader read the URL or request", async () => {
  const handler = app([
    {
      id: "x",
      pattern: "/x",
      page: true,
      keys: ["/", "/a", "/b"],
      layouts: [mod({ load: ({ url }) => url.pathname }), mod({ load: () => 1 }), mod({ load: (e) => e.request.method })],
      server: mod({ load: ({ url }) => url.search }),
    },
  ]);
  const body = (await decode(await handler(new Request("http://x/x?_rivet=data")))) as { byURL?: number[] };
  assert.deepEqual(body.byURL, [0, 2]);
  const seen: (readonly number[] | undefined)[] = [];
  const pages = createHandler({
    routes: [{ id: "x", pattern: "/x", page: true, layouts: [mod({ load: ({ url }) => url.href })] }],
    render: (input) => (seen.push(input.byURL), new Response("ok")),
  });
  await pages(new Request("http://x/x"));
  assert.deepEqual(seen, [[0]]);
});

test("depends(): data and page responses carry each loader's keys (none when no loader calls it)", async () => {
  const seen: unknown[] = [];
  const route: AppRoute = {
    id: "x",
    pattern: "/x",
    page: true,
    keys: ["/", "/a"],
    layouts: [
      mod({
        guard: (e) => void e.depends("guard-key"),
        load: async (e) => {
          e.depends("cart");
          await Promise.resolve();
          e.depends("cart", new URL("http://api.test/user"));
          return 0;
        },
      }),
      mod({ load: () => 1 }),
    ],
    server: mod({ load: (e) => (e.depends("/api/items", "cart"), 2) }),
  };
  const handler = createHandler({ routes: [route], render: (input) => (seen.push("deps" in input ? input.deps : "none"), new Response("ok")) });
  const body = (await decode(await handler(new Request("http://x/x?_rivet=data")))) as { deps?: unknown[] };
  // Route data order (layouts, then page); a guard's depends() records nothing.
  assert.deepEqual(body.deps, [["cart", "http://api.test/user"], undefined, ["/api/items", "cart"]]);
  await handler(new Request("http://x/x"));
  assert.deepEqual(seen, [[["cart", "http://api.test/user"], undefined, ["/api/items", "cart"]]]);

  // Kept loaders report nothing (the client keeps their keys).
  const kept = (await decode(await handler(new Request("http://x/x?_rivet=data&_rivet_keep=/")))) as { deps?: unknown[] };
  assert.deepEqual(kept.deps, [undefined, undefined, ["/api/items", "cart"]]);

  // No depends() anywhere: no `deps` field, byte-identical bodies.
  const plainSeen: unknown[] = [];
  const plain = createHandler({
    routes: [{ ...route, layouts: [mod({ load: () => 0 })], keys: ["/"], server: mod({ load: () => 2 }) }],
    render: (input) => (plainSeen.push("deps" in input ? input.deps : "none"), new Response("ok")),
  });
  const text = await (await plain(new Request("http://x/x?_rivet=data"))).text();
  assert.doesNotMatch(text, /deps/);
  await plain(new Request("http://x/x"));
  assert.deepEqual(plainSeen, ["none"]);
});

test("data requests keep the page loader too (`.` in `_rivet_keep`): invalidate(key) of layout keys only", async () => {
  const calls: string[] = [];
  const route: AppRoute = {
    id: "x",
    pattern: "/x",
    page: true,
    keys: ["/"],
    layouts: [mod({ load: () => (calls.push("layout"), "l") })],
    server: mod({ guard: () => void calls.push("guard page"), load: () => (calls.push("page"), "p") }),
  };
  const handler = app([route]);
  const body = await decode(await handler(new Request("http://x/x?_rivet=data&_rivet_keep=.")));
  assert.deepEqual(body, { data: ["l", undefined], status: 200, keep: [1] });
  assert.deepEqual(calls, ["guard page", "layout"]);
  // A page whose `head` needs its data is never kept (`keepable`), like layouts.
  const vetoed = createHandler({ routes: [route], render: page, keepable: () => [true, false] });
  assert.deepEqual(((await decode(await vetoed(new Request("http://x/x?_rivet=data&_rivet_keep=/,.")))) as { keep?: number[] }).keep, [0]);
  // Pages without layouts too.
  const bare = app([{ id: "y", pattern: "/y", page: true, layouts: [], server: mod({ load: () => "p" }) }]);
  assert.deepEqual(await decode(await bare(new Request("http://x/y?_rivet=data&_rivet_keep=."))), { data: [undefined], status: 200, keep: [0] });
});

test("responses that set or delete a cookie are private (shared caches must not store them)", async () => {
  const handler = app([
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [],
      server: mod({
        headers: () => ({ "cache-control": "public, s-maxage=600, max-age=60" }),
        load: (e) => {
          const what = e.url.searchParams.get("c");
          if (what === "set") e.cookies.set("a", "1");
          if (what === "delete") e.cookies.delete("a");
          if (what === "redirect") {
            e.cookies.set("a", "1");
            throw redirect("/q");
          }
          return null;
        },
      }),
    },
  ]);
  const cacheControl = async (path: string) => (await handler(new Request("https://x.test" + path))).headers.get("cache-control");
  assert.equal(await cacheControl("/p"), "public, s-maxage=600, max-age=60");
  assert.equal(await cacheControl("/p?c=set"), "private, max-age=60");
  assert.equal(await cacheControl("/p?c=delete"), "private, max-age=60");
  assert.equal(await cacheControl("/p?c=redirect"), "private, max-age=60");
  assert.equal(await cacheControl("/p?c=set&_rivet=data"), "private, max-age=60");
});

test("malformed action name (bad percent-encoding) answers 400, not an escaped URIError", async () => {
  const handler = app([{ id: "f", pattern: "/f", page: true, layouts: [], server: mod({ actions: { save: () => "ok" } }) }]);
  const response = await handler(new Request("http://x/f?/%E0%A4%A", { method: "POST", body: "", headers: { origin: "http://x" } }));
  assert.equal(response.status, 400);
  const json = await handler(new Request("http://x/f?/%E0%A4%A", { method: "POST", body: "", headers: { origin: "http://x", accept: "application/json" } }));
  assert.equal(json.status, 400);
  assert.deepEqual(await decode(json), { error: { status: 400, message: "Malformed action name" } });
});

test("RequestEvent: route.id, isDataRequest, setHeaders, cookies.getAll", async () => {
  const seen: unknown[] = [];
  const handler = app([
    {
      id: "items/[id]",
      pattern: "/items/:id",
      page: true,
      layouts: [],
      server: mod({
        load: (e) => {
          e.cookies.set("c", "3");
          e.cookies.delete("a");
          seen.push({ id: e.route.id, data: e.isDataRequest, all: e.cookies.getAll() });
          e.setHeaders({ "x-one": "1", "x-two": "2" });
          assert.throws(() => e.setHeaders({ "Set-Cookie": "x=1" }), /cookies\.set/);
          return 1;
        },
      }),
    },
  ]);
  const html = await handler(new Request("http://x/items/7", { headers: { cookie: "a=1; b=2" } }));
  assert.equal(html.headers.get("x-one"), "1");
  assert.equal(html.headers.get("x-two"), "2");
  await handler(new Request("http://x/items/7?_rivet=data"));
  assert.deepEqual(seen, [
    {
      id: "items/[id]",
      data: false,
      all: [
        { name: "b", value: "2" },
        { name: "c", value: "3" },
      ],
    },
    { id: "items/[id]", data: true, all: [{ name: "c", value: "3" }] },
  ]);
});

test("OPTIONS reaches onRequest (CORS preflight: no CSRF check, no guards); unanswered → 204 with Allow", async () => {
  const log: string[] = [];
  const handler = app([
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [mod({ guard: () => void log.push("guard") })],
      server: mod({ onPut: () => new Response("put") }),
    },
    {
      id: "api/x",
      pattern: "/api/x",
      page: false,
      layouts: [],
      server: mod({
        onRequest: (e) => {
          log.push("request " + e.request.method);
          if (e.request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "https://other.example" } });
        },
        onGet: () => new Response("x"),
      }),
    },
  ]);
  const page = await handler(new Request("http://x/p", { method: "OPTIONS", headers: { origin: "https://other.example" } }));
  assert.equal(page.status, 204);
  assert.equal(page.headers.get("allow"), "GET, HEAD, POST, PUT, OPTIONS");
  const preflight = await handler(new Request("http://x/api/x", { method: "OPTIONS", headers: { origin: "https://other.example" } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://other.example");
  assert.deepEqual(log, ["request OPTIONS"]);
  const put = await handler(new Request("http://x/api/x", { method: "PUT", headers: { origin: "http://x" } }));
  assert.equal(put.status, 405);
});

test("onOptions answers OPTIONS after onRequest, outer → inner (page and endpoint own module too); void → 204 with Allow", async () => {
  const log: string[] = [];
  const cors = (origin: string) =>
    new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-methods": "POST" } });
  const handler = app([
    {
      id: "api/hook",
      pattern: "/api/hook",
      page: false,
      layouts: [mod({ onRequest: () => void log.push("layout request"), onOptions: () => void log.push("layout options") })],
      server: mod({ onOptions: (e) => (log.push("own options"), cors(e.request.headers.get("origin")!)), onPost: () => new Response("posted") }),
    },
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [mod({ guard: () => void log.push("guard") })],
      server: mod({ onOptions: () => void log.push("page options") }),
    },
  ]);
  const preflight = await handler(new Request("http://x/api/hook", { method: "OPTIONS", headers: { origin: "https://other.example" } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://other.example");
  assert.deepEqual(log.splice(0), ["layout request", "layout options", "own options"]);
  // A page whose onOptions returns nothing: 204 + `Allow` (onOptions adds no method of its own), no guards.
  const page = await handler(new Request("http://x/p", { method: "OPTIONS" }));
  assert.equal(page.status, 204);
  assert.equal(page.headers.get("allow"), "GET, HEAD, POST, OPTIONS");
  assert.deepEqual(log.splice(0), ["page options"], "no guards");
  // Other methods never reach onOptions.
  assert.equal(await (await handler(new Request("http://x/api/hook", { method: "POST", headers: { origin: "http://x" } }))).text(), "posted");
  assert.deepEqual(log, ["layout request"]);
});
