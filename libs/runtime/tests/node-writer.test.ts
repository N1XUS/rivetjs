import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { NodeStreamWriter } from "../node.ts";

function collect({ highWaterMark = 1 << 20, delay = false } = {}) {
  const parts: Buffer[] = [];
  const sink = new Writable({ highWaterMark, write(chunk: Buffer, _encoding, done) { parts.push(Buffer.from(chunk)); delay ? setTimeout(done, 1) : done(); } });
  return { sink, text: () => Buffer.concat(parts).toString(), parts };
}

test("byte writer encodes strings and pre-encoded bytes in order without splitting UTF-8 sequences", async () => {
  const { sink, text, parts } = collect();
  const writer = new NodeStreamWriter(sink, { threshold: 16 });
  const pieces = ["<p>", new TextEncoder().encode("static ☺ "), "中文😀", "", "lone\ud800", "x".repeat(100), new TextEncoder().encode("<end>")];
  for (const piece of pieces) await (typeof piece === "string" ? writer.write(piece) : writer.writeBytes(piece));
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  assert.equal(text(), "<p>static ☺ 中文😀lone�" + "x".repeat(100) + "<end>");
  for (const part of parts) assert.doesNotThrow(() => new TextDecoder("utf-8", { fatal: true }).decode(part));
  assert.ok(parts.length > 1, "threshold flushes produce several sink writes");
});

test("byte writer reports backpressure once the sink is full and resumes after drain", async () => {
  const { sink, text } = collect({ highWaterMark: 8, delay: true });
  const writer = new NodeStreamWriter(sink, { threshold: 8, maxBuffered: 0 });
  let waits = 0;
  for (let i = 0; i < 20; i++) {
    const result = i % 2 ? writer.writeBytes(new TextEncoder().encode(`[${i}]`)) : writer.write(`<${i}>`);
    if (result) { waits++; await result; }
  }
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  assert.ok(waits > 0);
  assert.equal(text(), Array.from({ length: 20 }, (_, i) => (i % 2 ? `[${i}]` : `<${i}>`)).join(""));
});

test("byte writer rejects writes after abort and after the sink closes", async () => {
  const controller = new AbortController();
  const { sink } = collect();
  const writer = new NodeStreamWriter(sink, { signal: controller.signal });
  writer.write("a");
  controller.abort();
  assert.throws(() => writer.writeBytes(new Uint8Array([1])), { name: "AbortError" });
  const closed = collect();
  const second = new NodeStreamWriter(closed.sink);
  second.write("b");
  closed.sink.destroy();
  assert.throws(() => second.finish(), /Response stream closed/);
});

test("byte writer never truncates multibyte chunks near the end of a slab", async () => {
  const { sink, text } = collect();
  const writer = new NodeStreamWriter(sink, { threshold: 16 });
  let expected = "";
  for (let i = 0; i < 3000; i++) {
    const piece = "中".repeat((i * 7) % 41 + 1);
    expected += piece + piece;
    writer.write(piece);
    writer.writeBytes(new TextEncoder().encode(piece));
  }
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  assert.equal(text(), expected);
});

test("recycled slabs are never reused while a handed-off chunk is still pending", async () => {
  // Delay every sink callback so retired slabs stay referenced while new writers run.
  const outputs: Buffer[][] = [];
  const sinks = Array.from({ length: 4 }, () => {
    const parts: Buffer[] = [];
    outputs.push(parts);
    return new Writable({ highWaterMark: 1 << 24, write(chunk: Buffer, _encoding, done) { parts.push(chunk); setTimeout(done, 5); } });
  });
  const expected: string[] = [];
  for (let round = 0; round < 3; round++) {
    await Promise.all(sinks.map(async (sink, index) => {
      const writer = new NodeStreamWriter(sink, { threshold: 4096 });
      let text = "";
      for (let i = 0; i < 400; i++) { const piece = `<${round}:${index}:${i}>` + "x".repeat(i % 97); text += piece; writer.write(piece); }
      await writer.finish();
      expected[index] = (expected[index] ?? "") + text;
    }));
  }
  await Promise.all(sinks.map((sink) => new Promise((resolve) => sink.end(resolve))));
  // Decode only after every callback ran: corruption would show recycled bytes here.
  outputs.forEach((parts, index) => assert.equal(Buffer.concat(parts).toString(), expected[index]));
});

test("slabs stay live when synchronous acknowledgements become delayed", async () => {
  const parts: Buffer[] = [];
  let writes = 0, release: (() => void) | undefined;
  const sink = new Writable({ highWaterMark: 1 << 20, write(chunk: Buffer, _encoding, done) {
    const consume = () => { parts.push(Buffer.from(chunk)); done(); };
    if (++writes === 3) release = consume;
    else consume();
  } });
  const writer = new NodeStreamWriter(sink, { threshold: 16 * 1024 });
  const expected = Array.from({ length: 6 }, (_, i) => Buffer.alloc(16 * 1024, 65 + i));
  for (const chunk of expected.slice(0, 2)) {
    writer.writeBytes(chunk);
    // Node defers write callbacks even when _write completes synchronously.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  // The third flush retires the slab; its bytes must remain live until consumed.
  for (const chunk of expected.slice(2)) writer.writeBytes(chunk);
  await writer.finish();
  assert.ok(release, "the sink retained the third chunk");
  release();
  await new Promise<void>((resolve) => sink.end(resolve));
  assert.equal(parts.length, expected.length);
  for (let i = 0; i < expected.length; i++)
    assert.ok(parts[i].equals(expected[i]), `chunk ${i + 1} changed before its acknowledgement`);
});

test("byte writer encodes integers as ASCII digits identical to String()", async () => {
  const { sink, text } = collect();
  const writer = new NodeStreamWriter(sink, { threshold: 8 });
  const values = [0, -0, 7, -7, 10, 99, 100, 123456789, -2147483648, 2147483647, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
  for (const value of values) { writer.writeInteger(value); writer.write(","); }
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  assert.equal(text(), values.map(String).join(",") + ",");
});

test("integer encoding covers every decimal width and randomized safe integers across slab boundaries", async () => {
  const values = [0, -0, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, -2147483649, -2147483648, 2147483647, 2147483648];
  for (let i = 0; i < 200; i++) values.push(i, -i);
  for (let power = 10; power <= 1e15; power *= 10)
    for (const value of [power - 1, power, power + 1]) values.push(value, -value);
  let seed = 0x7489ab31;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 2048; i++) {
    const value = (random() & 0x1fffff) * 0x100000000 + random();
    values.push(i % 2 ? -value : value);
  }
  // Interleaving Unicode also exercises reserve/flush when the next integer needs 17 bytes.
  const expected = values.map((value) => String(value) + "中😀|").join("");
  for (const threshold of [8, 127, 16 * 1024]) {
    const { sink, text } = collect();
    const writer = new NodeStreamWriter(sink, { threshold });
    for (const value of values) {
      await writer.writeInteger(value);
      await writer.write("中😀|");
    }
    await writer.finish();
    await new Promise<void>((resolve) => sink.end(resolve));
    assert.equal(text(), expected, `threshold=${threshold}`);
  }
});

test("slabs for larger thresholds are pooled per size", async () => {
  for (let round = 0; round < 3; round++) {
    const { sink, text } = collect();
    const writer = new NodeStreamWriter(sink, { threshold: 64 * 1024 });
    for (let i = 0; i < 2000; i++) writer.write("<row>" + i + "</row>");
    await writer.finish();
    await new Promise((resolve) => sink.end(resolve));
    assert.equal(text(), Array.from({ length: 2000 }, (_, i) => "<row>" + i + "</row>").join(""));
  }
});

test("byte writer tolerates sink buffering up to maxBuffered before waiting for drain", async () => {
  const { sink, text } = collect({ highWaterMark: 16, delay: true });
  const writer = new NodeStreamWriter(sink, { threshold: 64, maxBuffered: 4096 });
  let waits = 0, maxQueued = 0;
  for (let i = 0; i < 400; i++) {
    const result = writer.write("<" + "x".repeat(60) + ">");
    maxQueued = Math.max(maxQueued, sink.writableLength);
    if (result) { waits++; await result; }
  }
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  assert.equal(text(), ("<" + "x".repeat(60) + ">").repeat(400));
  assert.ok(waits > 0 && waits < 20, `waits=${waits}`);
  assert.ok(maxQueued <= 4096 + 128, `queued=${maxQueued}`);
});

test("a paused render's pending bytes leave in a microtask (no threshold wait before an await)", async () => {
  const parts: Buffer[] = [];
  const sink = new Writable({ highWaterMark: 1 << 20, write(chunk: Buffer, _encoding, done) { parts.push(Buffer.from(chunk)); done(); } });
  const writer = new NodeStreamWriter(sink);
  writer.write("<head>");
  writer.writeBytes(Buffer.from("<body>"));
  assert.equal(parts.length + sink.writableLength, 0, "nothing handed off synchronously below the threshold");
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(Buffer.concat(parts).toString(), "<head><body>");
  writer.write("tail");
  await writer.finish();
  await new Promise<void>((resolve) => sink.end(resolve));
  assert.equal(Buffer.concat(parts).toString(), "<head><body>tail");
});

test("a paused render's microtask flush never leaves an unhandled rejection when the sink closes", async () => {
  const unhandled: unknown[] = [];
  const track = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", track);
  try {
    // A sink that never drains: the microtask flush gets a backpressure wait, then the stream closes.
    const sink = new Writable({ highWaterMark: 1, write() {} });
    const writer = new NodeStreamWriter(sink, { maxBuffered: 0 });
    writer.write("<head>");
    await Promise.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    sink.destroy();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
    // The close still reaches the render: its next flush (here: finish) fails.
    writer.write("<body>");
    await assert.rejects(async () => writer.finish(), /Response stream closed/);
  } finally {
    process.off("unhandledRejection", track);
  }
});
