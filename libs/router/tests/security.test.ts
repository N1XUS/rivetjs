// Router security: CSRF before any handler, same-origin redirects, request body limit, data-request
// redirect envelopes, action names with a query, node adapter public origin / proxy headers.
import { test } from "vitest";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";
import { redirect } from "../shared/errors.ts";
import { safeRedirect } from "../shared/redirect.ts";
import { serve, type Handler } from "../adapters/node.ts";
import { serverExports } from "../server/module.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const decode = async (response: Response): Promise<unknown> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};
const page = (input: RenderInput) =>
  new Response(JSON.stringify({ id: input.route.id, data: input.data, action: input.action }), {
    status: input.status,
    headers: { ...Object.fromEntries(input.headers), "content-type": "text/html" },
  });
const app = (routes: AppRoute[], extra: { maxBody?: number | { default?: number; multipart?: number } } = {}) =>
  createHandler({
    routes,
    render: page,
    renderError: ({ status, message }) => new Response(`error ${status} ${message}`, { status }),
    onError: () => {},
    ...extra,
  });

test("CSRF: page onPost and onRequest never run for cross-site or provenance-less form posts", async () => {
  const log: string[] = [];
  const handler = app([
    {
      id: "items",
      pattern: "/items",
      page: true,
      layouts: [mod({ onRequest: () => void log.push("layout onRequest"), guard: () => void log.push("guard") })],
      server: mod({
        onPost: () => (log.push("onPost"), new Response("created", { status: 201 })),
        actions: { save: () => (log.push("action"), { ok: true }) },
      }),
    },
  ]);
  const form = () => new URLSearchParams({ a: "1" });
  const post = (path: string, headers: Record<string, string>, body: BodyInit | null = form()) =>
    handler(new Request("http://x" + path, { method: "POST", body, headers }));
  assert.equal((await post("/items", { origin: "http://evil" })).status, 403);
  assert.equal((await post("/items", { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await post("/items", { "sec-fetch-site": "same-site" })).status, 403);
  // Form content types (incl. text/plain, multipart) with neither header: 403.
  assert.equal((await post("/items", {})).status, 403);
  assert.equal((await post("/items", { "content-type": "text/plain" }, "a=1")).status, 403);
  const multipart = new FormData();
  multipart.set("a", "1");
  assert.equal((await post("/items", {}, multipart)).status, 403);
  assert.equal((await post("/items?/save", {})).status, 403);
  assert.deepEqual(log, [], "no handler ran");
  // Same origin passes; JSON without provenance headers (non-browser client) passes.
  assert.equal((await post("/items", { origin: "http://x" })).status, 201);
  assert.equal((await post("/items", { "sec-fetch-site": "same-origin" })).status, 201);
  assert.equal((await post("/items", { "content-type": "application/json" }, "{}")).status, 201);
  // Other unsafe methods are checked as well (before the 405 / handler logic).
  assert.equal((await handler(new Request("http://x/items", { method: "DELETE", headers: { origin: "http://evil" } }))).status, 403);
  // Dev: provenance-less form posts pass (curl); a cross-site Origin never does.
  const dev = createHandler({
    routes: [{ id: "f", pattern: "/f", page: true, layouts: [], server: mod({ onPost: () => new Response("ok") }) }],
    render: page,
    dev: true,
  });
  assert.equal((await dev(new Request("http://x/f", { method: "POST", body: form() }))).status, 200);
  assert.equal((await dev(new Request("http://x/f", { method: "POST", body: form(), headers: { origin: "http://evil" } }))).status, 403);
});

test("CSRF: endpoints are checked by default; `export const csrf = false` opts out", async () => {
  let hits = 0;
  const onPost = () => (hits++, new Response("ok"));
  const handler = app([
    { id: "api/hook", pattern: "/api/hook", page: false, layouts: [], server: mod({ onPost, csrf: false }) },
    { id: "api/thing", pattern: "/api/thing", page: false, layouts: [], server: mod({ onPost, PUT: onPost }) },
  ]);
  const evil = { origin: "http://evil", "content-type": "application/x-www-form-urlencoded" };
  assert.equal((await handler(new Request("http://x/api/thing", { method: "POST", body: "a=1", headers: evil }))).status, 403);
  assert.equal((await handler(new Request("http://x/api/thing", { method: "PUT", body: "a=1", headers: evil }))).status, 403);
  assert.equal(hits, 0);
  assert.equal((await handler(new Request("http://x/api/hook", { method: "POST", body: "a=1", headers: evil }))).status, 200);
  assert.equal((await handler(new Request("http://x/api/thing", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }))).status, 200);
  assert.equal(hits, 2);
  // The flag survives export normalization (in-file and sibling modules).
  assert.equal(serverExports({ csrf: false, onPost }, false).csrf, false);
  assert.equal(serverExports({ csrf: false, POST: onPost }, true).csrf, false);
});

test("redirect(): same-origin by default, `external: true` for other origins", async () => {
  for (const ok of ["/a", "/a?b=1#c", "b", "?x=1", "http://x/elsewhere"]) assert.equal(redirect(ok).location, ok);
  for (const bad of ["//evil.com", "/\\evil.com", "\\evil.com", "/a\nb", "\t//evil.com"]) assert.throws(() => redirect(bad), /redirect\(\)/, bad);
  assert.equal(redirect("https://other.example/", { external: true }).location, "https://other.example/");
  assert.equal(redirect("https://other.example/", 307, { external: true }).status, 307);
  assert.equal(redirect("/a", 301).status, 301);
  assert.equal(redirect("/a", { status: 308 }).status, 308);
  assert.throws(() => redirect("javascript:alert(1)", { external: true }), /http/);
  // An absolute non-external target must match the request origin (checked where the request is known).
  const errors: unknown[] = [];
  const handler = createHandler({
    routes: [
      { id: "same", pattern: "/same", page: true, layouts: [], server: mod({ guard: () => redirect("http://x/to") }) },
      { id: "other", pattern: "/other", page: true, layouts: [], server: mod({ guard: () => redirect("https://evil.example/") }) },
      { id: "ext", pattern: "/ext", page: true, layouts: [], server: mod({ guard: () => redirect("https://pay.example/", { external: true }) }) },
    ],
    render: page,
    onError: (e) => errors.push(e),
  });
  assert.equal((await handler(new Request("http://x/same"))).headers.get("location"), "http://x/to");
  const other = await handler(new Request("http://x/other"));
  assert.equal(other.status, 500);
  assert.equal(other.headers.get("location"), null);
  assert.match(String(errors[0]), /external: true/);
  assert.equal((await handler(new Request("http://x/ext"))).headers.get("location"), "https://pay.example/");
  // safeRedirect (user-supplied targets) lives in the router now.
  assert.equal(safeRedirect("/a?b#c"), "/a?b#c");
  assert.equal(safeRedirect("//evil", "/home"), "/home");
});

test("maxBody: oversized bodies answer 413 (Content-Length early, then while streaming); multipart default 10 MiB", async () => {
  let read = 0;
  const handler = app(
    [
      {
        id: "api/upload",
        pattern: "/api/upload",
        page: false,
        layouts: [],
        server: mod({ onPost: async (e) => ((read = (await e.request.arrayBuffer()).byteLength), new Response("ok")) }),
      },
      { id: "form", pattern: "/form", page: true, layouts: [], server: mod({ actions: { save: async (e) => ({ size: (await e.request.text()).length }) } }) },
    ],
    { maxBody: 1000 },
  );
  const json = { "content-type": "application/json" };
  assert.equal((await handler(new Request("http://x/api/upload", { method: "POST", body: "x".repeat(1000), headers: json }))).status, 200);
  assert.equal(read, 1000);
  assert.equal(
    (await handler(new Request("http://x/api/upload", { method: "POST", body: "x".repeat(1001), headers: { ...json, "content-length": "1001" } }))).status,
    413,
  );
  // Streamed without Content-Length.
  const chunks = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < 5; i++) controller.enqueue(new Uint8Array(400));
      controller.close();
    },
  });
  const streamed = await handler(new Request("http://x/api/upload", { method: "POST", body: chunks, headers: json, duplex: "half" } as RequestInit));
  assert.equal(streamed.status, 413);
  const action = await handler(
    new Request("http://x/form?/save", { method: "POST", body: "x".repeat(2000), headers: { origin: "http://x", "content-type": "text/plain" } }),
  );
  assert.equal(action.status, 413);
  // Defaults: 1 MiB, multipart 10 MiB.
  const defaults = app([
    {
      id: "api/upload",
      pattern: "/api/upload",
      page: false,
      layouts: [],
      server: mod({ onPost: async (e) => (await e.request.arrayBuffer(), new Response("ok")) }),
    },
  ]);
  const big = "x".repeat(1024 * 1024 + 1);
  assert.equal((await defaults(new Request("http://x/api/upload", { method: "POST", body: big, headers: json }))).status, 413);
  const files = new FormData();
  files.set("f", new Blob([big]));
  assert.equal((await defaults(new Request("http://x/api/upload", { method: "POST", body: files, headers: { origin: "http://x" } }))).status, 200);
});

test("data requests: Response redirects from guards/onRequest become {redirect}; other Responses {reload}", async () => {
  const handler = app([
    { id: "a", pattern: "/a", page: true, layouts: [mod({ onRequest: () => Response.redirect("http://x/login?next=/a", 302) })], server: mod({}) },
    {
      id: "b",
      pattern: "/b",
      page: true,
      layouts: [],
      server: mod({ guard: () => new Response(null, { status: 303, headers: { location: "/elsewhere", "set-cookie": "flash=1; Path=/" } }) }),
    },
    {
      id: "c",
      pattern: "/c",
      page: true,
      layouts: [],
      server: mod({ onGet: () => new Response("<html>teapot</html>", { headers: { "content-type": "text/html" } }) }),
    },
    { id: "d", pattern: "/d", page: true, layouts: [], server: mod({ guard: () => redirect("/login") }) },
  ]);
  const data = (path: string) => handler(new Request("http://x" + path + "?_rivet=data"));
  const a = await data("/a");
  assert.equal(a.status, 200);
  assert.match(a.headers.get("content-type")!, /application\/json/);
  assert.deepEqual(await decode(a), { redirect: "http://x/login?next=/a", status: 302 });
  const b = await data("/b");
  assert.equal(b.headers.get("set-cookie"), "flash=1; Path=/");
  assert.deepEqual(await decode(b), { redirect: "/elsewhere", status: 303 });
  const c = await data("/c");
  assert.equal(c.status, 200);
  assert.deepEqual(await decode(c), { reload: true });
  assert.deepEqual(await decode(await data("/d")), { redirect: "/login", status: 302 });
  // Document requests keep the raw Response.
  assert.equal((await handler(new Request("http://x/a"))).status, 302);
  assert.equal(await (await handler(new Request("http://x/c"))).text(), "<html>teapot</html>");
});

test("action names end at `&`: POST ?/save&next=/b runs `save`", async () => {
  const handler = app([
    { id: "f", pattern: "/f", page: true, layouts: [], server: mod({ actions: { save: (e) => ({ next: e.url.searchParams.get("next") }) } }) },
  ]);
  const response = await handler(
    new Request("http://x/f?/save&next=/b", { method: "POST", body: "", headers: { origin: "http://x", accept: "application/json" } }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await decode(response), { action: { name: "save", result: { next: "/b" } } });
});

/** Raw HTTP POST through the node adapter. */
function rawPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((done, fail) => {
    const { hostname, port } = new URL(url);
    const req = httpRequest(
      { hostname, port, path: "/f?/save", method: "POST", headers: { "content-length": String(Buffer.byteLength(body)), ...headers } },
      (res) => {
        const parts: Buffer[] = [];
        res.on("data", (c: Buffer) => parts.push(c));
        res.on("end", () => done({ status: res.statusCode ?? 0, body: Buffer.concat(parts).toString() }));
      },
    );
    req.on("error", fail);
    req.end(body);
  });
}

test("node adapter: forwarded headers ignored by default; trustProxy hops / predicate; fixed `origin`; client address in event.platform", async () => {
  const seen: { origin: string; address?: string }[] = [];
  const handler = createHandler({
    routes: [
      {
        id: "f",
        pattern: "/f",
        page: true,
        layouts: [],
        server: mod({
          actions: { save: (e) => (seen.push({ origin: e.url.origin, ...(e.platform.clientAddress ? { address: e.platform.clientAddress } : {}) }), "ok") },
        }),
      },
    ],
    render: page,
    onError: () => {},
  });
  const form = { "content-type": "application/x-www-form-urlencoded" };
  const loopback = /^(?:127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/;
  // One proxy (`true` = 1 hop): the entry it appended is the client; a client-sent (spoofed) entry left of it is not.
  const proxied = await serve({ handler: handler as Handler, port: 0, trustProxy: true });
  try {
    const host = new URL(proxied.url).host;
    // TLS-terminating proxy: browser Origin is https, the hop is plain http.
    const ok = await rawPost(
      proxied.url,
      {
        ...form,
        host: "internal:8080",
        origin: "https://shop.example",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "shop.example",
        "x-forwarded-for": "6.6.6.6, 203.0.113.7",
      },
      "a=1",
    );
    assert.equal(ok.status, 200, ok.body);
    assert.deepEqual(seen.pop(), { origin: "https://shop.example", address: "203.0.113.7" });
    assert.equal(
      (await rawPost(proxied.url, { ...form, host, origin: "https://evil.example", "x-forwarded-proto": "https", "x-forwarded-host": "shop.example" }, "a=1"))
        .status,
      403,
    );
  } finally {
    await proxied.close();
  }
  // Two proxies: values at the outer hop (address, protocol).
  const two = await serve({ handler: handler as Handler, port: 0, trustProxy: 2 });
  try {
    const ok = await rawPost(
      two.url,
      {
        ...form,
        host: "internal:8080",
        origin: "https://shop.example",
        "x-forwarded-proto": "https, http",
        "x-forwarded-host": "shop.example",
        "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1",
      },
      "a=1",
    );
    assert.equal(ok.status, 200, ok.body);
    assert.deepEqual(seen.pop(), { origin: "https://shop.example", address: "203.0.113.7" });
  } finally {
    await two.close();
  }
  // Predicate (Express-style): trust the loopback peer and 10/8 proxies; the first untrusted address is the client.
  const predicate = await serve({ handler: handler as Handler, port: 0, trustProxy: (address) => loopback.test(address) || address.startsWith("10.") });
  try {
    const ok = await rawPost(
      predicate.url,
      {
        ...form,
        host: "internal:8080",
        origin: "https://shop.example",
        "x-forwarded-proto": "https, http",
        "x-forwarded-host": "shop.example",
        "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1",
      },
      "a=1",
    );
    assert.equal(ok.status, 200, ok.body);
    assert.deepEqual(seen.pop(), { origin: "https://shop.example", address: "203.0.113.7" });
  } finally {
    await predicate.close();
  }
  // Without trustProxy the forwarded headers are ignored (the TLS proxy case needs `origin`): spoofed X-Forwarded-For too.
  const plain = await serve({ handler: handler as Handler, port: 0 });
  try {
    const host = new URL(plain.url).host;
    assert.equal(
      (await rawPost(plain.url, { ...form, host, origin: "https://shop.example", "x-forwarded-proto": "https", "x-forwarded-host": "shop.example" }, "a=1"))
        .status,
      403,
    );
    assert.equal((await rawPost(plain.url, { ...form, host, origin: "http://" + host, "x-forwarded-for": "6.6.6.6" }, "a=1")).status, 200);
    assert.match(seen.pop()!.address!, loopback);
  } finally {
    await plain.close();
  }
  const fixed = await serve({ handler: handler as Handler, port: 0, origin: "https://shop.example" });
  try {
    assert.equal((await rawPost(fixed.url, { ...form, host: "anything", origin: "https://shop.example" }, "a=1")).status, 200);
    assert.equal(seen.pop()!.origin, "https://shop.example");
  } finally {
    await fixed.close();
  }
});
