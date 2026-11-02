// The Bun adapter (`adapters/bun.ts`) over a fake `globalThis.Bun`: wiring only (`deploy.test.ts` runs the real one when
// `bun` is installed, so CI without Bun still covers this). The app itself is `createFetch`, covered elsewhere.
import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GeneratedEntry } from "../server/app.ts";
import type { BuildManifests } from "../adapters/assemble.ts";

const appCalls: unknown[][] = [];
vi.mock("../adapters/fetch.ts", () => ({
  createFetch: (_entry: unknown, _build: unknown, options: unknown) => ({
    options,
    fetch: (...args: unknown[]) => (appCalls.push(args), new Response("app")),
  }),
}));

const { start } = await import("../adapters/bun.ts");
const entry = {} as GeneratedEntry;
const build = { clients: [] } as unknown as BuildManifests;

function fakeBun() {
  const state: { options?: { port: number; hostname: string; fetch(request: Request, server: unknown): Response | Promise<Response> } } = {};
  const server = { port: 4500, hostname: "127.0.0.1", url: new URL("http://127.0.0.1:4500/"), requestIP: () => null, stop: () => {} };
  (globalThis as { Bun?: unknown }).Bun = {
    serve: (options: NonNullable<typeof state.options>) => ((state.options = options), server),
    file: (path: string) => new Blob(["file:" + path]),
  };
  return { state, server };
}

afterEach(() => {
  delete (globalThis as { Bun?: unknown }).Bun;
  appCalls.length = 0;
  vi.restoreAllMocks();
});

test("bun: outside Bun it says how to run the entry", () => {
  assert.throws(() => start(entry, build), /runs under Bun/);
});

test("bun: serves listen options; the app receives the request and the Bun server", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const { state, server } = fakeBun();
  assert.equal(start(entry, build, { port: 4500, hostname: "127.0.0.1", signals: false }), server);
  assert.equal(state.options!.port, 4500);
  assert.equal(state.options!.hostname, "127.0.0.1");
  const request = new Request("http://x/page");
  const response = await state.options!.fetch(request, server);
  assert.equal(await response.text(), "app");
  assert.deepEqual(appCalls, [[request, undefined, server]]);
});

test("bun: client files go through Bun.file before the app; HEAD has no body; POST skips them", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const dir = mkdtempSync(join(tmpdir(), "rivet-bun-"));
  try {
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "a.js"), "export {}");
    const { state, server } = fakeBun();
    start(entry, build, { client: dir, signals: false });
    const hit = await state.options!.fetch(new Request("http://x/assets/a.js"), server);
    assert.equal(hit.status, 200);
    assert.match(await hit.text(), /^file:.*assets[/\\]a\.js$/);
    const head = await state.options!.fetch(new Request("http://x/assets/a.js", { method: "HEAD" }), server);
    assert.equal(await head.text(), "");
    assert.equal(appCalls.length, 0);
    await state.options!.fetch(new Request("http://x/assets/a.js", { method: "POST" }), server);
    assert.equal(appCalls.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
