// DEPTH: class-instance records (own enumerable brands), string writers continuing one chunk through nested
// compiled records and primitive attributes (flushed before any user code), byte writers rendering nested
// records by direct recursion with skipped size passes on a failed raw path — all byte-identical to the
// per-piece output.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { createContext, useContext } from "@rivetjs/reactivity";
import { NodeStreamWriter } from "../node.ts";
import { renderToString, renderToWriter, compiledTemplate, template, attribute, Provider, ErrorBoundary } from "../server.ts";
import type { ServerValue } from "../server.ts";

const DIV = Object.freeze(["<div", ">", "</div>"]);
const chain = (depth: number, leaf: () => ServerValue, href?: (d: number) => unknown): ServerValue =>
  compiledTemplate(DIV, [
    href ? attribute("href", href(depth)) : attribute("data-d", depth % 3 ? depth : `d${depth}`),
    depth > 0 ? chain(depth - 1, leaf, href) : leaf(),
  ] as never);

async function viaBytes(page: () => ServerValue, threshold: number): Promise<string> {
  const parts: Buffer[] = [];
  const sink = new Writable({
    highWaterMark: 1 << 20,
    write(chunk: Buffer, _encoding, done) {
      parts.push(Buffer.from(chunk));
      done();
    },
  });
  const writer = new NodeStreamWriter(sink, { threshold });
  await renderToWriter(page(), writer);
  await writer.finish();
  await new Promise((resolve) => sink.end(resolve));
  return Buffer.concat(parts).toString();
}

test("records are class instances with own enumerable brands (spread keeps them)", () => {
  const record = compiledTemplate(Object.freeze(["<p>", "</p>"]), ["x"]);
  const brands = Object.getOwnPropertySymbols(record).map((s) => s.description);
  assert.deepEqual(brands, ["rivet.template", "rivet.compiled"]);
  assert.deepEqual(
    Object.getOwnPropertySymbols(template(["<i>", "</i>"], [1])).map((s) => s.description),
    ["rivet.template"],
  );
  const slot = attribute("title", "t");
  assert.deepEqual(
    Object.getOwnPropertySymbols({ ...slot }).map((s) => s.description),
    ["rivet.attribute"],
  );
  assert.equal(renderToString(compiledTemplate(Object.freeze(["<a", ">", "</a>"]), [{ ...slot, value: "u" } as never, "x"])), '<a title="u">x</a>');
});

test("string writers: nested compiled records and primitive attributes join one chunk, flushed before user code", () => {
  const seen: string[] = [];
  const writes: string[] = [];
  const page = chain(40, () => () => {
    seen.push(writes.join(""));
    return "leaf";
  });
  renderToWriter(page, { write: (chunk) => void writes.push(chunk) });
  const html = writes.join("");
  // Everything before the function child reached the writer before it ran, in one write.
  assert.equal(seen.length, 1);
  assert.equal(seen[0], html.slice(0, html.indexOf("leaf")));
  assert.equal(writes[0], seen[0]);
  assert.equal(html, renderToString(page));
  assert.ok(html.startsWith('<div data-d="40"><div data-d="d39"><div data-d="38">'));
});

test("string writers: an unsafe URL or object attribute value flushes and takes the checked path", () => {
  const writes: string[] = [];
  const coerced = { toString: () => (writes.push("|coerce|"), "/c") };
  const page = compiledTemplate(Object.freeze(["<p", "", "", ">", "</p>"]), [
    attribute("href", "javascript:alert(1)"),
    attribute("title", coerced),
    attribute("data-n", 3),
    compiledTemplate(Object.freeze(["<b", ">", "</b>"]), [attribute("src", "/x.png"), "t"]),
  ] as never);
  renderToWriter(page, { write: (chunk) => void writes.push(chunk) });
  assert.equal(writes.join(""), '<p href="about:invalid#rivet"|coerce| title="/c" data-n="3"><b src="/x.png">t</b></p>');
  // The coercion ran after the earlier output was written.
  assert.equal(writes.indexOf("|coerce|"), 2);
});

test("deep chains render identically through strings and byte writers (raw path skipped along a failed path)", async () => {
  const Ctx = createContext("none");
  const pages: (() => ServerValue)[] = [
    () => chain(30, () => "x"),
    () => chain(30, () => "y".repeat(80)),
    () => chain(25, () => Provider({ token: Ctx, value: "p", children: () => compiledTemplate(Object.freeze(["<i>", "</i>"]), [useContext(Ctx)]) })),
    () => chain(20, () => Promise.resolve<unknown>(chain(12, () => "async")) as ServerValue),
    () =>
      chain(
        20,
        () => "u",
        (d) => (d % 4 ? `/p/${d}` : d % 8 ? "javascript:x" : d),
      ),
    () => ErrorBoundary({ fallback: () => "failed", children: () => chain(20, () => [chain(9, () => "a"), () => chain(3, () => "b")] as never) }),
  ];
  for (const page of pages) {
    const expected = await renderToString(page());
    for (const threshold of [24, 16 * 1024]) assert.equal(await viaBytes(page, threshold), expected, `threshold ${threshold}`);
  }
});

test("a nested record's failure inside an ErrorBoundary leaves the enclosing records' rendering intact", async () => {
  const B = Object.freeze(["<b>", "</b>"]);
  const page = () =>
    compiledTemplate(Object.freeze(["<main>", "", "", "</main>"]), [
      chain(3, () =>
        ErrorBoundary({
          fallback: () => "failed",
          children: () =>
            chain(4, () => () => {
              throw new Error("boom");
            }),
        }),
      ),
      compiledTemplate(B, [compiledTemplate(B, ["after"])]),
      chain(1, () => "z"),
    ] as never);
  const expected =
    '<main><div data-d="d3"><div data-d="2"><div data-d="1"><div data-d="d0">failed</div></div></div></div><b><b>after</b></b><div data-d="1"><div data-d="d0">z</div></div></main>';
  assert.equal(await renderToString(page()), expected);
  for (const threshold of [24, 16 * 1024]) assert.equal(await viaBytes(page, threshold), expected);
});
