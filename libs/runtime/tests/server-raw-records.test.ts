// FLATTEN-RT: raw-slab compiled records (string / null attribute values, nested compiled children, URL
// checks), For rows admitted once, owner re-entry once per continuation — all byte-identical to renderToString.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { createContext, useContext } from "@rivetjs/reactivity";
import { NodeStreamWriter } from "../node.ts";
import { renderToString, renderToWriter, compiledTemplate, attribute, For, Provider } from "../server.ts";
import type { ServerValue } from "../server.ts";

function collect() {
  const parts: Buffer[] = [];
  const sink = new Writable({
    highWaterMark: 1 << 20,
    write(chunk: Buffer, _encoding, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  return { sink, bytes: () => Buffer.concat(parts) };
}
async function viaWriter(page: () => ServerValue, threshold: number): Promise<Buffer> {
  const { sink, bytes } = collect();
  const writer = new NodeStreamWriter(sink, { threshold });
  await renderToWriter(page(), writer);
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  return bytes();
}
async function same(page: () => ServerValue): Promise<string> {
  const expected = (await renderToString(page())) as string;
  for (const threshold of [24, 16 * 1024]) assert.deepEqual(await viaWriter(page, threshold), Buffer.from(expected), `threshold ${threshold}`);
  return expected;
}

const strings = ["", "even", `"q" & 'a' <b>`, "é€漢字𝄞", "lone \ud800", "\udc00", "x".repeat(64), "y".repeat(65), "&quot;"];

test("raw records: string and null attribute values (every escape class) match renderToString", async () => {
  const fragments = Object.freeze(["<p", "", "", ">", "</p>"]);
  const page = () =>
    compiledTemplate(Object.freeze(["<div>", "</div>"]), [
      strings.flatMap((a) =>
        [...strings, null, undefined, 7, 2 ** 40].map((b) =>
          compiledTemplate(fragments, [attribute("data-a", a), attribute("title", b), attribute("aria-label", b === null ? undefined : a), a] as never),
        ),
      ),
    ] as never);
  const html = await same(page);
  assert.ok(html.includes(`data-a="&quot;q&quot; &amp; &#39;a&#39; &lt;b&gt;"`));
  assert.ok(html.includes(`title="&amp;quot;"`));
});

test("raw records: nested compiled children (deeper than the inline depth) and boolean / enumerated attributes", async () => {
  const leaf = (depth: number, value: unknown): ServerValue =>
    depth === 0 ? (value as ServerValue) : compiledTemplate(Object.freeze(["<b", ">", "</b>"]), [attribute("data-d", depth), leaf(depth - 1, value)] as never);
  const page = () =>
    compiledTemplate(Object.freeze(["<main>", "", "</main>"]), [
      [1, 3, 8, 9, 12].flatMap((depth) => strings.map((s) => leaf(depth, s))),
      [true, false, "", "until-found", null, 0, 1].map((v) =>
        compiledTemplate(Object.freeze(["<i", "", "", "", ">", "</i>"]), [
          attribute("hidden", v),
          attribute("disabled", v),
          attribute("popover", v),
          attribute("data-v", v),
          "t",
        ] as never),
      ),
    ] as never);
  const html = await same(page);
  assert.ok(html.includes(`hidden="until-found"`) && html.includes("<i hidden disabled popover"));
});

test("raw records: URL attributes are checked exactly like encodeAttributeValue (unsafe → about:invalid)", async () => {
  const urls = [
    "/resume?rows=1",
    "#top",
    "?q=1",
    "./x",
    "https://e.com/?a=1&b='2'",
    "javascript:alert(1)",
    " java\tscript:alert(1)",
    "JaVaScRiPt:x",
    "vbscript:x",
    "data:image/png;base64,AAAA",
    "data:text/html,<b>",
    "/ok.png 1x, javascript:x 2x",
    "/a.png 1x, /b.png 2x",
  ];
  const page = () =>
    compiledTemplate(Object.freeze(["<div>", "</div>"]), [
      urls.map((url) =>
        compiledTemplate(Object.freeze(["<a", "", "", "", "", "><img", "", "></a>"]), [
          attribute("href", url),
          attribute("ping", url),
          attribute("data-u", url),
          attribute("href", url, "svg"),
          attribute("xlink:href", url, "svg"),
          attribute("src", url, "media"),
          attribute("srcset", url, "media"),
        ] as never),
      ),
    ] as never);
  const html = await same(page);
  assert.ok(!/href="\s*j/i.test(html) && html.includes('href="about:invalid#rivet"') && html.includes('src="data:image/png;base64,AAAA"'));
  assert.ok(html.includes('srcset="about:invalid#rivet"') && html.includes('srcset="/a.png 1x, /b.png 2x"'));
});

test("For rows are admitted once: promises and nested scopes inside compiled rows still resolve and render in order", async () => {
  const Ctx = createContext("none");
  const items = Array.from({ length: 40 }, (_, i) => i);
  const page = () =>
    Provider({
      token: Ctx,
      value: "ctx",
      children: () =>
        compiledTemplate(Object.freeze(["<ul>", "</ul>"]), [
          For({
            each: () => items,
            by: (i: number) => i,
            children: (i: () => number) =>
              compiledTemplate(Object.freeze(["<li", ">", "|", "|", "</li>"]), [
                attribute("data-i", i()),
                i() % 7 ? i() : (Promise.resolve(`p${i()}`) as never),
                () => useContext(Ctx) + i(),
                compiledTemplate(Object.freeze(["<a", ">x</a>"]), [attribute("href", "/i/" + i())]),
              ] as never),
          }),
        ] as never),
    } as never);
  const html = await same(page);
  assert.ok(html.includes('<li data-i="7">p7|ctx7|<a href="/i/7">x</a></li>'));
  assert.ok(html.includes('<li data-i="39">39|ctx39|<a href="/i/39">x</a></li>'));
});

test("attribute(): a null / undefined value is a null slot (no record) after the name check", async () => {
  assert.equal(attribute("data-a", null), null);
  assert.equal(attribute("title", undefined), null);
  assert.throws(() => attribute("onclick", undefined), /Unsafe attribute name/);
  assert.throws(() => attribute("innerHTML", null), /Unsafe attribute name/);
  assert.equal(attribute("viewBox", 0, "svg")!.name, "viewBox");
  const html = await renderToString(compiledTemplate(["<a", "", ">x</a>"], [attribute("href", "/x"), attribute("title", undefined)]) as never);
  assert.equal(html, '<a href="/x">x</a>');
});

test("raw records: a record past the slab's room takes the sized path (byte-identical across slab ends)", async () => {
  // Threshold 24 flushes every record but renews only below 24 bytes of room: records keep landing at the end of
  // a slab whose room is smaller than they are (the one-pass write runs out and retries sized + claimed).
  const cell = Object.freeze(["<td", ">", "</td>"]);
  const row = Object.freeze(["<tr", "", ">", "<th>", "</th></tr>"]);
  const page = () =>
    Array.from({ length: 2000 }, (_, i) =>
      compiledTemplate(row, [
        attribute("data-i", i),
        attribute("title", "row " + "é".repeat(i % 40)),
        compiledTemplate(cell, [attribute("class", i % 2 ? "odd" : "even"), "x".repeat(i % 60)]),
        "label " + i,
      ]),
    );
  const expected = (await renderToString(page())) as string;
  assert.ok(Buffer.byteLength(expected) > 2 * 128 * 1024, "spans several slabs");
  for (const threshold of [24, 4000, 16 * 1024]) assert.deepEqual(await viaWriter(page, threshold), Buffer.from(expected), `threshold ${threshold}`);
});

test("raw rows / records: strings past 64 units (clean → native encode, with &<> → generic) are byte-identical", async () => {
  const longs = [
    "a".repeat(65),
    "name@example.com ".repeat(8),
    "é€漢字𝄞".repeat(20),
    "lone \ud800 " + "z".repeat(70),
    "tail \udc00" + "y".repeat(70),
    "x".repeat(200) + "&" + "x".repeat(10),
    "<" + "x".repeat(80),
    "x".repeat(80) + ">",
    "x".repeat(66) + " & Q <a@b.c> ".repeat(5),
  ];
  const items = Array.from({ length: 300 }, (_, i) => [longs[i % longs.length]!, "s" + i, longs[(i * 7) % longs.length]!, i]);
  const row = Object.freeze(["<tr><td>", "</td><td>", "</td><td>", "</td><td>", "</td></tr>"]);
  const forPage = () =>
    compiledTemplate(Object.freeze(["<table>", "</table>"]), [
      For({ each: () => items, by: (r: unknown[]) => r[3], children: (r: () => unknown[]) => compiledTemplate(row, r() as never) }),
    ] as never);
  const recordPage = () => items.map((r) => compiledTemplate(row, r as never));
  const attributePage = () => items.map((r) => compiledTemplate(Object.freeze(["<p>", "</p>"]), [r[0]] as never));
  for (const page of [forPage, recordPage, attributePage]) {
    await same(page);
  }
  const html = (await renderToString(recordPage())) as string;
  assert.ok(html.includes("&lt;" + "x".repeat(80)) && html.includes("name@example.com ".repeat(8)));
});

test("putText: native-write fast path and per-char loop agree with escapeText + UTF-8 (fuzz: specials, non-ASCII, lone surrogates)", async () => {
  const { putText } = await import("../server-bytes.ts");
  const { escapeText } = await import("../escape.ts");
  const alphabet = ["a", "b", " ", "&", "<", ">", '"', "'", "é", "€", "漢", "𝄞", "\ud800", "\udc00", "\ud83d", "x", "y", "z"];
  let seed = 12345;
  const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let n = 0; n < 4000; n++) {
    const length = n % 5 === 0 ? 17 + Math.floor(next() * 200) : Math.floor(next() * 40);
    const weights = next() < 0.5 ? 3 : alphabet.length; // half the strings stay mostly ASCII-clean
    let text = "";
    for (let i = 0; i < length; i++) text += alphabet[Math.floor(next() * (next() < 0.9 ? weights : alphabet.length))]!;
    const expected = Buffer.from(escapeText(text));
    for (const bytes of [Buffer.alloc(text.length * 5 + 8), new Uint8Array(text.length * 5 + 8)]) {
      const end = putText(bytes, 3, text);
      assert.deepEqual(Buffer.from(bytes.subarray(3, end)), expected, JSON.stringify(text));
    }
  }
});
