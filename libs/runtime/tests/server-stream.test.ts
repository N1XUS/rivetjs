import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";
import type { StreamingResumableOptions } from "@rivetjs/runtime/server-resume";

/** What a resumable factory returns (as declared by server-resume). */
type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
interface PageProps {
  a: number;
  b: number;
  fail?: boolean;
}
/** Boundary entry: [id, anchor, region, status]. */
type Boundary = [number, unknown, number, number];
interface ShellState {
  t: unknown[];
  a: Boundary[];
  b: [number, string | null, ...unknown[]][];
}
interface Patch {
  id: number;
  at: number;
  t0: number;
  t: unknown[];
  a: Boundary[];
  e: Record<string, unknown>;
  b: unknown[][];
}
type Gates = Record<string, Promise<string>>;
const scope = globalThis as unknown as { __gates?: Gates };

const source = `
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
const later = (ms, value, fail) => globalThis.__gates?.[value] ?? new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms));
export function Page({ a, b, fail }) {
  const n = signal(0);
  return <main>
    <h1 onClick={() => n.set(n() + 1)}>{n()}</h1>
    <section><Async load={() => later(a, "slow")} fallback={() => <i>wait a</i>}>{(v) => <button onClick={() => n.set(5)}>{v + n()}</button>}</Async></section>
    <aside><Async load={() => later(b, "fast", fail)} fallback={() => <i>wait b</i>}>{(v) =>
      <p>{v}<span><Async load={() => later(1, "inner")} fallback={() => <i>wait inner</i>}>{(w) => <b>{w}</b>}</Async></span></p>}</Async></aside>
  </main>;
}
`;
const symbols = compileResume(source, "dom").symbols;
const manifest = { hash: "h", runtime: "/rt.js", symbols: symbolUrls(symbols) };
const mod = await importServer<{ Page(props: PageProps): ServerValue }>(compileResume(source, "server").code);

const render = async (props: PageProps, options: Partial<StreamingResumableOptions> = {}): Promise<string> => {
  const chunks: string[] = [];
  await renderResumable(() => mod.Page(props), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {}, ...options });
  return chunks.join("");
};
const shellState = (html: string): ShellState => JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as ShellState;
const patches = (html: string): Patch[] =>
  [...html.matchAll(/<script type="rivet\/state" data-patch="(\d+)">(.*?)<\/script>/gs)].map(
    ([, id, json]) => ({ id: Number(id), at: html.indexOf(json!), ...(JSON.parse(json!) as Omit<Patch, "id" | "at">) }),
  );

// Explicit settle order: each gate opens once the previous boundary's patch is written.
const ordered = async (order: string[]): Promise<string> => {
  const gates: Gates = {}, open: Record<string, () => void> = {};
  for (const key of order) gates[key] = new Promise<string>((resolve) => (open[key] = () => resolve(key)));
  scope.__gates = gates;
  const chunks: string[] = [];
  let wake: () => void = () => {};
  const done = renderResumable(() => mod.Page({ a: 0, b: 0 }), { write: (chunk) => void (chunks.push(chunk), wake()) }, { manifest, stream: {} });
  try {
    // The shell (its stream add-on mentions data-patch too) is out before the first gate opens.
    while (!chunks.join("").includes("$rA=")) await new Promise<void>((resolve) => (wake = resolve));
    for (const key of order) {
      const patches = chunks.join("").split("data-patch=").length;
      open[key]!();
      while (chunks.join("").split("data-patch=").length === patches) await new Promise<void>((resolve) => (wake = resolve));
    }
    await done;
  } finally {
    scope.__gates = undefined;
  }
  return chunks.join("");
};

test("stream: fallbacks in the shell, content in completion order after it, nested after parent", async () => {
  const html = await ordered(["fast", "inner", "slow"]);
  const state = shellState(html);
  const shellEnd = html.indexOf("</script>", html.indexOf(state.t.length ? '"t":' : "rivet/state")) ;
  // Shell: both fallbacks inside boundary markers, pending boundaries listed, stream add-on present.
  assert.match(html, /<!--r(\d+)\[--><i>wait a<\/i><!--\]-->/);
  assert.match(html, /<!--r(\d+)\[--><i>wait b<\/i><!--\]-->/);
  assert.equal(state.a.length, 2);
  assert.ok(state.a.every(([, , , status]) => status === 0));
  assert.match(html, /data-stream="\d+,\d+,\d+ \d+,\d+,\d+"/);
  assert.match(html, /\$rA=/);
  // Boundary regions are recorded (re-creatable) even though nothing reactive was read.
  for (const [, , region] of state.a) assert.ok(state.b.some((entry) => entry[0] === region && entry[1] === "#"));
  const list = patches(html);
  assert.equal(list.length, 3);
  // b (5 ms) before its nested inner, then a (30 ms); each after the shell.
  const [b, inner, a] = list as [Patch, Patch, Patch];
  assert.ok(b.at > shellEnd);
  assert.deepEqual(b.a[0].slice(3), [1]);
  assert.equal(b.a[1][3], 0, "nested boundary pending in its parent's patch");
  assert.equal(inner.id, b.a[1][0]);
  assert.equal(a.id, state.a[0][0]);
  // Table alignment: each patch continues the previous table.
  let length = state.t.length;
  for (const patch of list) {
    assert.equal(patch.t0, length);
    length += patch.t.length;
  }
  // Content: template before its patch and swap call.
  const tpl = html.indexOf('<template data-a="' + a.id + '">');
  assert.ok(tpl > 0 && tpl < a.at && html.indexOf("$rA(" + a.id + ")") > a.at);
  assert.match(html, new RegExp('<template data-a="' + a.id + '"><button data-r="\\d+">(<!--r\\d+-->)?slow0'));
  // The streamed button's handler lives in the patch; its text binding belongs to the boundary region.
  const region = state.a[0][2];
  assert.equal(Object.keys(a.e).length, 1);
  assert.ok(a.b.every((entry) => entry[6] === region));
});

test("stream: a failed load continues in the browser; nested boundaries of it are never written", async () => {
  const html = await render({ a: 1, b: 2, fail: true });
  const state = shellState(html);
  const list = patches(html);
  const b = list.find((patch) => patch.id === state.a[1]![0])!;
  assert.deepEqual(b, { id: b.id, at: b.at, a: [[...state.a[1]!.slice(0, 3), 2]] });
  assert.doesNotMatch(html, /wait inner|inner/);
  assert.equal(list.length, 2);
});

test("stream: deadline continues unfinished boundaries; no deadline waits", async () => {
  const html = await render({ a: 200, b: 1 }, { stream: { deadline: 40 } });
  const state = shellState(html);
  const a = patches(html).find((patch) => patch.id === state.a[0]![0])!;
  assert.equal(a.a[0]![3], 2);
  assert.doesNotMatch(html, /slow0/);
  assert.match(await render({ a: 60, b: 1 }), /slow0/);
});

test("stream: request abort stops writing", async () => {
  const controller = new AbortController();
  const chunks: string[] = [];
  const done = renderResumable(() => mod.Page({ a: 100, b: 100 }), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {}, signal: controller.signal }) as Promise<void>;
  setTimeout(() => controller.abort(new Error("gone")), 20);
  await done.catch(() => {});
  const html = chunks.join("");
  assert.match(html, /wait a/);
  assert.doesNotMatch(html, /<template|type="rivet\/state" data-patch/);
});

test("stream: string rendering and renders without the option wait for every boundary", async () => {
  // resumableToString's declared options omit `stream`; the test checks it is ignored there.
  const streaming: StreamingResumableOptions = { manifest, stream: {} };
  const awaited = await resumableToString(() => mod.Page({ a: 5, b: 1 }), streaming);
  assert.match(awaited, /slow0/);
  assert.match(awaited, /<b>inner<\/b>/);
  assert.doesNotMatch(awaited, /wait|<template|\$rA/);
  const chunks: string[] = [];
  await renderResumable(() => mod.Page({ a: 5, b: 1 }), { write: (chunk) => void chunks.push(chunk) }, { manifest });
  assert.equal(chunks.join(""), awaited);
});
