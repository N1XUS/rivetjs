// Derived model, cold keys (SLIDER-KEY): a keydown before the boundary's chunk ran is held — its default prevented — when
// the target's nearest `data-rk` lists the key (cdk slider thumbs, spin fields, composites); the runtime then replays it.
// A text field without its own `data-rk` inside a `data-rk` container keeps its caret keys native. A value the replayed
// handler writes into the target stays (the replay restores the dispatch-time form state only when it wrote one itself).
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Keys() {
  const n = signal(0);
  const typed = signal("");
  return (
    <div id="box" data-rk="ArrowUp PageUp">
      <input
        id="range"
        type="range"
        min="0"
        max="100"
        step="1"
        value={n()}
        data-rk="ArrowUp PageUp"
        onKeyDown={(e) => {
          if (e.key === "PageUp") (e.preventDefault(), n.set(n() + 15));
        }}
      />
      <input
        id="field"
        type="text"
        value="ab"
        onKeyDown={(e) => {
          typed.set(typed() + e.key);
          if (e.key === "ArrowUp") (e.target as HTMLInputElement).value = "up";
        }}
      />
      <output id="out">{n()}</output>
      <output id="typed">{typed()}</output>
    </div>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/keys.tsx", boundaries: ["Keys"], independent: ["Keys"] };

compiled("cold keys: the nearest data-rk holds a key (no native step) and the replay applies it; text fields keep caret keys", async () => {
  const server = compile(SOURCE, { target: "server", filename: "keys.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "keys.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Keys } = await importServer<{ Keys: () => ServerValue }>(server.code);
  const symbols = { "src/keys.tsx#Keys": "/keys.js" };
  const html = (await derivedToString(() => Keys(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  let release!: () => void;
  const cold = new Promise<void>((resolve) => (release = resolve));
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/keys.js": rewrite(dom.code),
  };
  await withPage(
    served,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      // Which cold keydowns the loader held (its capture listener prevents their default before this bubbling one runs).
      await page.evaluate(() => {
        const w = window as unknown as { held: string[] };
        w.held = [];
        addEventListener("keydown", (e) => e.defaultPrevented && w.held.push((e.target as Element).id + ":" + e.key));
      });
      // Cold (the chunk is held back): PageUp on the range input is held — the native range does not step by its page size.
      await page.focus("#range");
      await page.keyboard.press("PageUp");
      assert.equal(await page.inputValue("#range"), "0", "held: no native step");
      // A text field inside the data-rk container lists no keys of its own: its caret keys act natively (not held).
      await page.focus("#field");
      await page.keyboard.press("End");
      const caret = await page.evaluate(() => (document.querySelector("#field") as HTMLInputElement).selectionStart);
      assert.equal(caret, 2, "End moved the caret natively");
      await page.keyboard.press("ArrowUp");
      assert.deepEqual(await page.evaluate(() => (window as unknown as { held: string[] }).held), ["range:PageUp"], "only the range's listed key is held");
      release();
      // The replay runs the handlers: the held PageUp steps by 15, the field's handler sees both keys and its write stays.
      await page.waitForFunction(() => document.querySelector("#out")!.textContent === "15");
      assert.equal(await page.inputValue("#range"), "15");
      await page.waitForFunction(() => document.querySelector("#typed")!.textContent === "EndArrowUp");
      assert.equal(await page.inputValue("#field"), "up", "a value the replayed handler wrote is kept");
      assert.deepEqual(errors, []);
    },
    { delays: { "/keys.js": cold } },
  );
});
