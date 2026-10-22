// Node adapter + handler gaps from the alpha.1 report (EXT-B): header append (multiple `Set-Cookie` / `Link`) through
// to the Node response (15), the raw Node request as `event.platform.node` (13), compression levels per codec (14), health
// endpoint opt-out (17), removable / overridable default security headers (18).
// Run: `npx vitest run --project router libs/router/tests/node-request.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../server/handler.ts";
import { serve, type ServeOptions } from "../adapters/node.ts";

const mod = (module: ServerModule) => () => Promise.resolve(module);
const render = (input: RenderInput) => new Response(`page ${input.route.id}`, { status: input.status, headers: input.headers });
const app = (routes: AppRoute[]) => createHandler({ routes, render });
/** Raw response head (header lines as sent), for headers `fetch` would merge. */
const raw = (url: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; lines: string[]; body: string }> =>
  new Promise((done, fail) => {
    const req = httpRequest(url + path, { headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const lines: string[] = [];
        for (let i = 0; i < res.rawHeaders.length; i += 2) lines.push(res.rawHeaders[i]!.toLowerCase() + ": " + res.rawHeaders[i + 1]);
        done({ status: res.statusCode!, lines, body });
      });
    });
    req.on("error", fail);
    req.end();
  });
const serving = async (handler: ServeOptions["handler"], extra: Partial<ServeOptions> = {}) => serve({ handler, port: 0, ...extra });

test("event.appendHeader: several Set-Cookie / Link values reach the Node response as separate cookies", async () => {
  const handler = app([
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [mod({ onRequest: (e) => void e.appendHeader("set-cookie", "a=1; Path=/") })],
      server: mod({
        load: (e) => {
          e.appendHeader("set-cookie", "b=2; Path=/; HttpOnly");
          e.cookies.set("c", "3");
          e.appendHeader("link", "</a.css>; rel=preload; as=style");
          e.appendHeader("link", "</b.css>; rel=preload; as=style");
          return 1;
        },
      }),
    },
    {
      id: "raw",
      pattern: "/raw",
      page: true,
      layouts: [],
      server: mod({
        onGet: (e) => {
          e.appendHeader("set-cookie", "event=1");
          const headers = new Headers();
          headers.append("set-cookie", "x=1");
          headers.append("set-cookie", "y=2");
          return new Response("raw", { headers });
        },
      }),
    },
  ]);
  const server = await serving(handler);
  try {
    const page = await raw(server.url, "/p");
    const cookies = page.lines.filter((line) => line.startsWith("set-cookie: "));
    assert.deepEqual(
      cookies.map((line) => line.slice(12).split(";")[0]),
      ["a=1", "b=2", "c=3"],
    );
    assert.ok(page.lines.includes("link: </a.css>; rel=preload; as=style, </b.css>; rel=preload; as=style"), page.lines.join("\n"));
    assert.ok(
      page.lines.some((line) => line.startsWith("cache-control: ") && line.includes("private")),
      "a cookie makes the page private",
    );
    const own = await raw(server.url, "/raw");
    assert.deepEqual(
      own.lines.filter((line) => line.startsWith("set-cookie: ")).map((line) => line.slice(12)),
      ["x=1", "y=2", "event=1"],
    );
  } finally {
    await server.close();
  }
});

test("event.platform.node: the raw Node request (original target, repeated headers as sent, client port)", async () => {
  let seen: { url?: string; repeated?: string[]; port?: number; joined?: string | null } = {};
  const handler = app([
    {
      id: "p",
      pattern: "/p",
      page: true,
      layouts: [],
      server: mod({
        load: (e) => {
          const node = e.platform.node as import("../adapters/node.ts").NodePlatform;
          const raw = node.req.rawHeaders;
          seen = {
            url: node.req.url,
            repeated: raw.flatMap((name, i) => (i % 2 === 0 && name.toLowerCase() === "x-tag" ? [raw[i + 1]!] : [])),
            port: node.req.socket.remotePort,
            joined: e.request.headers.get("x-tag"),
          };
          return 1;
        },
      }),
    },
  ]);
  const server = await serving(handler);
  try {
    await new Promise<void>((done, fail) => {
      const req = httpRequest(server.url + "/p?a=1&a=2", (res) => {
        res.resume();
        res.on("end", done);
      });
      req.setHeader("x-tag", ["one", "two"]); // two header lines
      req.on("error", fail);
      req.end();
    });
    assert.equal(seen.url, "/p?a=1&a=2");
    assert.deepEqual(seen.repeated, ["one", "two"]);
    assert.equal(seen.joined, "one, two"); // the web Request merges them
    assert.ok(typeof seen.port === "number" && seen.port > 0);
  } finally {
    await server.close();
  }
});

test("compress levels per codec: zstd / br / gzip; defaults unchanged; bad levels throw", async () => {
  const text = Array.from({ length: 4000 }, (_, i) => `<tr><td>row ${i}</td><td>${(i * 7919) % 1000}</td></tr>`).join("");
  const handler = () => new Response(text, { headers: { "content-type": "text/html; charset=utf-8" } });
  const size = async (compress: ServeOptions["compress"], encoding: string) => {
    const server = await serving(handler, { compress });
    try {
      const answer = await raw(server.url, "/", { "accept-encoding": encoding });
      assert.ok(answer.lines.includes("content-encoding: " + encoding), answer.lines.join("\n"));
      return Number(answer.lines.find((line) => line.startsWith("content-length: "))!.slice(16));
    } finally {
      await server.close();
    }
  };
  // Faster levels give larger bodies than the defaults (zstd 3 / br 4 / gzip 6), higher ones smaller.
  assert.ok((await size({ zstd: -5 }, "zstd")) > (await size(true, "zstd")));
  assert.ok((await size({ br: 0 }, "br")) > (await size(true, "br")));
  assert.ok((await size({ br: 9 }, "br")) < (await size(true, "br")));
  assert.ok((await size({ gzip: 1 }, "gzip")) > (await size(true, "gzip")));
  await assert.rejects(serve({ handler, port: 0, compress: { br: 12 } }), /an integer from 0 to 11/);
  await assert.rejects(serve({ handler, port: 0, compress: { gzip: 0 } }), /an integer from 1 to 9/);
});

test("health endpoints: defaults, own paths, off (the app gets the path)", async () => {
  const handler = (request: Request) => new Response("app " + new URL(request.url).pathname);
  const defaults = await serving(handler);
  const moved = await serving(handler, { health: { live: "/_live", ready: false } });
  const off = await serving(handler, { health: false });
  try {
    assert.equal(await (await fetch(defaults.url + "/healthz")).text(), "ok");
    assert.equal(await (await fetch(defaults.url + "/readyz")).text(), "ready");
    assert.equal(await (await fetch(moved.url + "/_live")).text(), "ok");
    assert.equal(await (await fetch(moved.url + "/healthz")).text(), "app /healthz");
    assert.equal(await (await fetch(moved.url + "/readyz")).text(), "app /readyz");
    assert.equal(await (await fetch(off.url + "/healthz")).text(), "app /healthz");
    assert.equal(await (await fetch(off.url + "/readyz")).text(), "app /readyz");
  } finally {
    await Promise.all([defaults.close(), moved.close(), off.close()]);
  }
  await assert.rejects(serve({ handler, port: 0, health: { live: "healthz" } }), /starting with "\/"/);
});

test("default security headers: kept by default, replaced by name in any case, removed with null; a route's own wins", async () => {
  const handler = (request: Request) =>
    new Response("x", new URL(request.url).pathname === "/own" ? { headers: { "referrer-policy": "no-referrer" } } : undefined);
  const plain = await serving(handler);
  const tuned = await serving(handler, { headers: { "referrer-policy": "same-origin", "X-Content-Type-Options": null } });
  try {
    const a = await raw(plain.url, "/");
    assert.ok(a.lines.includes("x-content-type-options: nosniff"));
    assert.ok(a.lines.includes("referrer-policy: strict-origin-when-cross-origin"));
    const b = await raw(tuned.url, "/");
    assert.ok(!b.lines.some((line) => line.startsWith("x-content-type-options")), b.lines.join("\n"));
    assert.deepEqual(
      b.lines.filter((line) => line.startsWith("referrer-policy")),
      ["referrer-policy: same-origin"],
    );
    const own = await raw(tuned.url, "/own");
    assert.deepEqual(
      own.lines.filter((line) => line.startsWith("referrer-policy")),
      ["referrer-policy: no-referrer"],
    );
  } finally {
    await Promise.all([plain.close(), tuned.close()]);
  }
});
