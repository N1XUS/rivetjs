// A keyed signal read by the rows of a list nested in lazy rows (FUZZ-UI 2026-10-29, ui `/scheduler-crud`): the cdk
// Scheduler month grid renders its day cells in a list inside each week row, with a roving
// `tabindex={tabStop() === dayIndex ? 0 : -1}` (`tabStop` a computed over the keyed `focusDay` its `focusin` writes).
// The week list's row samples ran the nested list as a hole, so they never saw that read: a cold focus moved the tab stop
// in the materialised week only, the lazy weeks kept the old stop's `tabindex="0"`. Samples now render nested lists
// inline (their keyed reads wake the outer list). Flat lists (`#grid`, `#direct`) as controls.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const body = `
    const focusDay = SIG("focus", null);
    const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const tabStop = computed(() => focusDay() ?? 2);
    const tabStopDirect = () => focusDay() ?? 2;
    return OUTPUT(<main>
      <div id="grid" role="grid" onFocusIn={(e) => focusDay.set(Number(e.target.getAttribute("data-day")))}>
        <For each={days} by={(d) => d}>{(day) =>
          <div role="gridcell" data-day={String(day())} tabIndex={tabStop() === day() ? 0 : -1}>{String(day())}</div>
        }</For>
      </div>
      <div id="weeks" role="grid" onFocusIn={(e) => focusDay.set(Number(e.target.getAttribute("data-day")))}>
        <For each={[0, 1, 2]} by={(w) => w}>{(week) => {
          const start = week() * 4;
          const cellsOf = computed(() => [start, start + 1, start + 2, start + 3]);
          return <div role="row"><For each={cellsOf} by={(i) => i}>{(indexOf) => {
            const dayIndex = indexOf();
            return <div role="gridcell" data-day={String(dayIndex)} tabIndex={tabStop() === dayIndex ? 0 : -1}>{String(dayIndex)}</div>;
          }}</For></div>;
        }}</For>
      </div>
      <div id="direct" role="grid" onFocusIn={(e) => focusDay.set(Number(e.target.getAttribute("data-day")))}>
        <For each={days} by={(d) => d}>{(day) =>
          <div role="gridcell" data-day={String(day())} tabIndex={tabStopDirect() === day() ? 0 : -1}>{String(day())}</div>
        }</For>
      </div>
    </main>);
`;
const server = `import { For } from "@rivetjs/runtime/dom";
import { computed } from "@rivetjs/reactivity";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";
export function App() { const B = _rB("App", 1, {}, "focusin"); try {
${body.replaceAll("SIG(", "_rSig(").replace("OUTPUT(", "_rBOut(B,")}
} finally { _rBEnd(B); } }`;
const client = `import { For } from "@rivetjs/runtime/dom";
import { computed } from "@rivetjs/reactivity";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";
export function App() { return _b("App", () => {
${body.replaceAll("SIG(", "_sig(").replace("OUTPUT(", "(")}
}); }`;

test("derived lazy rows: a list nested in lazy rows follows a keyed write its rows read (roving tabindex)", async () => {
  const ssr = compile(server, { target: "server", filename: "roving.server.tsx" });
  const dom = compile(client, { target: "dom", filename: "roving.dom.tsx" });
  assert.deepEqual(ssr.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(ssr.code);
  const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js" } };
  const html = (await derivedToString(() => App(), { manifest })) as string;
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": "<!doctype html><body>" + html + "</body>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/page.js": rewrite(dom.code),
    },
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      const stops = (grid: string) => page.evaluate((g) => [...document.querySelectorAll(`#${g} [tabindex="0"]`)].map((n) => n.getAttribute("data-day")), grid);
      assert.deepEqual(await stops("grid"), ["2"]);
      // A cold click on a cell: its focusin writes the keyed signal (the clicked row materialises, the others stay lazy).
      await page.click('#grid [data-day="9"]');
      await page.waitForFunction(() => document.querySelector('#grid [data-day="2"]')!.getAttribute("tabindex") === "-1");
      assert.deepEqual(await stops("grid"), ["9"]);
      assert.deepEqual(await stops("direct"), ["9"]);
      assert.deepEqual(await stops("weeks"), ["9"]);
      // Live afterwards: the next focus moves the tab stop again (both grids share the signal).
      await page.click('#direct [data-day="5"]');
      await page.waitForFunction(() => document.querySelector('#grid [data-day="9"]')!.getAttribute("tabindex") === "-1");
      assert.deepEqual(await stops("grid"), ["5"]);
      assert.deepEqual(await stops("direct"), ["5"]);
      assert.deepEqual(await stops("weeks"), ["5"]);
      assert.deepEqual(errors, []);
    },
  );
});
