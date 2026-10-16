// Tests of the EXPERIMENTAL uWebSockets.js adapter (`adapters/uws.ts`). Not in the vitest `router` project
// (uWebSockets.js is no dependency; its binaries need glibc ≥ 2.38): run with `node --test` inside the ssr-bench
// uws image, `UWS_MODULE` = a path the package resolves from (see `apps/ssr-bench/CLAUDE.md` "UWS-SPIKE").
//   docker run --rm -v "$PWD":/src:ro -e UWS_MODULE=/workspace/apps/ssr-bench/x.js rivet-ssr-bench-uws:local \
//     node --test /src/libs/router/tests/uws/adapter.ts
// `UWS_ADAPTER` (optional) = another adapter file to test (e.g. a pre-fix copy, to watch a test fail).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { connect, type Socket } from "node:net";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { DIRECT_BODY, type BodySink } from "../../server/body.ts";
import type { UwsModule, UwsServeOptions, UwsServing } from "../../adapters/uws.ts";

const uws = createRequire(process.env.UWS_MODULE ?? import.meta.url)("uWebSockets.js") as UwsModule;
const { serveUws } = (await import(process.env.UWS_ADAPTER ?? "../../adapters/uws.ts")) as { serveUws: (o: UwsServeOptions) => Promise<UwsServing> };
const tick = () => new Promise<void>((done) => setImmediate(done));
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

const SLAB = 64 * 1024;
/** Deterministic, slab-index-dependent bytes (compressible but every slab differs). */
const fill = (slab: Buffer, n: number) => {
  for (let i = 0; i < slab.length; i++) slab[i] = 97 + ((i * 7 + n * 13 + (i >> 9)) % 26);
  return slab;
};
const random = (slab: Buffer, n: number) => {
  let x = (n + 1) * 2654435761;
  for (let i = 0; i < slab.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    slab[i] = x & 255;
  }
  return slab;
};

interface Render {
  produced: number;
  released: number;
  writes: number;
  aborted: boolean;
  failed: boolean;
  expected: Buffer[];
}
/**
 * A renderer like the router's: a pool of `slabs` buffers; a slab is overwritten as soon as every view of it
 * is `done`, and only then. Streams `count` slabs asynchronously (the adapter's streaming path), awaiting the
 * sink's backpressure. Chunks below the compressor's 16 KiB high-water mark are accepted without
 * backpressure, so a chunk released before the Transform read it is overwritten in place.
 */
function renderer(count: number, content: (slab: Buffer, n: number) => Buffer, size = SLAB, slabs = 2): { response: Response; state: Render } {
  const state: Render = { produced: 0, released: 0, writes: 0, aborted: false, failed: false, expected: [] };
  const free: Buffer[] = Array.from({ length: slabs }, () => Buffer.alloc(size));
  const waiters: (() => void)[] = [];
  const take = async () => {
    while (!free.length) await new Promise<void>((done) => waiters.push(done));
    return free.pop()!;
  };
  const response = new Response(new ReadableStream(), { headers: { "content-type": "text/html; charset=utf-8" } });
  (response as unknown as Record<symbol, unknown>)[DIRECT_BODY] = (sink: BodySink) => {
    void (async () => {
      await tick();
      await tick();
      try {
        for (let n = 0; n < count; n++) {
          const slab = content(await take(), n);
          state.expected.push(Buffer.from(slab));
          state.writes++;
          state.produced += slab.length;
          const wait = sink.write(slab, () => {
            state.released++;
            free.push(slab);
            waiters.shift()?.();
          });
          if (wait) await wait;
        }
        sink.end();
      } catch {
        state.failed = true;
      }
    })();
    return true;
  };
  return { response, state };
}

async function server(route: (request: Request) => Response | Promise<Response>): Promise<UwsServing & { port: number }> {
  const serving = await serveUws({ uws, port: 0, host: "127.0.0.1", handler: route, onError: () => {} });
  return { ...serving, port: Number(new URL(serving.url).port) };
}

/** Raw HTTP/1.1 GET: headers + de-chunked body; `slow` pauses the socket for `pause` ms after the headers. */
function get(port: number, encoding: string | null, options: { pause?: number; abortAfter?: number; onPause?: () => Promise<void> } = {}) {
  return new Promise<{ status: number; headers: string; body: Buffer }>((resolve, reject) => {
    const socket: Socket = connect(port, "127.0.0.1");
    const parts: Buffer[] = [];
    let got = 0,
      paused = false;
    socket.on("connect", () =>
      socket.write(`GET /x HTTP/1.1\r\nHost: 127.0.0.1\r\n${encoding ? `Accept-Encoding: ${encoding}\r\n` : ""}Connection: close\r\n\r\n`),
    );
    socket.on("data", (data: Buffer) => {
      parts.push(data);
      got += data.length;
      if (options.abortAfter !== undefined && got > options.abortAfter) {
        socket.destroy();
        resolve({ status: 0, headers: "", body: Buffer.alloc(0) });
        return;
      }
      if (options.pause && !paused) {
        paused = true;
        socket.pause();
        void (options.onPause?.() ?? sleep(options.pause)).then(() => socket.resume());
      }
    });
    socket.on("error", reject);
    socket.on("end", () => {
      const raw = Buffer.concat(parts);
      const split = raw.indexOf("\r\n\r\n");
      const headers = raw.subarray(0, split).toString("latin1");
      let rest = raw.subarray(split + 4);
      if (/transfer-encoding: chunked/i.test(headers)) {
        const out: Buffer[] = [];
        for (;;) {
          const line = rest.indexOf("\r\n");
          const size = parseInt(rest.subarray(0, line).toString("latin1"), 16);
          if (!size) break;
          out.push(rest.subarray(line + 2, line + 2 + size));
          rest = rest.subarray(line + 4 + size);
        }
        rest = Buffer.concat(out);
      }
      resolve({ status: Number(headers.split(" ")[1]), headers, body: rest });
    });
  });
}
const decode = (encoding: string | null, body: Buffer) => (encoding === "br" ? brotliDecompressSync(body) : encoding === "gzip" ? gunzipSync(body) : body);

for (const encoding of ["br", "gzip", null] as const) {
  test(`streamed page bytes are exact across slab reuse (${encoding ?? "identity"})`, async () => {
    let state!: Render;
    const s = await server(() => {
      const r = renderer(2560, fill, 4096); // 10 MiB in 4 KiB views of 2 slabs
      state = r.state;
      return r.response;
    });
    try {
      const { status, headers, body } = await get(s.port, encoding);
      assert.equal(status, 200);
      if (encoding) assert.match(headers, new RegExp(`content-encoding: ${encoding}`, "i"));
      assert.match(headers, /transfer-encoding: chunked/i);
      const bytes = decode(encoding, body);
      assert.equal(bytes.length, 2560 * 4096);
      assert.ok(bytes.equals(Buffer.concat(state.expected)), "decoded body differs from the rendered bytes");
      assert.equal(state.released, state.writes);
    } finally {
      await s.close();
    }
  });

  test(`a paused reader stops the renderer (bounded buffering, ${encoding ?? "identity"})`, async () => {
    let state!: Render;
    const total = 512; // 32 MiB of incompressible bytes
    const s = await server(() => {
      const r = renderer(total, random);
      state = r.state;
      return r.response;
    });
    try {
      let stalledAt = 0,
        later = 0;
      const { body } = await get(s.port, encoding, {
        pause: 1,
        onPause: async () => {
          await sleep(400);
          stalledAt = state.produced;
          await sleep(400);
          later = state.produced;
        },
      });
      // No progress while the client reads nothing: the renderer waits on backpressure.
      assert.equal(later, stalledAt, "renderer kept producing while the client was paused");
      assert.ok(stalledAt < total * SLAB, "the whole body was buffered before the client read it");
      // Loopback socket buffers + uWS + compressor: a few MiB at most, never the page.
      assert.ok(stalledAt <= 12 * 1024 * 1024, `buffered ${stalledAt} bytes ahead of the reader`);
      const bytes = decode(encoding, body);
      assert.ok(bytes.equals(Buffer.concat(state.expected)));
      assert.equal(state.released, state.writes);
    } finally {
      await s.close();
    }
  });

  test(`a client gone mid-stream aborts the request and releases every chunk (${encoding ?? "identity"})`, async () => {
    let state!: Render;
    let signal!: AbortSignal;
    const s = await server((request) => {
      signal = request.signal;
      const r = renderer(4096, random);
      state = r.state;
      return r.response;
    });
    try {
      await get(s.port, encoding, { abortAfter: 256 * 1024 });
      for (let i = 0; i < 100 && !state.failed; i++) await sleep(10);
      assert.ok(signal.aborted, "request.signal not aborted");
      assert.ok(state.failed, "renderer never saw the closed stream");
      assert.ok(state.produced < 4096 * SLAB);
      for (let i = 0; i < 100 && state.released < state.writes; i++) await sleep(10);
      assert.equal(state.released, state.writes, "chunks never released");
    } finally {
      await s.close();
    }
  });
}

test("a synchronous page goes out whole with a Content-Length (compressed in one call)", async () => {
  const html = "<!doctype html>" + "<p>row</p>".repeat(5000);
  const s = await server(() => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
  try {
    for (const encoding of ["br", "gzip", null]) {
      const { headers, body } = await get(s.port, encoding);
      assert.match(headers, /content-length: \d+/i);
      assert.equal(decode(encoding, body).toString(), html);
    }
  } finally {
    await s.close();
  }
});
