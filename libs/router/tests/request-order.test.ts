// EXT-B item 3 (alpha.1 report): `onRequest(…)` runs for every method before the method check, and `Allow` lists
// only the methods a page really handles (GET / HEAD; POST with `actions(…)` or `onPost(…)`; PUT / PATCH / DELETE
// with their handlers).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const render = (input: RenderInput) => new Response(`page ${input.route.id}`, { status: input.status, headers: input.headers });
const app = (routes: AppRoute[]) =>
  createHandler({ routes, render, renderError: ({ status, message, headers }) => new Response(`error ${status} ${message}`, { status, headers }) });
const same = { origin: "http://x" };

test("a layout's onRequest answers POST to a page without actions (before the 405)", async () => {
  const log: string[] = [];
  const handler = app([
    {
      id: "feed",
      pattern: "/feed",
      page: true,
      layouts: [
        mod({ onRequest: (e) => (log.push("layout " + e.request.method), e.request.method === "POST" ? new Response("handled", { status: 202 }) : undefined) }),
      ],
      server: mod({ load: () => 1 }),
    },
  ]);
  const post = await handler(new Request("http://x/feed", { method: "POST", headers: same, body: "a=1" }));
  assert.equal(post.status, 202);
  assert.equal(await post.text(), "handled");
  assert.deepEqual(log, ["layout POST"]);
});

test("onRequest runs for methods the router does not route (TRACE-like), then 405", async () => {
  const log: string[] = [];
  const handler = app([{ id: "p", pattern: "/p", page: true, layouts: [mod({ onRequest: (e) => void log.push(e.request.method) })], server: mod({}) }]);
  const res = await handler(new Request("http://x/p", { method: "PROPFIND", headers: same }));
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET, HEAD");
  assert.deepEqual(log, ["PROPFIND"]);
});

test("Allow never lists a method the 405 refuses: POST only with actions(…) / onPost(…)", async () => {
  const handler = app([
    { id: "plain", pattern: "/plain", page: true, layouts: [], server: mod({ load: () => 1 }) },
    { id: "form", pattern: "/form", page: true, layouts: [], server: mod({ actions: { save: () => ({ ok: true }) } }) },
    { id: "put", pattern: "/put", page: true, layouts: [], server: mod({ onPut: () => new Response("put") }) },
  ]);
  const plain = await handler(new Request("http://x/plain", { method: "POST", headers: same }));
  assert.equal(plain.status, 405);
  assert.equal(plain.headers.get("allow"), "GET, HEAD");
  const options = await handler(new Request("http://x/plain", { method: "OPTIONS" }));
  assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
  const put = await handler(new Request("http://x/put", { method: "DELETE", headers: same }));
  assert.equal(put.status, 405);
  assert.equal(put.headers.get("allow"), "GET, HEAD, PUT");
  // A page with actions takes POST `?/name`; a POST without a name is a bad request, not a refused method.
  const bare = await handler(new Request("http://x/form", { method: "POST", headers: same }));
  assert.equal(bare.status, 400);
  const del = await handler(new Request("http://x/form", { method: "DELETE", headers: same }));
  assert.equal(del.status, 405);
  assert.equal(del.headers.get("allow"), "GET, HEAD, POST");
});

test("CSRF still runs before onRequest for unsafe methods", async () => {
  const log: string[] = [];
  const handler = app([{ id: "p", pattern: "/p", page: true, layouts: [mod({ onRequest: () => void log.push("x") })], server: mod({}) }]);
  const res = await handler(new Request("http://x/p", { method: "POST", headers: { origin: "https://evil.example" } }));
  assert.equal(res.status, 403);
  assert.deepEqual(log, []);
});
