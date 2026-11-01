// The EXPERIMENTAL uWebSockets.js adapter (`adapters/uws.ts`) over an in-process fake of the uWS API (the real
// module needs the ssr-bench uws image: `tests/uws/adapter.ts`). Covers what the fake can model exactly: request
// bodies fed through `onData` (no throw inside uWS's native callback, bounded unread queue), abort releasing the
// renderer's chunks, static-file traversal and HEAD.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveUws, type UwsModule } from "../adapters/uws.ts";
import { DIRECT_BODY, type BodySink } from "../server/body.ts";
import type { Handler } from "../adapters/node.ts";

interface FakeRes {
  status: string;
  headers: [string, string][];
  body: string;
  ended: boolean;
  closed: boolean;
  data: ((chunk: ArrayBuffer, last: boolean) => void) | null;
  abort: (() => void) | null;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

function fakeUws(): { module: UwsModule; request(method: string, url: string, headers?: Record<string, string>): FakeRes } {
  let route: ((res: never, req: never) => void) | null = null;
  const module = {
    App: () => {
      const app = {
        any: (_: string, handler: (res: never, req: never) => void) => ((route = handler), app),
        listen: (_host: string, _port: number, cb: (socket: unknown) => void) => (cb({}), app),
        close: () => app,
      };
      return app;
    },
    us_listen_socket_close: () => {},
    us_socket_local_port: () => 4500,
  } as unknown as UwsModule;
  const request = (method: string, url: string, headers: Record<string, string> = {}): FakeRes => {
    const [path, query = ""] = url.split("?");
    const state: FakeRes = { status: "", headers: [], body: "", ended: false, closed: false, data: null, abort: null };
    const res = {
      writeStatus: (line: string) => ((state.status = line), res),
      writeHeader: (name: string, value: string) => (state.headers.push([name, value]), res),
      write: (chunk: Uint8Array | string) => ((state.body += typeof chunk === "string" ? chunk : dec.decode(chunk)), true),
      end: (chunk?: Uint8Array | string) => (
        (state.body += chunk === undefined ? "" : typeof chunk === "string" ? chunk : dec.decode(chunk)),
        (state.ended = true),
        res
      ),
      endWithoutBody: () => ((state.ended = true), res),
      close: () => ((state.closed = true), res),
      cork: (cb: () => void) => (cb(), res),
      onWritable: () => res,
      onAborted: (cb: () => void) => ((state.abort = cb), res),
      onData: (cb: (chunk: ArrayBuffer, last: boolean) => void) => ((state.data = cb), res),
      getRemoteAddressAsText: () => enc.encode("127.0.0.1").buffer,
    };
    const all = { host: "localhost", ...headers };
    const req = {
      getUrl: () => path,
      getQuery: () => query,
      getCaseSensitiveMethod: () => method,
      getHeader: (name: string) => all[name as keyof typeof all] ?? "",
      forEach: (cb: (k: string, v: string) => void) => Object.entries(all).forEach(([k, v]) => cb(k, v)),
    };
    route!(res as never, req as never);
    return state;
  };
  return { module, request };
}
const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((done) => setTimeout(done, 2));
  assert.ok(check(), "timed out");
};
const MiB = 1024 * 1024;

test("uws: chunks after the reader cancelled the body are dropped, not enqueued on a closed stream", async () => {
  const fake = fakeUws();
  const handler: Handler = async (request) => {
    await request.body!.cancel();
    return new Response("gone", { status: 404 });
  };
  const server = await serveUws({ handler, uws: fake.module, compress: false });
  const res = fake.request("POST", "/x");
  await until(() => res.ended);
  // Pre-fix: TypeError (enqueue on a closed controller) thrown out of uWS's native data callback.
  for (let i = 0; i < 4; i++) res.data!(new ArrayBuffer(1024), false);
  res.data!(new ArrayBuffer(1), true);
  assert.match(res.status, /^404/);
  await server.close();
});

test("uws: an unread request body stops queueing past maxUnread (413 to a late reader)", async () => {
  const fake = fakeUws();
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  let failure: unknown = null;
  const handler: Handler = async (request) => {
    await gate;
    try {
      await request.arrayBuffer();
    } catch (error) {
      failure = error;
    }
    return new Response("ok");
  };
  const server = await serveUws({ handler, uws: fake.module, compress: false, maxUnread: 2 * MiB });
  const res = fake.request("POST", "/x");
  for (let i = 0; i < 8; i++) res.data!(new ArrayBuffer(MiB), false);
  res.data!(new ArrayBuffer(0), true);
  release();
  await until(() => res.ended);
  assert.equal((failure as { status?: number } | null)?.status, 413);
  await server.close();
});

test("uws: a direct body collected when the client aborts releases every chunk", async () => {
  const fake = fakeUws();
  let released = 0;
  let threw = false;
  const handler: Handler = async () => {
    const response = new Response(new ReadableStream(), { headers: { "content-type": "text/html" } });
    (response as unknown as Record<symbol, unknown>)[DIRECT_BODY] = (sink: BodySink) => {
      sink.write(enc.encode("a"), () => released++);
      sink.write(enc.encode("b"), () => released++);
      res.abort!();
      try {
        sink.write(enc.encode("c"), () => released++);
      } catch {
        threw = true;
      }
      sink.end();
      return true;
    };
    return response;
  };
  const server = await serveUws({ handler, uws: fake.module, compress: false });
  const res = fake.request("GET", "/page");
  await until(() => threw);
  await new Promise((done) => setTimeout(done, 5));
  assert.equal(released, 3);
  await server.close();
});

test("uws: static files: traversal and NUL keys miss, HEAD has no body", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rivet-uws-"));
  try {
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "a.js"), "export {}");
    writeFileSync(join(dir, ".secret"), "x");
    const fake = fakeUws();
    const server = await serveUws({ handler: async () => new Response("app", { status: 404 }), uws: fake.module, client: dir, compress: false });
    const hit = fake.request("GET", "/assets/a.js");
    assert.equal(hit.body, "export {}");
    assert.ok(hit.headers.some(([k, v]) => k === "cache-control" && v.includes("immutable")));
    const head = fake.request("HEAD", "/assets/a.js");
    assert.equal(head.body, "");
    for (const url of ["/assets/..%2fa.js", "/.secret", "/assets/a.js%00", "/%E0"]) {
      const miss = fake.request("GET", url);
      await until(() => miss.ended);
      assert.equal(miss.body, "app", url);
    }
    await server.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
