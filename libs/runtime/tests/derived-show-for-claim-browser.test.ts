// A `<For>` after a false `<Show>` (CLAIM 2026-10-28): the Show's empty server branch region
// (`<!--[--><!--rN[--><!--]--><!--]-->`) is the Show's, not the list's first row group. Before the fix the For hole
// claimed it, failed at the outer `]`, and the boundary rendered in the browser (every row re-created; a cdk DataGrid's
// top spacer row in `<tbody>`, `libs/ui` data-grid resumed sort / 10k scroll).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const body = `
    const items = SIG("items", [{ id: "a", text: "A", kids: ["x", "y"] }, { id: "b", text: "B", kids: [] }, { id: "c", text: "C", kids: ["z"] }]);
    const top = SIG("top", 0);
    const picked = SIG("picked", "");
    return OUTPUT(<main>
      <p id="picked">{picked()}</p>
      <table><tbody>
        <Show when={() => top() > 0}><tr class="spacer"><td>{top()}</td></tr></Show>
        <For each={items} by={(item) => item.id}>{(item) =>
          <tr data-id={item().id} onClick={() => picked.set(item().id)}><td>{item().text}</td><td>
            <Show when={() => item().kids.length > 5}><b>many</b></Show>
            <For each={() => item().kids} by={(k) => k}>{(k) => <i>{k()}</i>}</For>
          </td></tr>
        }</For>
        <Show when={() => top() > 1}><tr class="spacer"><td>end</td></tr></Show>
      </tbody></table>
      <ul>
        <Show when={() => top() > 0}><li class="spacer">top</li></Show>
        <For each={items} by={(item) => item.id}>{(item) => <li data-id={item().id}>{item().text}</li>}</For>
      </ul>
    </main>);
`;
const server = `import { For, Show } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";
export function App() { const B = _rB("App", 1, {}, "click"); try {
${body.replaceAll("SIG(", "_rSig(").replace("OUTPUT(", "_rBOut(B,")}
} finally { _rBEnd(B); } }`;
const client = `import { For, Show } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";
export function App() { return _b("App", () => {
${body.replaceAll("SIG(", "_sig(").replace("OUTPUT(", "(")}
}); }`;

test("derived For after a false Show: adopts its server rows (table body, list, inside a row)", async () => {
  const ssr = compile(server, { target: "server", filename: "claim.server.tsx" });
  const dom = compile(client, { target: "dom", filename: "claim.dom.tsx" });
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
      const warnings: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
      await page.goto("http://rivet.test/");
      await page.evaluate(() => {
        for (const n of document.querySelectorAll("tr, li, i")) (n as unknown as { srv: boolean }).srv = true;
      });
      // Row a: a false Show before its nested For (the row's own adopt run); row c after it.
      for (const id of ["a", "c"]) {
        await page.click(`tr[data-id="${id}"]`);
        await page.waitForFunction((id) => document.getElementById("picked")!.textContent === id, id);
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(
        warnings.filter((w) => w.includes("did not adopt")),
        [],
      );
      const fresh = await page.evaluate(() => [...document.querySelectorAll("tr, li, i")].filter((n) => !(n as unknown as { srv?: boolean }).srv).length);
      assert.equal(fresh, 0, "no row re-created");
      assert.deepEqual(await page.locator("tbody tr").allTextContents(), ["Axy", "B", "Cz"]);
    },
  );
});
