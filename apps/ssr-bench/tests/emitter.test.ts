import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { emitPage, escapeText, escapeAttribute, type Page } from "../fixture/emitter.ts";
import { StringWriter, NodeStreamWriter } from "@rivetjs/runtime/node";

const fixture: Page = { token: "request-1", title: "A < B & C", rows: [{ id: 0, values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }] };

test("escaping preserves hostile data as text and quoted attributes", () => {
  assert.equal(escapeText("</script>&\"'"), "&lt;/script&gt;&amp;\"'");
  assert.equal(escapeAttribute('" onmouseover="evil<&'), "&quot; onmouseover=&quot;evil&lt;&amp;");
});

test("emission contains complete native HTML, all fields, and escaped request identity", async () => {
  const writer = new StringWriter();
  await emitPage({ ...fixture, token: '"><script>x</script>' }, writer);
  const html = writer.finish();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /A &lt; B &amp; C/);
  assert.match(html, /data-token="&quot;&gt;&lt;script&gt;x&lt;\/script&gt;"/);
  assert.equal((html.match(/<dd>/g) ?? []).length, 10);
  assert.match(html, /<dd>9<\/dd>/);
  assert.doesNotMatch(html, /<script|bench-row|rivet/i);
  assert.match(html, /<!--complete--><\/body><\/html>$/);
});

test("streamed output equals buffered output with multibyte content", async () => {
  let actual = "";
  const sink = new Writable({
    highWaterMark: 32,
    write(chunk: Buffer, _encoding, done) {
      actual += chunk.toString();
      setTimeout(done, 1);
    },
  });
  const streamed = new NodeStreamWriter(sink, { threshold: 64, maxBuffered: 0 });
  const buffered = new StringWriter();
  const page: Page = { ...fixture, title: "☺ 中文", rows: Array.from({ length: 5 }, () => fixture.rows[0]!) };
  await emitPage(page, streamed);
  await streamed.finish();
  await emitPage(page, buffered);
  assert.match(actual, /<dd>9<\/dd>/);
  assert.equal(actual, buffered.finish());
});

test("slow writer stops producing subsequent rows until the sink accepts them", async () => {
  let release!: () => void;
  let writes = 0;
  const writer = {
    write() {
      writes++;
      if (writes === 2)
        return new Promise<void>((resolve) => {
          release = resolve;
        });
    },
  };
  const rendering = emitPage({ ...fixture, rows: [fixture.rows[0]!, fixture.rows[0]!] }, writer);
  assert.equal(writes, 2);
  release();
  await rendering;
  assert.equal(writes, 4);
});

test("aborted backpressure rejects promptly and removes drain listeners", async () => {
  const controller = new AbortController();
  const sink = new Writable({ highWaterMark: 1, write(_chunk, _encoding, _done) {} });
  const writer = new NodeStreamWriter(sink, { threshold: 1, maxBuffered: 0, signal: controller.signal });
  const rendering = emitPage(fixture, writer, { signal: controller.signal });
  controller.abort();
  await assert.rejects(async () => await rendering, { name: "AbortError" });
  assert.equal(sink.listenerCount("drain"), 0);
  sink.destroy();
});

test("writer errors and response-size bounds are observable failures", async () => {
  await assert.rejects(
    async () =>
      emitPage(fixture, {
        write() {
          throw new Error("sink failed");
        },
      }),
    /sink failed/,
  );
  assert.throws(() => new StringWriter({ maxBytes: 4 }).write("12345"), /limit/);
});

test("empty pages remain complete and untrusted scalar values remain escaped", async () => {
  const writer = new StringWriter();
  await emitPage({ ...fixture, rows: [] }, writer);
  assert.match(writer.finish(), /<section data-grid=""><\/section>/);
  const rowWriter = new StringWriter();
  await emitPage(
    { ...fixture, rows: [{ id: '"x', values: ["<img onerror=x>", 1, 2, 3, 4, 5, 6, 7, 8, 9] }] },
    rowWriter,
  );
  const html = rowWriter.finish();
  assert.match(html, /&lt;img onerror=x&gt;/);
  assert.doesNotMatch(html, /<img/);
});
