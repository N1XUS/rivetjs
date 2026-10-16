// Shared seams (review round 2, X3/X4): one cookie parser, one CSP nonce generator, one HTML escaper,
// one trailing-slash policy, and the typed JSON answer of enhanced actions.
import { test, expectTypeOf } from "vitest";
import assert from "node:assert/strict";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { escapeAttribute, escapeText } from "@rivetjs/runtime/escape";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";
import { fail, parseCookies, slashPath, TRAILING_SLASH, type ActionAnswer, type ActionResult, type TrailingSlash } from "../index.ts";
import type { GeneratedEntry } from "../server/app.ts";
import { headTags } from "../shared/head.ts";
import { nonce as sharedNonce } from "../shared/nonce.ts";
import { nonce } from "../adapters/fetch.ts";
import { shellHTML } from "../adapters/csr.ts";

test("parseCookies: trimmed names/values, one pair of quotes removed, bad percent-encoding kept, first name wins", () => {
  const jar = parseCookies(' a = 1 ; b="two words" ; c=%E0%A4%A ; d=%20x; a=2; =skip; flag; e=x=y');
  assert.deepEqual(Object.fromEntries(jar), { a: "1", b: "two words", c: "%E0%A4%A", d: " x", e: "x=y" });
  assert.equal(parseCookies(null).size, 0);
  assert.equal(parseCookies(undefined).size, 0);
  assert.equal(parseCookies("").size, 0);
});

test("event.cookies reads through the shared parser", async () => {
  let seen: unknown;
  const server: ServerModule = { load: ({ cookies }) => ((seen = [cookies.get("q"), cookies.get("bad")]), null) };
  const routes: AppRoute[] = [{ id: "p", pattern: "/p", page: true, layouts: [], server: () => Promise.resolve(server) }];
  const handler = createHandler({ routes, render: () => new Response("ok"), onError: () => {} });
  await handler(new Request("http://x/p", { headers: { cookie: 'q="v 1"; bad=%zz' } }));
  assert.deepEqual(seen, ["v 1", "%zz"]);
});

test("CSP nonce: one generator (fetch adapter re-exports it; node adapter calls it), 128-bit base64, fresh each call", () => {
  assert.equal(nonce, sharedNonce);
  const values = new Set(Array.from({ length: 64 }, () => nonce()));
  assert.equal(values.size, 64);
  for (const value of values) assert.match(value, /^[A-Za-z0-9+/]{22}==$/);
});

test("head tags and the CSR shell escape with the runtime escaper (both quote styles in attributes)", () => {
  const html = headTags({ title: `<T> & 'q' "d"`, meta: [{ name: "description", content: `it's "x" <b>` }] });
  assert.ok(html.includes(`<title>&lt;T&gt; &amp; 'q' "d"</title>`), html);
  assert.ok(html.includes(`content="it&#39;s &quot;x&quot; &lt;b&gt;"`), html);
  assert.equal(escapeAttribute(`'"<>&`), "&#39;&quot;&lt;&gt;&amp;");
  assert.equal(escapeText(`'"<>&`), `'"&lt;&gt;&amp;`);
  const shell = shellHTML(() => ({ start: "<html><head></head><body>", end: "</body></html>" }), { script: `/a.js?x=1&y='2'"` });
  assert.ok(shell.includes(`<script type="module" src="/a.js?x=1&amp;y=&#39;2&#39;&quot;"></script>`), shell);
});

test("trailing slash: one policy type; slashPath leaves file paths unslashed under always", () => {
  expectTypeOf<NonNullable<GeneratedEntry["trailingSlash"]>>().toEqualTypeOf<Exclude<TrailingSlash, "ignore">>();
  assert.equal(TRAILING_SLASH, "ignore");
  assert.equal(slashPath("/a", "always"), "/a/");
  assert.equal(slashPath("/feed.xml", "always"), "/feed.xml");
  assert.equal(slashPath("/a/", "never"), "/a");
  assert.equal(slashPath("/a/", "ignore"), "/a/");
});

test("enhanced action answers are ActionAnswer values (action / fail / error)", async () => {
  const server: ServerModule = {
    actions: {
      save: () => ({ ok: true }),
      bad: () => fail(400, { issue: "x" }),
    },
  };
  const routes: AppRoute[] = [{ id: "form", pattern: "/form", page: true, layouts: [], server: () => Promise.resolve(server) }];
  const handler = createHandler({
    routes,
    render: (input: RenderInput) => new Response(String(input.status)),
    renderError: ({ status }) => new Response("error", { status }),
    onError: () => {},
  });
  const post = async (name: string): Promise<ActionAnswer> => {
    const response = await handler(
      new Request("http://x/form?/" + name, {
        method: "POST",
        body: new URLSearchParams({ a: "1" }),
        headers: { origin: "http://x", accept: "application/json" },
      }),
    );
    const { t, r } = JSON.parse(await response.text()) as { t: unknown[]; r: number };
    return createDecoder(t).get(r) as ActionAnswer;
  };
  assert.deepEqual(await post("save"), { action: { name: "save", result: { ok: true } } });
  assert.deepEqual(await post("bad"), { action: { name: "bad", result: { issue: "x" }, status: 400 } });
  assert.deepEqual(await post("missing"), { error: { status: 404, message: 'Unknown action "missing"' } });
  expectTypeOf<NonNullable<ActionAnswer["action"]>>().toEqualTypeOf<ActionResult>();
});
