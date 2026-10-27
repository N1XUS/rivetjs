// Handler + document render hardening (review round 2): event headers on raw Responses, render
// failures before / after the first byte, own-property actions, unsafe Response locations, cookie
// validation, the data request query as sent, layout-loader access hint.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";
import { createApp, type GeneratedEntry } from "../server/app.ts";
import { renderDocument, renderPage } from "../server/render.ts";
import { deny } from "../shared/errors.ts";
import { withoutRivet } from "../shared/data.ts";
import { lazyComponent, template } from "@rivetjs/runtime/server";
import { preloadPage } from "../client/index.ts";

/** Raw markup (strings are escaped as text). */
const html = (markup: string) => template([markup], []);

const mod = (module: ServerModule) => () => Promise.resolve(module);
const decode = async (response: Response): Promise<unknown> => {
  const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
  return createDecoder(t).get(r);
};
const page = (input: RenderInput) =>
  new Response(JSON.stringify({ url: input.url.href, data: input.data }), {
    status: input.status,
    headers: { ...Object.fromEntries(input.headers), "content-type": "text/html" },
  });
const handlerOf = (routes: AppRoute[], log: string[] = [], dev = false) =>
  createHandler({
    routes,
    render: page,
    dev,
    renderError: ({ status, message }) => new Response(`error ${status} ${message}`, { status }),
    onError: (e, _r, info) => log.push(`report ${String(e)} ${info?.phase}`),
  });
const route = (server: ServerModule, extra: Partial<AppRoute> = {}): AppRoute => ({
  id: "x",
  pattern: "/x",
  page: true,
  layouts: [],
  server: mod(server),
  ...extra,
});

test("U6: cookies and headers set before a raw Response (request handler, guard, action, endpoint) reach it", async () => {
  const setters = (e: Parameters<NonNullable<ServerModule["guard"]>>[0]) => {
    e.cookies.set("sid", "abc");
    e.setHeader("x-trace", "1");
  };
  const handler = handlerOf([
    route({ onRequest: (e) => (setters(e), new Response("early", { headers: { "x-trace": "own" } })) }, { id: "a", pattern: "/a" }),
    route({ guard: (e) => (setters(e), Response.redirect("http://x/login", 302)) }, { id: "b", pattern: "/b" }),
    route({ actions: { login: (e) => (setters(e), new Response(null, { status: 303, headers: { location: "/home" } })) } }, { id: "c", pattern: "/c" }),
    { id: "api", pattern: "/api", page: false, layouts: [], server: mod({ onPost: (e) => (setters(e), Response.json({ ok: true })) }) },
  ]);
  const a = await handler(new Request("http://x/a"));
  assert.equal(a.headers.getSetCookie()[0]?.split(";")[0], "sid=abc");
  assert.equal(a.headers.get("x-trace"), "own", "the Response's own header wins");
  assert.match(a.headers.get("cache-control") ?? "", /^private/);
  // Response.redirect(): immutable headers, copied.
  const b = await handler(new Request("http://x/b"));
  assert.equal(b.status, 302);
  assert.equal(b.headers.get("location"), "http://x/login");
  assert.equal(b.headers.getSetCookie().length, 1);
  assert.equal(b.headers.get("x-trace"), "1");
  const c = await handler(new Request("http://x/c?/login", { method: "POST", headers: { origin: "http://x" } }));
  assert.equal(c.status, 303);
  assert.equal(c.headers.getSetCookie().length, 1);
  const api = await handler(new Request("http://x/api", { method: "POST", headers: { origin: "http://x", "content-type": "application/json" }, body: "{}" }));
  assert.deepEqual(await api.json(), { ok: true });
  assert.equal(api.headers.getSetCookie()[0]?.split(";")[0], "sid=abc");
  assert.equal(api.headers.get("x-trace"), "1");
});

test("SEC6: actions resolve own function members only", async () => {
  const log: string[] = [];
  const handler = handlerOf([route({ actions: { save: () => ({ ok: 1 }) } })], log);
  for (const name of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    const response = await handler(new Request(`http://x/x?/${name}`, { method: "POST", headers: { origin: "http://x" } }));
    assert.equal(response.status, 404, name);
  }
  assert.deepEqual(log, [], "no 500 reports");
  assert.equal((await handler(new Request("http://x/x?/save", { method: "POST", headers: { origin: "http://x" } }))).status, 200);
});

test("SEC7: data requests never get a non-http(s) Response Location as { redirect }", async () => {
  const to = (location: string) => handlerOf([route({ guard: () => new Response(null, { status: 302, headers: { location } }) })]);
  const json = (location: string) => to(location)(new Request("http://x/x?_rivet=data")).then(decode);
  assert.deepEqual(await json("javascript:alert(1)"), { reload: true });
  assert.deepEqual(await json("//evil.test/x"), { reload: true });
  assert.deepEqual(await json("/a\\b"), { reload: true });
  assert.deepEqual(await json("/login"), { redirect: "/login", status: 302 });
  assert.deepEqual(await json("https://sso.test/auth"), { redirect: "https://sso.test/auth", status: 302 });
});

test("SEC8: cookie attributes are validated", async () => {
  const set = async (options: object, name = "a", value = "1") => {
    let thrown: unknown;
    const handler = handlerOf([
      route({
        guard: (e) => {
          try {
            e.cookies.set(name, value, options);
          } catch (error) {
            thrown = error;
          }
        },
      }),
    ]);
    const response = await handler(new Request("http://x/x"));
    return thrown ? (thrown as Error).message : response.headers.getSetCookie()[0];
  };
  assert.match(await set({ path: "/; Domain=evil.test" }), /Invalid cookie path/);
  assert.match(await set({ domain: "a.test; SameSite=None" }), /Invalid cookie domain/);
  assert.match(await set({ maxAge: NaN }), /Invalid cookie maxAge/);
  assert.match(await set({ expires: new Date("nope") }), /Invalid cookie expires/);
  assert.match(await set({ sameSite: "none", secure: false }), /requires secure/);
  assert.match(await set({ secure: false }, "__Host-id"), /prefix requires secure/);
  assert.match(await set({ path: "/app" }, "__Host-id"), /__Host- requires path/);
  assert.match(await set({}, "a", "x".repeat(5000)), /larger than 4096/);
  assert.equal(
    await set({ domain: ".shop.test", path: "/app", maxAge: 60.7, sameSite: "none" }),
    "a=1; Path=/app; Domain=.shop.test; Max-Age=60; HttpOnly; Secure; SameSite=None",
  );
});

test("C12: loaders of data requests see the page URL's query exactly as sent", async () => {
  const seen: string[] = [];
  const handler = handlerOf([route({ load: (e) => (seen.push(e.url.search), null) })]);
  await handler(new Request("http://x/x?flag&q=a%20b"));
  await handler(new Request("http://x/x?flag&q=a%20b&_rivet=data&_rivet_keep=%2F"));
  await handler(new Request("http://x/x?_rivet=data"));
  assert.deepEqual(seen, ["?flag&q=a%20b", "?flag&q=a%20b", ""]);
  assert.equal(withoutRivet("?_rivet=data&a=1&_rivet_keep=/,."), "?a=1");
  assert.equal(withoutRivet("?a=%2B+b"), "?a=%2B+b");
});

test("SEC5: dev hints once when a layout loader acts as access control", async () => {
  const warned: string[] = [];
  const warn = console.warn;
  console.warn = (message: string) => warned.push(message);
  try {
    const handler = handlerOf(
      [
        {
          id: "secret",
          pattern: "/secret",
          page: true,
          keys: ["/admin"],
          layouts: [mod({ load: () => Promise.reject(deny(401)) })],
          server: mod({ load: () => "page secret" }),
        },
      ],
      [],
      true,
    );
    assert.equal((await handler(new Request("http://x/secret?_rivet=data"))).status, 401);
    await handler(new Request("http://x/secret?_rivet=data"));
    assert.equal(warned.length, 1);
    assert.match(warned[0]!, /layout "\/admin".*`guard\(…\)` export/);
  } finally {
    console.warn = warn;
  }
});

// Minimal generated entry: one page whose factory fails (or not) at a given point.
function appWith(factory: () => unknown, log: unknown[] = []) {
  const entry = {
    routes: [{ id: "index", pattern: "/", page: true, layouts: [mod({ load: () => "layout" })], server: mod({ load: () => "page" }), keys: ["/"] }],
    universal: {},
    page: (input: { error?: { status: number; message: string } }) => {
      const error = input.error;
      return error ? () => `error page ${error.status} ${error.message}` : factory;
    },
    document: () => ({ start: "<!doctype html><body>", end: "</body>" }),
  } as unknown as GeneratedEntry;
  return createApp({ entry, csp: false, onError: (error, _request, info) => log.push([String(error), info?.phase, info?.digest]) });
}

test("U7: a render failure before the first byte answers with the error page, 500 and a digest", async () => {
  const log: unknown[][] = [];
  const handler = appWith(() => {
    throw new Error("boom");
  }, log);
  const response = await handler(new Request("http://x/"), { nonce: "n" });
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.match(body, /error page 500 Internal Server Error \(digest [\da-f]{10}\)/);
  assert.equal(log.length, 1);
  assert.equal(log[0]![1], "render");
  assert.ok(body.includes(String(log[0]![2])));
  // Synchronous pages still answer synchronously-rendered, in one piece.
  const ok = await appWith(() => html("<p>fine</p>"))(new Request("http://x/"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "<!doctype html><body><p>fine</p></body>");
});

test("a route's first render loads its lazy page module first: a page that throws in render answers 500 + error page", async () => {
  const log: unknown[][] = [];
  const importer = () =>
    Promise.resolve({
      default: (): never => {
        throw new Error("page boom");
      },
    });
  const Page = lazyComponent(importer);
  const entry = {
    routes: [{ id: "index", pattern: "/", page: true, layouts: [], server: mod({ load: () => "page" }) }],
    universal: {},
    loadPage: () => preloadPage(Page, importer),
    page: (input: { error?: { status: number; message: string } }) => {
      const error = input.error;
      return error ? () => `error page ${error.status}` : () => Page({});
    },
    document: () => ({ start: "<!doctype html><body>", end: "</body>" }),
  } as unknown as GeneratedEntry;
  const handler = createApp({ entry, csp: false, onError: (error, _request, info) => log.push([String(error), info?.phase]) });
  // First request (module not loaded yet) and a later one answer alike.
  for (let i = 0; i < 2; i++) {
    const response = await handler(new Request("http://x/"));
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "<!doctype html><body>error page 500</body>");
  }
  assert.deepEqual(log, [
    ["Error: page boom", "render"],
    ["Error: page boom", "render"],
  ]);
});

test("U7: a failure after the shell streamed ends the document cleanly with a nonce'd failure marker", async () => {
  const log: unknown[][] = [];
  let fail!: (error: Error) => void;
  const later = new Promise<string>((_, reject) => (fail = reject));
  const handler = appWith(() => [html("<p>shell</p>"), later], log);
  const response = await handler(new Request("http://x/"), { nonce: "abc" });
  assert.equal(response.status, 200);
  const text = response.text();
  await new Promise((done) => setTimeout(done, 5));
  fail(new Error("late"));
  const body = await text;
  assert.match(
    body,
    /^<!doctype html><body><p>shell<\/p><script nonce="abc">document\.dispatchEvent\(new CustomEvent\("rivet:resume-error",\{detail:\{"phase":"render","digest":"[\da-f]+","error":"Render failed \(digest [\da-f]+\)"\}\}\)\)<\/script><\/body>$/,
  );
  assert.equal(log.length, 1);
  assert.deepEqual(log[0]!.slice(0, 2), ["Error: late", "render"]);
  assert.ok(body.includes(String(log[0]![2])));
});

test("U7: renderDocument rejects for a failure before any byte of an async page; renderPage keeps answering", async () => {
  const shell = { document: () => ({ start: "<a>", end: "</a>" }) };
  const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
  // Held document start (kit head): nothing is written until the hold releases.
  const held = { ...shell, hold: { head: () => undefined } };
  const failing = () => [Promise.reject(new Error("data"))] as never;
  await assert.rejects(Promise.resolve(renderDocument(failing, input, held, { status: 200, headers: new Headers() })), /data/);
  const eager = renderPage(failing, input, held, { status: 200, headers: new Headers() });
  assert.ok(eager instanceof Response);
  await assert.rejects(eager.text(), /data/);
});

test("U7: an aborted request settles a deferred render that had not answered yet", async () => {
  const controller = new AbortController();
  const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
  const held = { document: () => ({ start: "<a>", end: "</a>" }), hold: { head: () => undefined }, signal: controller.signal };
  const pending = renderDocument(() => [new Promise(() => {})] as never, input, held, { status: 200, headers: new Headers() });
  assert.ok(pending instanceof Promise);
  controller.abort(new Error("gone"));
  await assert.rejects(pending);
});
