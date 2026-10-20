// A component whose root is a `<Show>` on a resumed page (RESUME-BUGS #3, 2026-10-09): the Show's `when` read must not
// re-create the component (its body would run in the browser and lose its local state) — only the Show re-runs and
// switches its branch; the component never runs client-side. ui-docs chat-tool-approval wrapped its Show in a div.
// TODO: the compiler's root region (8c9caaf3) was reverted 2026-10-09 — components whose body sets up client code next to
// the root Show (cdk SharedElement enter / exit effects, ScrollArea scrollbars, TabPanel render-function panels) rely on
// being re-created; a root region needs an opt-in first (docs/guides/resumability.md). Kept as `test.todo` until then.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolUrls, symbolChunks } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
const run = () => { if (typeof document !== "undefined") (globalThis as { __runs?: number }).__runs = ((globalThis as { __runs?: number }).__runs ?? 0) + 1; };
export function Keyed() {
  run();
  const state = signal("a");
  return (
    <Show keyed when={state()}>
      {(s: () => string) => <button id="keyed" onClick={() => state.set(state() + "b")}>{s()}</button>}
    </Show>
  );
}
export function Toggle() {
  run();
  const open = signal(true);
  const n = signal(0);
  return (
    <Show when={open()} fallback={<button id="reopen" onClick={() => open.set(true)}>closed</button>}>
      <button id="close" onClick={() => { n.set(n() + 1); open.set(false); }}>open {n()}</button>
    </Show>
  );
}
export function Page() {
  return <main><Keyed /><section><Toggle /></section></main>;
}
`;

test.todo("a component whose root is a Show switches branches without re-running the component", async () => {
  const dom = compileResume(source, "dom", "src/root-show.tsx");
  const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/root-show.tsx").code);
  const groups = symbolChunks(dom.symbols);
  const manifest: ResumeManifest = {
    hash: "rootshow",
    runtime: "/rt.js",
    symbols: symbolUrls(dom.symbols),
  };
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  Object.assign(files, symbolModules(groups));
  const page = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";
  await withPage({ ...files, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    p.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await p.goto("http://rivet.test/");
    const text = (s: string) => p.evaluate((sel) => document.querySelector(sel)?.textContent ?? null, s);
    assert.equal(await text("#keyed"), "a");
    await p.click("#keyed");
    await p.waitForFunction(() => document.querySelector("#keyed")?.textContent === "ab", null, { timeout: 2000 });
    await p.click("#keyed");
    await p.waitForFunction(() => document.querySelector("#keyed")?.textContent === "abb", null, { timeout: 2000 });
    await p.click("#close");
    await p.waitForFunction(() => document.querySelector("#reopen")?.textContent === "closed", null, { timeout: 2000 });
    await p.click("#reopen");
    await p.waitForFunction(() => document.querySelector("#close")?.textContent === "open 1", null, { timeout: 2000 });
    assert.equal(await p.evaluate(() => (globalThis as { __runs?: number }).__runs ?? 0), 0);
    assert.deepEqual(errors, []);
  });
});
