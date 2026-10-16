// Early hints (`createApp({ earlyHints })`, `server/early-hints.ts`): Link values per route (linked stylesheets, learned
// build-asset font preloads only — never preconnects / URLs from a visitor's render —, `links`, `runtime`), the `Link` header on page responses, and the node adapter's
// `103 Early Hints` written before guards and loaders finish.
// Run: `npx vitest run --project router libs/router/tests/early-hints.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { createApp } from "../server/app.ts";
import { headLinks, styleLinks } from "../server/early-hints.ts";
import { serve } from "../adapters/node.ts";

const head = {
  links: [
    { rel: "preload", as: "font", type: "font/woff2", crossorigin: "anonymous" as const, href: "/assets/f.woff2" },
    { rel: "preload", as: "font", href: "/public-font.woff2" },
    { rel: "preconnect", href: "https://cdn.example" },
    { rel: "preload", as: "image", href: "/hero.jpg" },
    { rel: "stylesheet", href: "/x.css" },
    { rel: "preload", as: "font", href: "/bad>.woff2" },
  ],
};
const entry = (load?: () => Promise<unknown>, guard?: () => Promise<unknown>) => ({
  routes: [
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [],
      ...(load || guard ? { server: async () => ({ ...(load ? { load } : {}), ...(guard ? { guard } : {}) }) } : {}),
    },
    { id: "api", pattern: "/api", page: false, layouts: [], server: async () => ({ onGet: () => new Response("ok") }) },
  ],
  universal: { p: async () => [[0, { head }]] },
  page: () => () => "page",
  document: () => ({ start: "<!doctype html><html><head></head><body>", end: "</body></html>" }),
});

test("styleLinks / headLinks: linked build-asset sheets only, asset font preloads only, unsafe URLs dropped", () => {
  // Not inlined, below <base>/assets/ (immutable: Chromium refetches a revalidated preload), header-safe.
  assert.deepEqual(styleLinks(["/assets/a.css", "/assets/b.css", "/assets/c d.css", "/site.css"], { "/assets/b.css": "p{}" }), [
    "</assets/a.css>; rel=preload; as=style",
  ]);
  assert.deepEqual(styleLinks(["/assets/a.css", "/app/assets/a.css"], undefined, "/app"), ["</app/assets/a.css>; rel=preload; as=style"]);
  // A preconnect in a head may come from loader data (a tenant's host): never learned, so never sent to the next visitor.
  assert.deepEqual(headLinks(head), ["</assets/f.woff2>; rel=preload; as=font; type=font/woff2; crossorigin"]);
  assert.deepEqual(headLinks(undefined), []);
});

test("createApp earlyHints: Link header on pages (stylesheets, learned head links, links, runtime); off by default and in dev", async () => {
  const config = { styles: ["/assets/app.css"], routeStyles: { p: ["/assets/route.css"] }, csp: false as const };
  const app = createApp({
    entry: entry() as never,
    ...config,
    manifest: { runtime: "/assets/resume-entry.js", symbols: {} },
    earlyHints: { runtime: true, links: ["<https://api.example>; rel=preconnect"] },
  });
  const link = (await app(new Request("http://x/p"))).headers.get("link");
  assert.equal(
    link,
    "</assets/app.css>; rel=preload; as=style, </assets/route.css>; rel=preload; as=style, </assets/f.woff2>; rel=preload; as=font; type=font/woff2; crossorigin, " +
      "<https://api.example>; rel=preconnect, </assets/resume-entry.js>; rel=modulepreload",
  );
  // Endpoints and data requests get none.
  assert.equal((await app(new Request("http://x/api"))).headers.get("link"), null);
  assert.equal((await createApp({ entry: entry() as never, ...config })(new Request("http://x/p"))).headers.get("link"), null);
  assert.equal((await createApp({ entry: entry() as never, ...config, dev: true, earlyHints: true })(new Request("http://x/p"))).headers.get("link"), null);
});

test("node adapter: 103 Early Hints go out while a slow loader still runs; data requests get none", async () => {
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  const order: string[] = [];
  const app = createApp({
    entry: entry(
      async () => (order.push("loader"), await gate, {}),
      async () => void order.push("guard"),
    ) as never,
    styles: ["/assets/app.css"],
    csp: false,
    earlyHints: true,
  });
  const serving = await serve({ handler: app, port: 0, earlyHints: true });
  try {
    const url = new URL(serving.url);
    const hints: string[] = [];
    const done = new Promise<number>((resolve, reject) => {
      const req = httpRequest({ host: url.hostname, port: url.port, path: "/p" }, (res) => (res.resume(), res.on("end", () => resolve(res.statusCode!))));
      req.on("information", (info) => {
        if (info.statusCode === 103) hints.push(String(info.headers.link));
        // The loader waits for the hint: the page completes only when the 103 came first.
        release();
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(await done, 200);
    assert.deepEqual(hints, ["</assets/app.css>; rel=preload; as=style"]);
    assert.deepEqual(order, ["guard", "loader"]);
    // Data requests: no 103 (the loader would wait forever otherwise — the gate is already open, so just check none came).
    const data = await new Promise<number>((resolve) => {
      let early = 0;
      const req = httpRequest({ host: url.hostname, port: url.port, path: "/p?_rivet=data" }, (res) => (res.resume(), res.on("end", () => resolve(early))));
      req.on("information", () => early++);
      req.end();
    });
    assert.equal(data, 0);
  } finally {
    release();
    await serving.close();
  }
});
