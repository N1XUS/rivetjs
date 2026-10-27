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

// COLD-FIX-B: keys typed before boot all went to the element focused then (held: no native default moved focus). A
// replayed key whose handler moves focus sends the next held keys of that element to where focus went, as on a loaded
// page (cdk date segments advance after two digits: a cold "0101" typed the month twice). A held key dispatched to
// another element (the user's own focus move in between) keeps its target.
const SEGMENTS = `import { signal } from "@rivetjs/reactivity";
export function Segments() {
  const a = signal("");
  const b = signal("");
  const c = signal("");
  const typeInto = (e: KeyboardEvent, s: { (): string; set(v: string): void }, next: string | null) => {
    e.preventDefault();
    s.set(s() + e.key);
    if (next && s().length === 2) (document.getElementById(next) as HTMLElement).focus();
  };
  return (
    <div data-rk="0 1 2 3 4 5 6 7 8 9">
      <span id="a" tabIndex={0} onKeyDown={(e) => typeInto(e, a, "b")}>{a()}</span>
      <span id="b" tabIndex={0} onKeyDown={(e) => typeInto(e, b, null)}>{b()}</span>
      <span id="c" tabIndex={0} onKeyDown={(e) => typeInto(e, c, null)}>{c()}</span>
    </div>
  );
}
`;

compiled("cold keys follow the focus their replays move; a key sent to another element keeps its target", async () => {
  const resume2 = { module: "src/segments.tsx", boundaries: ["Segments"], independent: ["Segments"] };
  const server = compile(SEGMENTS, { target: "server", filename: "segments.tsx", resume: resume2 } as never);
  const dom = compile(SEGMENTS, { target: "dom", filename: "segments.tsx", resume: resume2 } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Segments } = await importServer<{ Segments: () => ServerValue }>(server.code);
  const symbols = { "src/segments.tsx#Segments": "/segments.js" };
  const html = (await derivedToString(() => Segments(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  let release!: () => void;
  const cold = new Promise<void>((resolve) => (release = resolve));
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/segments.js": rewrite(dom.code),
  };
  await withPage(
    served,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.focus("#a");
      for (const key of "0123") await page.keyboard.press(key);
      // The user moves focus to c (programmatic here: the loader holds no focus move) and types there.
      await page.focus("#c");
      await page.keyboard.press("9");
      release();
      await page.waitForFunction(() => document.querySelector("#c")!.textContent === "9");
      const text = await page.evaluate(() => ["a", "b", "c"].map((id) => document.getElementById(id)!.textContent).join("|"));
      assert.equal(text, "01|23|9");
      assert.deepEqual(errors, []);
    },
    { delays: { "/segments.js": cold } },
  );
});
