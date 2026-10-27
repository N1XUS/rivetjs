// Derived model, cold typing into a controlled field (BIG-UI-3 2026-10-27, cdk-docs text-area-events): text typed before
// the boundary's chunk ran is held with its input event. A replayed event before that input (the focus) re-runs the
// field's spread, which re-asserts the controlled value — still the server's "" while the input waits. The input's replay
// must leave the typed text (its own recorded state), not the "" the re-assert left: before, Enter then typed into an
// empty field. Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Area() {
  const text = signal("");
  const focused = signal(false);
  const log = signal<string[]>([]);
  const attrs = { value: () => text(), "data-focused": () => (focused() ? "true" : undefined) };
  return (
    <div>
      <textarea
        id="ta"
        {...attrs}
        onFocus={() => focused.set(true)}
        onInput={(e) => (text.set((e.target as HTMLTextAreaElement).value), log.set([...log(), "input:" + JSON.stringify(text())]))}
      />
      <input id="cb" type="checkbox" onChange={(e) => log.set([...log(), "checked:" + (e.target as HTMLInputElement).checked])} />
      <output id="log">{log().join(" ")}</output>
    </div>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/area.tsx", boundaries: ["Area"], independent: ["Area"] };

compiled(
  "cold typing: a replayed focus re-asserting the controlled value does not undo the held input's text; a cold checkbox click toggles once",
  async () => {
    const server = compile(SOURCE, { target: "server", filename: "area.tsx", resume } as never);
    const dom = compile(SOURCE, { target: "dom", filename: "area.tsx", resume } as never);
    assert.deepEqual(server.diagnostics, []);
    assert.deepEqual(dom.diagnostics, []);
    const { Area } = await importServer<{ Area: () => ServerValue }>(server.code);
    const symbols = { "src/area.tsx#Area": "/area.js" };
    const html = (await derivedToString(() => Area(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
    let release!: () => void;
    const cold = new Promise<void>((resolve) => (release = resolve));
    const served = {
      ...DERIVED_BUILD,
      "/": "<!doctype html><html><body>" + html + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/area.js": rewrite(dom.code),
    };
    await withPage(
      served,
      async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("http://rivet.test/");
        // Cold: focus + input are held (the chunk is held back).
        await page.fill("#ta", "hey");
        // A held click's recorded `checked` is pre-activation: its replayed default toggles it once (loader-data example).
        await page.click("#cb");
        release();
        await page.waitForFunction(() => document.querySelector("#log")!.textContent === 'input:"hey" checked:true');
        await page.waitForFunction(() => document.querySelector("#ta")!.getAttribute("data-focused") === "true");
        assert.equal(await page.inputValue("#ta"), "hey", "the typed text stays after the replay");
        await page.press("#ta", "Enter");
        await page.waitForFunction(() => document.querySelector("#log")!.textContent!.endsWith('input:"hey\\n"'));
        assert.equal(await page.inputValue("#ta"), "hey\n");
        assert.equal(await page.isChecked("#cb"), true, "the held checkbox click toggled once");
        assert.deepEqual(errors, []);
      },
      { delays: { "/area.js": cold } },
    );
  },
);
