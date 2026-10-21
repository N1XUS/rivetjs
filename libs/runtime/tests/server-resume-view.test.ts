// Segment views (`server-resume.ts` `View`, PPR-T6): a streamed segment's recorder is a `View` over the root — own record
// lists and scope cursor, every other member read through to the root (`SHARED` accessors). A Recorder member added
// without an own slot on `View` or an entry in `SHARED` would read `undefined` on views: this test reflects over the
// root recorder's own keys during a streamed render (shell hook installed: `thaw` set too) and fails on such a member.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { shellHook } from "@rivetjs/runtime/server-shell";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
const source = `
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
import { _shellRecorder } from "@rivetjs/runtime/server-resume";
function Probe(props: { v: string }) {
  (globalThis as { __viewProbe?: (view: unknown) => void }).__viewProbe?.(_shellRecorder());
  const open = signal(false);
  return <em onClick={() => open.set(!open())}>{props.v}</em>;
}
export function Page() {
  const n = signal(0);
  return <main>
    <button onClick={() => n.set(n() + 1)}>{n()}</button>
    <Async load={() => Promise.resolve("late")} fallback={() => <i>wait</i>}>{(v: string) => <Probe v={v} />}</Async>
  </main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server").code);
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };

test("segment views: every own member of the root recorder is a view slot or a shared accessor (View / SHARED)", async () => {
  let seen: { view: object; root: object } | null = null;
  (globalThis as { __viewProbe?: (view: unknown) => void }).__viewProbe = (view) => {
    const root = (view as { up?: object }).up;
    if (root) seen = { view: view as object, root };
  };
  try {
    let html = "";
    await renderResumable(() => server.Page(), { write: (chunk: string) => void (html += chunk) }, { manifest, stream: {}, shell: shellHook({}) });
    assert.match(html, /<em[^>]*>late<\/em>/);
  } finally {
    delete (globalThis as { __viewProbe?: unknown }).__viewProbe;
  }
  assert.ok(seen, "the hole rendered under a segment view");
  const { view, root } = seen as { view: object; root: object };
  const proto = Object.getPrototypeOf(view) as object;
  const keys = Object.keys(root);
  assert.ok(keys.length > 20, "the root's members: " + keys.join());
  const missing = keys.filter((key) => !Object.hasOwn(view, key) && typeof Object.getOwnPropertyDescriptor(proto, key)?.get !== "function");
  assert.deepEqual(missing, [], "Recorder members neither own on View nor in SHARED (add them to `SHARED` in server-resume.ts)");
  // Shared members read the root's value on the view.
  for (const key of keys) if (!Object.hasOwn(view, key)) assert.equal((view as Record<string, unknown>)[key], (root as Record<string, unknown>)[key], key);
});
