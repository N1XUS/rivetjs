import { test } from "vitest";
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { serve } from "../adapters/node.ts";
import { createHandler, type AppHandler } from "../server/handler.ts";
import { withRouteRules } from "../server/route-cache.ts";

const cached = (handler: AppHandler) =>
  withRouteRules(handler, { "/**": { cache: { maxAge: 60, cookies: true } } }, { policy: () => false, hash: null }, "", { origin: "http://local.test" });
const html = (text: string) => new Response(`<p>${text}</p>`, { headers: { "content-type": "text/html" } });

test("anonymous cache fills cannot share identity read from the original Node platform request", async () => {
  const handler = createHandler({
    routes: [
      {
        id: "profile",
        pattern: "/profile",
        page: true,
        layouts: [],
        server: async () => ({
          load: (event) => {
            const node = event.platform.node as { req: IncomingMessage };
            return node.req.headers.cookie ?? "anonymous";
          },
        }),
      },
    ],
    render: (input) => html(String(input.data[0])),
  });
  const server = await serve({ handler: cached(handler), origin: "http://local.test", port: 0, compress: false, health: false });
  try {
    const own = await fetch(server.url + "/profile", { headers: { cookie: "session=alice" } });
    assert.equal(await own.text(), "<p>session=alice</p>", "raw platform access remains usable by its own request");
    const foreign = await fetch(server.url + "/profile");
    assert.equal(await foreign.text(), "<p>anonymous</p>", "an anonymous visitor must not receive Alice's raw-request identity");
    const bob = await fetch(server.url + "/profile", { headers: { cookie: "session=bob" } });
    assert.equal(await bob.text(), "<p>session=bob</p>");
    assert.equal(foreign.headers.get("x-rivet-cache"), null);
  } finally {
    await server.close();
  }
});

test("ordinary Node pages still cache when they do not read platform facts", async () => {
  let loads = 0;
  const handler = createHandler({
    routes: [{ id: "public", pattern: "/public", page: true, layouts: [], server: async () => ({ load: () => ++loads }) }],
    render: (input) => html(String(input.data[0])),
  });
  const server = await serve({ handler: cached(handler), origin: "http://local.test", port: 0, compress: false, health: false });
  try {
    const first = await fetch(server.url + "/public");
    assert.equal(await first.text(), "<p>1</p>");
    const next = await fetch(server.url + "/public");
    assert.equal(await next.text(), "<p>1</p>");
    assert.equal(next.headers.get("x-rivet-cache"), "HIT");
    assert.equal(loads, 1);
  } finally {
    await server.close();
  }
});

test("request platform facts bypass sharing while static environment bindings remain cacheable", async () => {
  const privatePage = cached(async (_request, context) => html(String((context?.platform?.ctx as { identity: string }).identity)));
  const request = () => new Request("http://local.test/profile");
  const alice = await privatePage(request(), { platform: { ctx: { identity: "alice" } } });
  assert.equal(await alice.text(), "<p>alice</p>");
  const bob = await privatePage(request(), { platform: { ctx: { identity: "bob" } } });
  assert.equal(await bob.text(), "<p>bob</p>");
  assert.equal(bob.headers.get("x-rivet-cache"), null);
  let calls = 0;
  const publicPage = cached(async (_request, context) => (calls++, html(String((context?.platform?.env as { binding: string }).binding))));
  const env = { binding: "public environment" };
  await (await publicPage(request(), { platform: { env } })).text();
  const hit = await publicPage(request(), { platform: { env } });
  assert.equal(await hit.text(), "<p>public environment</p>");
  assert.equal(hit.headers.get("x-rivet-cache"), "HIT");
  assert.equal(calls, 1);
});

test("late streamed platform reads cannot become a shared page or leak to an in-flight waiter", async () => {
  let release!: () => void;
  let entered!: () => void;
  const waiting = new Promise<void>((done) => (entered = done));
  const gate = new Promise<void>((done) => (release = done));
  let calls = 0;
  const page = cached(async (_request, context) => {
    const first = ++calls === 1;
    return new Response(
      new ReadableStream(
        {
          async pull(controller) {
            if (first) {
              entered();
              await gate;
            }
            const identity = (context?.platform?.ctx as { identity: string }).identity;
            controller.enqueue(new TextEncoder().encode(`<p>${identity}</p>`));
            controller.close();
          },
        },
        { highWaterMark: 0 },
      ),
      { headers: { "content-type": "text/html" } },
    );
  });
  const request = () => new Request("http://local.test/profile");
  const alice = page(request(), { platform: { ctx: { identity: "alice" } } });
  await waiting;
  const bob = page(request(), { platform: { ctx: { identity: "bob" } } });
  release();
  const [a, b] = await Promise.all([alice, bob]);
  assert.equal(await a.text(), "<p>alice</p>");
  assert.equal(await b.text(), "<p>bob</p>");
  const next = await page(request(), { platform: { ctx: { identity: "anonymous" } } });
  assert.equal(await next.text(), "<p>anonymous</p>");
});

test("reflection cannot read unkeyed platform facts without invalidating sharing", async () => {
  const cases = [
    {
      platform: (identity: string) => ({ ctx: { identity } }),
      read: (platform: object) => Object.getOwnPropertyDescriptor(platform, "ctx")!.value.identity as string,
    },
    {
      platform: (identity: string) => ({ [identity]: true }),
      read: (platform: object) => Object.keys(platform)[0]!,
    },
    {
      platform: (identity: string) => (identity === "alpha" ? { signed: true } : {}),
      read: (platform: object) => ("signed" in platform ? "alpha" : "beta"),
    },
    {
      platform: (identity: string) => Object.create({ identity }) as Record<string, unknown>,
      read: (platform: object) => (Object.getPrototypeOf(platform) as { identity: string }).identity,
    },
  ];
  for (const scenario of cases) {
    const page = cached(async (_request, context) => html(scenario.read(context!.platform!)));
    const request = () => new Request("http://local.test/profile");
    const alpha = await page(request(), { platform: scenario.platform("alpha") });
    assert.equal(await alpha.text(), "<p>alpha</p>");
    const beta = await page(request(), { platform: scenario.platform("beta") });
    assert.equal(await beta.text(), "<p>beta</p>");
  }
});
