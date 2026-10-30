// Island CSS is independent of hydration policy: emit before markup, dedupe by request, never inside inert patches.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import { page } from "./harness.ts";
import { hold, release } from "./fixtures/style-gate.ts";

type Page = () => ReturnType<Parameters<typeof resumableToString>[0]>;
const { mod, manifest } = await page<Record<string, Page>>(
  `
import { Suspense, Async } from "@rivetjs/runtime/server";
import { gate } from "CSS-GATE";
import { _island } from "@rivetjs/bridge/server";
import { fake, Counter as CounterImpl, Later as LaterImpl } from "./fake-adapter.ts";
const A = { id: "src/A.fake#default", c: CounterImpl, a: fake };
const B = { id: "src/B.fake#default", c: CounterImpl, a: fake };
const NATIVE = { id: "src/Native.fake#default", c: async () => ({ html: "<p>native child</p>", cssModules: ["src/Lazy.fake"] }), a: fake };
const CONTROLLED = { id: "src/Later.fake#default", c: async () => { await gate(); return "<p>controlled</p>"; }, a: fake };
const L = { id: "src/Later.fake#default", c: LaterImpl, a: fake };
function First(props) { return <>{_island(props, A)}</>; }
function Second(props) { return <>{_island(props, B)}</>; }
function Later(props) { return <>{_island(props, L)}</>; }
export function Static() { return <main><First count={1} /><First count={2} /><Second count={3} /></main>; }
export function Plain() { return <main>plain</main>; }
export function Stream() { return <main><Suspense fallback={() => <i>wait</i>}>{() => <Later text="resolved" ms={15} />}</Suspense><Second count={4} /></main>; }
export function Native() { return <main><Suspense fallback={() => <i>native wait</i>}>{() => <>{_island({}, NATIVE)}</>}</Suspense></main>; }
export function Controlled() { return <main><Suspense fallback={() => <i>held</i>}>{() => <>{_island({}, CONTROLLED)}</>}</Suspense></main>; }
export function LateDiscovered() { return <main><Suspense fallback={() => <i>wait</i>}>{() => <Async load={() => new Promise((done) => setTimeout(() => done(1), 15))}>{() => <First count={9} />}</Async>}</Suspense></main>; }
`,
  { links: { "CSS-GATE": new URL("./fixtures/style-gate.ts", import.meta.url).href } },
);
const styled = {
  ...manifest,
  moduleCss: { "src/Lazy.fake": ["/assets/lazy.css"] },
  islandCss: {
    "src/A.fake#default": ["/assets/shared.css", "/assets/a.css"],
    "src/B.fake#default": ["/assets/shared.css", "/assets/b.css"],
    "src/Later.fake#default": ["/assets/shared.css", "/assets/later.css"],
  },
};
const links = (html: string) => [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g)].map((match) => match[1]);

test("static islands link their CSS before markup, dedupe shared files and reset each request", async () => {
  for (let request = 0; request < 2; request++) {
    const html = (await resumableToString(() => mod.Static!(), { manifest: styled })) as string;
    assert.deepEqual(links(html), ["/assets/shared.css", "/assets/a.css", "/assets/b.css"]);
    assert.ok(html.indexOf("/assets/a.css") < html.indexOf("<rivet-island"));
    assert.ok(html.indexOf("/assets/b.css") < html.indexOf("<rivet-island"));
  }
});

test("a page without islands stays byte-identical with an island CSS manifest present", async () => {
  assert.equal(await resumableToString(() => mod.Plain!(), { manifest: styled }), await resumableToString(() => mod.Plain!(), { manifest }));
  assert.deepEqual(links((await resumableToString(() => mod.Static!(), { manifest })) as string), []);
});

test("stylesheet hrefs are attribute escaped and carry the render's sanitised CSP nonce", async () => {
  const html = (await resumableToString(() => mod.Static!(), {
    manifest: { ...styled, islandCss: { "src/A.fake#default": ['/assets/a.css?x=1&y="<'] } },
    nonce: "safe-123!",
  })) as string;
  assert.match(html, /<link rel="stylesheet" href="\/assets\/a.css\?x=1&amp;y=&quot;&lt;" nonce="safe-123">/);
});

test("streamed island CSS is in the shell before fallback and content, shared CSS is linked once", async () => {
  const chunks: string[] = [];
  const done = renderResumable(() => mod.Stream!(), { write: (chunk) => void chunks.push(chunk) }, { manifest: styled, stream: {} });
  const shell = chunks.join("");
  assert.match(shell, /later\.css/);
  assert.match(shell, /<i>wait<\/i>/);
  assert.doesNotMatch(shell, /<p>resolved<\/p>/);
  await done;
  const html = chunks.join("");
  assert.deepEqual(links(html).sort(), ["/assets/b.css", "/assets/later.css", "/assets/shared.css"]);
  assert.ok(html.indexOf("/assets/later.css") < html.indexOf('<template data-s="'));
  assert.doesNotMatch(html, /<template[^>]*>[^]*?<link rel="stylesheet"[^]*?<\/template>/);
});

test("CSS of an island discovered after an Async resolves flushes outside and before its template and swap", async () => {
  const chunks: string[] = [];
  await renderResumable(() => mod.LateDiscovered!(), { write: (chunk) => void chunks.push(chunk) }, { manifest: styled, stream: {} });
  const html = chunks.join("");
  const sheet = html.indexOf("/assets/a.css"),
    template = html.indexOf('<template data-s="'),
    swap = html.indexOf(">$rS(");
  assert.ok(sheet >= 0 && sheet < template && template < swap, html);
  assert.deepEqual(links(html), ["/assets/shared.css", "/assets/a.css"]);
  assert.doesNotMatch(html, /<template[^>]*>[^]*?<link rel="stylesheet"[^]*?<\/template>/);
});

test("a held island payload cannot be sent before its stylesheet links are in the shell", async () => {
  hold();
  const chunks: string[] = [];
  const pending = renderResumable(() => mod.Controlled!(), { write: (chunk) => void chunks.push(chunk) }, { manifest: styled, stream: {} });
  try {
    const shell = chunks.join("");
    assert.deepEqual(links(shell), ["/assets/shared.css", "/assets/later.css"]);
    assert.match(shell, /<i>held<\/i>/);
    assert.doesNotMatch(shell, /controlled|<template/);
  } finally {
    release();
  }
  await pending;
  const html = chunks.join("");
  assert.ok(html.indexOf("/assets/later.css") < html.indexOf('<template data-s="'));
  assert.match(html, /<p>controlled<\/p>/);
});

test("native async-rendered module CSS metadata links only modules actually used, before streamed content", async () => {
  const chunks: string[] = [];
  await renderResumable(() => mod.Native!(), { write: (chunk) => void chunks.push(chunk) }, { manifest: styled, stream: {} });
  const html = chunks.join("");
  assert.deepEqual(links(html), ["/assets/lazy.css"]);
  assert.ok(html.indexOf("/assets/lazy.css") < html.indexOf('<template data-s="'));
  assert.doesNotMatch(html, /<template[^>]*>[^]*?<link rel="stylesheet"[^]*?<\/template>/);
  assert.match(html, /<p>native child<\/p>/);
  assert.equal(await resumableToString(() => mod.Plain!(), { manifest: styled }), await resumableToString(() => mod.Plain!(), { manifest }));
});
