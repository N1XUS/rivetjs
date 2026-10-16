// An eager JSX `fallback` of a `Show` / `Switch` that the server did not render (RESUME-BUGS follow-up, 2026-10-09): it was
// evaluated with the props, so its bindings / handlers were recorded for elements the page never received, and the first
// change of a signal it read threw "Missing resumable text N". The resume server target lowers it lazily (a thunk the
// Show calls only for the fallback branch); a shown fallback still resumes and updates in place.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { Show, Switch, Match } from "@rivetjs/runtime/dom";
export function Page() {
  const open = signal(true);
  const n = signal(0);
  return (
    <main>
      <button id="inc" onClick={() => n.set(n() + 1)}>inc</button>
      <button id="toggle" onClick={() => open.set(!open())}>toggle</button>
      <section id="show">
        <Show when={open()} fallback={<b id="fb">closed {n()}</b>}>
          <i>open {n()}</i>
        </Show>
      </section>
      <section id="switch">
        <Switch fallback={<b>none {n()}</b>}>
          <Match when={open()}><i>yes {n()}</i></Match>
        </Switch>
      </section>
      <section id="shown">
        <Show when={!open()} fallback={<b>fallback {n()}</b>}>
          <i>content</i>
        </Show>
      </section>
    </main>
  );
}
`;

test("an unrendered eager fallback records nothing; a rendered one resumes", async () => {
  const dom = compileResume(source, "dom", "src/fallback.tsx");
  const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/fallback.tsx").code);
  const groups: Record<string, ResumeSymbol[]> = {};
  for (const symbol of dom.symbols) (groups["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  const manifest: ResumeManifest = {
    hash: "fallback",
    runtime: "/rt.js",
    symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  };
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  for (const [path, symbols] of Object.entries(groups)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const page = "<!doctype html><html><head></head><body>" + (await resumableToString(() => server.Page(), { manifest })) + "</body></html>";
  await withPage({ ...files, "/": page }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    p.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await p.goto("http://rivet.test/");
    const state = () => p.evaluate(() => ["show", "switch", "shown"].map((id) => document.getElementById(id)!.textContent!.trim()));
    assert.deepEqual(await state(), ["open 0", "yes 0", "fallback 0"]);
    await p.click("#inc");
    await p.waitForFunction(() => document.getElementById("show")!.textContent!.trim() === "open 1", null, { timeout: 2000 });
    assert.deepEqual(await state(), ["open 1", "yes 1", "fallback 1"]);
    await p.click("#toggle");
    await p.waitForFunction(() => document.getElementById("show")!.textContent!.trim() === "closed 1", null, { timeout: 2000 });
    assert.deepEqual(await state(), ["closed 1", "none 1", "content"]);
    await p.click("#inc");
    await p.waitForFunction(() => document.getElementById("show")!.textContent!.trim() === "closed 2", null, { timeout: 2000 });
    assert.deepEqual(await state(), ["closed 2", "none 2", "content"]);
    assert.deepEqual(errors, []);
  });
});
