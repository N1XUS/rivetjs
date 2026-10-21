// Streaming with a thenable that is not a Promise (the router's deferred loader handle, `load(fn, { defer: true })`:
// a frozen object whose only property is a non-enumerable `then`): `Async` takes it like a promise, the shell (fallback
// + the synchronous sibling after the boundary) is written before it settles, the content arrives as a segment after the
// shell's state; a resumable closure capturing the handle encodes it as an empty object.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
const source = `
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
export function Page({ data }) {
  const n = signal(0);
  return <main>
    <button onClick={() => (n.set(n() + 1), data)}>{n()}</button>
    <Async load={() => data} fallback={() => <i>wait</i>}>{(v) => <p onClick={() => n.set(v.count)}>{v.title}</p>}</Async>
    <aside>sync sibling</aside>
  </main>;
}
`;
const manifest = { hash: "h", runtime: "/rt.js", symbols: symbolUrls(compileResume(source, "dom").symbols) };
const mod = await importServer<{ Page(props: { data: PromiseLike<unknown> }): ServerValue }>(compileResume(source, "server").code);

test("stream: a non-Promise thenable streams like a promise; sync sibling in the shell; handle encodes as {}", async () => {
  let open!: (value: unknown) => void;
  const promise = new Promise((resolve) => (open = resolve));
  const handle = Object.freeze(Object.defineProperty({}, "then", { value: (ok: never, fail: never) => promise.then(ok, fail) })) as PromiseLike<unknown>;
  const chunks: string[] = [];
  let wake: () => void = () => {};
  const done = renderResumable(() => mod.Page({ data: handle }), { write: (chunk) => void (chunks.push(chunk), wake()) }, { manifest, stream: {} });
  while (!chunks.join("").includes("$rA=")) await new Promise<void>((resolve) => (wake = resolve));
  const shell = chunks.join("");
  assert.match(shell, /<i>wait<\/i><!--\]--><!--\]--><aside>sync sibling<\/aside><\/main>/);
  assert.doesNotMatch(shell, /data-patch="\d+">\{/);
  const state = JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(shell)![1]!) as { t: unknown[] };
  assert.ok(
    state.t.some((entry) => JSON.stringify(entry) === '{"o":[]}'),
    "the captured handle is an empty object: " + JSON.stringify(state.t),
  );
  open({ title: "late", count: 3 });
  await done;
  const html = chunks.join("");
  const at = html.indexOf("<template data-a=");
  assert.ok(at > html.indexOf('data-region="0"'), "segment after the shell state");
  assert.match(html.slice(at), /^<template data-a="\d+"><p data-r="\d+">late<\/p><\/template><script type="rivet\/state" data-patch="\d+">/);
});
