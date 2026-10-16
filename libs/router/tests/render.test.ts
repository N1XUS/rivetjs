// renderPage: coalesced body writes, shell first while a boundary is pending, backpressure.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderPage, type DocumentShell } from "../server/render.ts";

const document: DocumentShell = () => ({ start: "<!doctype html><body><div id=app>", end: "</div></body>" });
const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
const page = (factory: () => unknown) => renderPage(factory as never, input, { document }, { status: 200, headers: new Headers() });

async function chunks(response: Response): Promise<string[]> {
  const out: string[] = [];
  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) out.push(decoder.decode(next.value));
  return out;
}

test("a synchronous page's fragments go out as one body chunk", async () => {
  const out = await chunks(page(() => Array.from({ length: 50 }, (_, i) => ["<p>", String(i), "</p>"])));
  assert.equal(out.length, 1);
  assert.match(out[0]!, /^<!doctype html><body><div id=app>.*49.*<\/div><\/body>$/);
});

test("pending content: the shell before it is flushed first (TTFB), the rest after it resolves", async () => {
  let release!: (value: string) => void;
  const later = new Promise<string>((done) => (release = done));
  const response = page(() => ["shell", later, "tail"]);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const first = await reader.read();
  assert.equal(decoder.decode(first.value), "<!doctype html><body><div id=app>shell");
  release("late");
  let rest = "";
  for (let next = await reader.read(); !next.done; next = await reader.read()) rest += decoder.decode(next.value);
  assert.equal(rest, "latetail</div></body>");
});

test("large output flushes at the coalescing size and waits for the consumer (backpressure)", async () => {
  const big = "x".repeat(1024);
  let produced = 0;
  const response = page(() => Array.from({ length: 512 }, () => () => (produced++, big)));
  // Nothing read yet: the renderer stops once the stream's queue (64 KiB) is full.
  await new Promise((done) => setTimeout(done, 20));
  assert.ok(produced < 512, `renderer ran ahead of the consumer (${produced})`);
  const out = await chunks(response);
  assert.equal(produced, 512);
  assert.ok(out.length > 1 && out.every((chunk) => chunk.length <= 17 * 1024 + 64), `chunk sizes ${out.map((c) => c.length)}`);
  assert.equal(out.join("").length, 512 * 1024 + 33 + 13);
});

test("byte writer: compiled fragments, integers, non-ASCII and oversized strings encode exactly like renderToString", async () => {
  const { template, attribute, renderToString } = await import("@rivetjs/runtime/server");
  const huge = "é€😀<".repeat(30_000); // > the 64 KiB slab once encoded
  const values = [0, -0, 7, -42, 2 ** 31 - 1, -(2 ** 31), 2 ** 31, 2 ** 53 - 1, 1.5, NaN, "ascii", "ü".repeat(80), "a\uD800b", huge];
  const app = () => [template(["<ul", ">", "</ul>"], [attribute("data-n", 12345), values.map((value) => template(["<li>", "</li>"], [value]))]), "tail ✓"];
  // Chunks split UTF-8 sequences anywhere: decode the whole body; a lone surrogate is U+FFFD in UTF-8.
  const html = await page(app).text();
  const expected = new TextDecoder().decode(new TextEncoder().encode(await renderToString(app() as never)));
  assert.equal(html, "<!doctype html><body><div id=app>" + expected + "</div></body>");
});

test("node: body slabs are Buffers, so text fields take the native encoder; output matches renderToString", async () => {
  const { template, renderToString } = await import("@rivetjs/runtime/server");
  // Text-grid shaped values: 17–64 chars, clean, escape-bearing and non-ASCII (ssr-bench strings=2).
  const fields = [
    "Ada Lovelace <ada@example.com>",
    "https://example.com/a?b=1&c=2",
    "plain clean text field of medium length",
    "naïve café résumé — ünïcödé text",
    "x".repeat(17),
  ];
  const app = () => Array.from({ length: 200 }, (_, i) => template(["<dd>", "</dd><dd>", "</dd>"], [fields[i % 5], fields[(i + 2) % 5]]));
  const reader = page(app).body!.getReader();
  const first = await reader.read();
  assert.ok(Buffer.isBuffer(first.value), "chunk is a Buffer view");
  let bytes = Buffer.from(first.value!);
  for (let next = await reader.read(); !next.done; next = await reader.read()) bytes = Buffer.concat([bytes, next.value]);
  assert.equal(bytes.toString("utf8"), "<!doctype html><body><div id=app>" + (await renderToString(app() as never)) + "</div></body>");
});

test("head hold keeps the byte writer: held fragments and integers replay after the document start in order (RA5)", async () => {
  const { compiledTemplate } = await import("@rivetjs/runtime/server");
  const writes: string[] = [];
  const held: DocumentShell = ({ head }) => ({ start: "<!doctype html><title>" + (head?.title ?? "") + "</title><body>", end: "</body>" });
  const factory = () => {
    const view = compiledTemplate(["<p>", " items, ", "</p>"], [42, "<x>"]);
    // The writer the renderer sees exposes the byte path while holding.
    return [view, () => (writes.push("rendered"), null)];
  };
  const response = renderPage(factory as never, input, { document: held, hold: { head: () => ({ title: "Held" }) } } as never, {
    status: 200,
    headers: new Headers(),
  });
  const out = (await chunks(response)).join("");
  assert.equal(out, "<!doctype html><title>Held</title><body><p>42 items, &lt;x&gt;</p></body>");
  assert.deepEqual(writes, ["rendered"]);
});

// Docs prerender shape (cdk-docs /components/menu/: a ~680 KB page with a held head): the held body is
// released past the stream's 64 KiB queue in one go, then the document end waits on backpressure while no
// Response has been handed out yet (renderDocument). It must still answer and finish (no stall at 3×64 KiB).
test("renderDocument + head hold: a page far past the queue size answers and completes, with or without a pending boundary", async () => {
  const { renderDocument } = await import("../server/render.ts");
  const held: DocumentShell = ({ head }) => ({ start: "<!doctype html><title>" + (head?.title ?? "") + "</title><body>", end: "</body>" });
  const row = "y".repeat(1024);
  for (const pending of [false, true]) {
    const factory = () => [pending ? Promise.resolve("late") : "now", Array.from({ length: 700 }, () => row)];
    const response = await renderDocument(factory as never, input, { document: held, hold: { head: () => ({ title: "Big" }) } } as never, {
      status: 200,
      headers: new Headers(),
    });
    const reader = response.body!.getReader();
    let bytes = 0;
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      bytes += next.value.length;
      await new Promise((done) => setTimeout(done, 0)); // a slow consumer
    }
    assert.equal(bytes, "<!doctype html><title>Big</title><body>".length + (pending ? 4 : 3) + 700 * 1024 + "</body>".length);
  }
});

test("raw-slab protocol: whole compiled records written in place (claim/commit) across slab boundaries match renderToString", async () => {
  const { template, attribute, renderToString } = await import("@rivetjs/runtime/server");
  // Scalar-only records take the renderer's rawTemplate path (claim → bytes[offset] → commit); 6000 rows
  // fill several 64 KiB slabs and flushes, so claims land at slab ends too. Also the full-queue wait: a
  // second write before the first wait settled used to orphan the first wake (this page hung at ~5,500 rows).
  const app = () =>
    Array.from({ length: 6000 }, (_, i) => template(["<li", ">", " ", "</li>"], [attribute("data-i", i), i * 7 - 3000, i % 3 ? "a&b<c>" + i : "üñ€" + i]));
  const html = await page(app).text();
  assert.equal(html, "<!doctype html><body><div id=app>" + (await renderToString(app() as never)) + "</div></body>");
});

test("a finished render's Response keeps nothing of the render alive (body stream + direct hook close over the writer only)", async () => {
  // Node keeps a Response's web stream and its source reachable through scavenges until a full GC, read or not:
  // whatever the source closes over is promoted with it (resume /resume 1000 rows: its whole render graph).
  const v8 = await import("node:v8");
  const vm = await import("node:vm");
  v8.setFlagsFromString("--expose-gc");
  const gc = vm.runInNewContext("gc") as () => void;
  let marker!: WeakRef<object>;
  const response = (() => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    marker = new WeakRef(rows);
    return page(() => rows.map((row) => row.id));
  })();
  await new Promise((done) => setTimeout(done, 0));
  gc();
  assert.equal(marker.deref(), undefined);
  // The unread Response (a direct sink may still attach) stays alive across the check.
  assert.equal(response.bodyUsed, false);
  assert.match(await response.text(), /979899<\/div><\/body>$/);
});
