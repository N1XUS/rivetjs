// Per-render id scope: a page renders the same `createId` ids whatever the process rendered before
// (reproducible HTML / ETags, docs-kit incremental prerender canaries), also concurrently and with
// async / streamed content.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Async, template } from "@rivetjs/runtime/server";
import { createId } from "@rivetjs/runtime/id";
import { renderDocument, renderPage, type DocumentShell } from "../server/render.ts";

const document: DocumentShell = () => ({ start: "<!doctype html><body>", end: "</body>" });
const input = { head: undefined, nonce: undefined, url: new URL("http://x/"), status: 200, styles: [] };
const manifest = { runtime: "/rt.js", symbols: {} } as never;

// A field (label + input related by id), as cdk components create them.
const Field = (label: string) => {
  const id = createId();
  return template(['<label for="', '">', '</label><input id="', '">'], [id, label, id]);
};
const later = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
// Sync fields, then two async boundaries resolving in `a` / `b` ms (fallbacks: streamed out of order).
const app = (a: number, b: number) => () => [
  Field("one"),
  Async({ load: () => later(a, "x"), fallback: () => "…", children: (x: unknown) => [Field(String(x)), Field("two")] } as never),
  Async({ load: () => later(b, "y"), fallback: () => "…", children: (y: unknown) => Field(String(y)) } as never),
  Field("three"),
];
const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!);

test("same page, same ids: renders before it and ids created outside a render do not shift them", async () => {
  const render = () => renderPage(app(1, 2) as never, input, { document }, { status: 200, headers: new Headers() }).text();
  const first = await render();
  for (let i = 0; i < 50; i++) createId();
  await render();
  const again = await render();
  assert.equal(again, first);
  assert.deepEqual([...ids(first)].sort(), ["rv0", "rv1", "rv2", "rv3", "rv4"], "one counter per render, from 0");
  assert.match(createId(), /^rvs\d+$/, "outside a render: the process-wide namespace");
});

test("resumable + streamed renders: concurrent requests get the same ids, whatever order their content resolves in", async () => {
  const render = (a: number, b: number) =>
    Promise.resolve(renderDocument(app(a, b) as never, input, { document, manifest, stream: {} }, { status: 200, headers: new Headers() })).then((r) =>
      r.text(),
    );
  const pages = await Promise.all([render(5, 1), render(1, 5), render(3, 3), render(5, 1)]);
  const reference = ids(pages[0]!);
  assert.equal(new Set(reference).size, 5, reference.join(" "));
  for (const page of pages) {
    const own = ids(page);
    assert.deepEqual([...own].sort(), [...reference].sort(), "same id set");
    assert.equal(new Set(own).size, own.length, "unique in the page");
  }
  assert.equal(pages[3], pages[0], "same timing: byte-identical");
});

test("hold renders (kit head) and plain writer renders scope ids too", async () => {
  const head = { head: () => undefined } as never;
  const held = () =>
    Promise.resolve(renderDocument(() => [Field("a"), Field("b")], input, { document, hold: head }, { status: 200, headers: new Headers() })).then((r) =>
      r.text(),
    );
  const a = await held();
  createId();
  assert.equal(await held(), a);
  assert.deepEqual(ids(a), ["rv0", "rv1"]);
});
