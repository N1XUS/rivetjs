// G-WR: NodeStreamWriter fused text escape (writeText), first-flush yield, and byte-path parity with renderToString.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { NodeStreamWriter } from "../node.ts";
import { escapeText } from "../template.ts";
import { renderToString, renderToWriter, compiledTemplate, attribute, _list, _listPlan } from "../server.ts";

function collect() {
  const parts: Buffer[] = [];
  const sink = new Writable({
    highWaterMark: 1 << 20,
    write(chunk: Buffer, _encoding, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  return { sink, bytes: () => Buffer.concat(parts), parts };
}

const samples = [
  "",
  "plain",
  "12345",
  "&",
  "<b>\"1\"</b> & 'é€漢字𝄞'",
  "<<>>&&",
  "é",
  "€",
  "𝄞",
  "lone \ud800 high",
  "lone \udc00 low",
  "􏿿",
  "trailing \ud83d",
  "\u007f\u0080߿ࠀ￿",
  "x".repeat(64),
  "x".repeat(63) + "&",
  "<".repeat(64),
  "é".repeat(65),
  "a & b < c > d ".repeat(20),
];

test("writeText writes exactly the UTF-8 bytes of escapeText for every code unit class", async () => {
  for (const threshold of [1, 16, 16 * 1024]) {
    const { sink, bytes } = collect();
    const writer = new NodeStreamWriter(sink, { threshold, early: false });
    let expected = "";
    for (let round = 0; round < 50; round++)
      for (const sample of samples) {
        expected += escapeText(sample);
        await writer.writeText(sample);
      }
    await writer.finish();
    await new Promise((resolve) => sink.end(resolve));
    assert.deepEqual(bytes(), Buffer.from(expected), `threshold ${threshold}`);
  }
});

test("writeText never splits a multibyte sequence across flushed chunks", async () => {
  const { sink, parts } = collect();
  const writer = new NodeStreamWriter(sink, { threshold: 7, early: false });
  for (let i = 0; i < 2000; i++) writer.writeText(i % 3 ? "漢𝄞é&" : "<x>");
  writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  for (const part of parts) assert.doesNotThrow(() => new TextDecoder("utf-8", { fatal: true }).decode(part));
});

test("writeText rejects after abort like the other writes", () => {
  const controller = new AbortController();
  const { sink } = collect();
  const writer = new NodeStreamWriter(sink, { signal: controller.signal });
  writer.writeText("a");
  controller.abort();
  assert.throws(() => writer.writeText("b"), { name: "AbortError" });
  assert.throws(() => writer.writeText("x".repeat(100)), { name: "AbortError" });
});

test("early bytes: writers never yield; the socket is uncorked once 128 KiB went to the sink, pages below keep one write", async () => {
  // A response-like sink: `socket` corked by its writes (as Node's ServerResponse corks until the next tick).
  const sinkWithSocket = () => {
    const { sink, bytes } = collect();
    const socket = {
      writableCorked: 0,
      uncorks: 0,
      uncork() {
        this.writableCorked--;
        this.uncorks++;
      },
    };
    const write = sink.write.bind(sink);
    Object.assign(sink, { socket, write: (chunk: Uint8Array, done?: () => void) => ((socket.writableCorked ||= 1), write(chunk, done)) });
    return { sink, bytes, socket };
  };
  const small = sinkWithSocket();
  const page = new NodeStreamWriter(small.sink, { threshold: 4 });
  for (let i = 0; i < 1000; i++) assert.equal(page.write("abcd"), undefined, "never yields");
  assert.equal(page.finish(), undefined);
  assert.equal(small.socket.uncorks, 0, "4000 bytes: no early uncork");
  const big = sinkWithSocket();
  const large = new NodeStreamWriter(big.sink, { threshold: 4 });
  const other = new NodeStreamWriter(collect().sink, { threshold: 4 });
  for (let i = 0; i < 100000; i++) {
    assert.equal(large.write("abcd"), undefined, "a large page never yields");
    assert.equal(other.write("efgh"), undefined, "concurrent writers never yield");
    if (i === 32 * 1024 - 2) assert.equal(big.socket.uncorks, 0, "below 128 KiB still corked");
  }
  assert.equal(big.socket.uncorks, 1, "uncorked once, at 128 KiB");
  large.finish();
  other.finish();
  await new Promise((resolve) => big.sink.end(resolve));
  assert.equal(big.bytes().length, 400000);
  const off = sinkWithSocket();
  const plain = new NodeStreamWriter(off.sink, { threshold: 4, early: false });
  for (let i = 0; i < 100000; i++) plain.write("abcd");
  plain.finish();
  assert.equal(off.socket.uncorks, 0, "early: false never uncorks");
});

test("early bytes over a real response: the response's own cork is released with its socket's, so the counts stay in step", async () => {
  // Node 26.11+ corks the response itself (chunked frames buffer in it) and its socket once per cork; uncorking only
  // the socket leaves a corked response over an uncorked socket: frames then go out one write each, never fill the
  // socket and the response's `drain` never fires (a stalled render). Older Node corks only the socket.
  const { createServer } = await import("node:http");
  const seen: boolean[] = [];
  const server = createServer(async (_req, res) => {
    const writer = new NodeStreamWriter(res, { threshold: 4096 });
    const row = "x".repeat(1000);
    for (let i = 0; i < 700; i++) {
      await writer.write(row);
      if (i % 50 === 0) seen.push(res.socket!.writableCorked >= res.writableCorked);
    }
    await writer.finish();
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as { port: number };
    const body = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.equal(body.length, 700000);
    assert.ok(seen.length === 14 && seen.every(Boolean), "socket corked at least as often as its response");
  } finally {
    server.close();
  }
});

test("backpressure: one pending wait per writer, so a dropped second wait never rejects unhandled on abort", async () => {
  const sink = new Writable({ highWaterMark: 1, write() {} });
  const controller = new AbortController();
  const writer = new NodeStreamWriter(sink, { threshold: 4, maxBuffered: 1, signal: controller.signal });
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const first = writer.send("abcd");
    assert.ok(first, "backpressure");
    assert.equal(writer.send("efgh"), first, "a second wait shares the first");
    // A long chunk takes both flushes (room, then the chunk itself): only one promise exists to return.
    assert.equal(writer.write("x".repeat(64)), first);
    controller.abort();
    await assert.rejects(first);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
    sink.destroy();
  }
});

test("renderToWriter over NodeStreamWriter matches renderToString for escaped list and template text", async () => {
  const fragments = Object.freeze(["<li", ">", "<b>", "</b>", "</li>"]);
  const plan = _listPlan(fragments, [["data-id", "html"], null, null, null]);
  const items = Array.from({ length: 700 }, (_, i) => ({ id: i, values: [i % 2 ? `<${i}> & 'é𝄞'` : i, i % 5 ? "\ud800" + i : null, "€".repeat(i % 70)] }));
  const row = (item: { id: number; values: unknown[] }) =>
    compiledTemplate(fragments, [attribute("data-id", item.id), item.values[0], item.values[1], item.values[2]] as never);
  const page = () =>
    compiledTemplate(Object.freeze(["<ul>", "", "</ul>"]), [
      "head <&> é",
      _list(items, row as never, plan, (tape, base, item) => {
        const { id, values } = item as { id: number; values: unknown[] };
        tape[base] = id;
        tape[base + 1] = values[0];
        tape[base + 2] = values[1];
        tape[base + 3] = values[2];
      }),
    ] as never);
  const expected = renderToString(page()) as string;
  const { sink, bytes } = collect();
  const writer = new NodeStreamWriter(sink, { threshold: 512 });
  await renderToWriter(page(), writer);
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  assert.deepEqual(bytes(), Buffer.from(expected));
  assert.ok(expected.includes("&lt;1&gt; &amp; 'é𝄞'") && expected.includes("\ud8001"));
});

test("raw list rows: integers, safe non-int32 integers, omitted values, attributes and long strings match renderToString", async () => {
  const fragments = Object.freeze(["<i", " a", ">", "|", "|", "</i>"]);
  const plan = _listPlan(fragments, [["data-n", "html"], ["hidden", "html"], null, null, null]);
  const values: unknown[] = [0, -1, 2 ** 31, -(2 ** 40), 2 ** 53 - 1, 1.5, NaN, null, undefined, true, false, "", "<&>", "x".repeat(65), 7n];
  const items = values.flatMap((v, i) => values.map((w, j) => ({ n: (i * 31 + j) % 3 ? i * j : v, h: j % 4 ? null : v, a: v, b: w, c: i })));
  const page = () =>
    compiledTemplate(Object.freeze(["<p>", "</p>"]), [
      _list(items, (() => null) as never, plan, (tape, base, item) => {
        const row = item as { n: unknown; h: unknown; a: unknown; b: unknown; c: unknown };
        tape[base] = row.n;
        tape[base + 1] = row.h;
        tape[base + 2] = row.a;
        tape[base + 3] = row.b;
        tape[base + 4] = row.c;
      }),
    ] as never);
  const expected = renderToString(page()) as string;
  for (const threshold of [64, 16 * 1024]) {
    const { sink, bytes } = collect();
    const writer = new NodeStreamWriter(sink, { threshold });
    await renderToWriter(page(), writer);
    await writer.finish();
    await new Promise((resolve) => sink.end(resolve));
    assert.deepEqual(bytes(), Buffer.from(expected), `threshold ${threshold}`);
  }
});

test("raw compiled records: scalar slots and integer attribute records match renderToString; other slots take the generic path", async () => {
  const fragments = Object.freeze(["<a", " b", ">", "|", "|", "</a>"]);
  const values: unknown[] = [0, 42, -7, 2 ** 40, 1.25, null, undefined, true, "", "<x> & é𝄞", "y".repeat(80), 3n];
  const page = () =>
    compiledTemplate(Object.freeze(["<div>", "</div>"]), [
      values.flatMap((a) =>
        values.map((b) =>
          compiledTemplate(fragments, [
            attribute("data-v", a),
            attribute(typeof b === "number" ? "data-w" : "disabled", b),
            a,
            b,
            compiledTemplate(Object.freeze(["<i>", "</i>"]), [b as never]),
          ] as never),
        ),
      ),
    ] as never);
  const expected = renderToString(page()) as string;
  for (const threshold of [32, 16 * 1024]) {
    const { sink, bytes } = collect();
    const writer = new NodeStreamWriter(sink, { threshold });
    await renderToWriter(page(), writer);
    await writer.finish();
    await new Promise((resolve) => sink.end(resolve));
    assert.deepEqual(bytes(), Buffer.from(expected), `threshold ${threshold}`);
  }
});
