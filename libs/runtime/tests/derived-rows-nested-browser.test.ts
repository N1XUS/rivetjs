// A newly built row's nested For must not consume the parent list's server rows. Before the
// adoption hand-off was single-use, it stamped the parent's removed rows and corrupted its key map.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const body = `
    const items = SIG("items", [{ id: "a", text: "old" }, { id: "b", text: "kept" }]);
    return OUTPUT(<main>
      <button id="shrink" onClick={() => items.set([{ id: "a", text: "new" }])}>Shrink</button>
      <button id="restore" onClick={() => items.set([{ id: "a", text: "new" }, { id: "b", text: "back" }])}>Restore</button>
      <ul><For each={items} by={(item) => item.id}>{(item) =>
        <li data-id={item().id}><b>{item().text}</b><For each={() => ["start", "end"]} by={(edge) => edge}>{(edge) => <i>{edge()}</i>}</For></li>
      }</For></ul>
    </main>);
`;
const server = `import { For } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";
export function App() { const B = _rB("App", 1, {}, "click"); try {
${body.replaceAll("SIG(", "_rSig(").replace("OUTPUT(", "_rBOut(B,")}
} finally { _rBEnd(B); } }`;
const client = `import { For } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";
export function App() { return _b("App", () => {
${body.replaceAll("SIG(", "_sig(").replace("OUTPUT(", "(")}
}); }`;

test("derived For: a new nested list cannot adopt its parent's rows during the first reconcile", async () => {
  const ssr = compile(server, { target: "server", filename: "nested.server.tsx" });
  const dom = compile(client, { target: "dom", filename: "nested.dom.tsx" });
  assert.deepEqual(ssr.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(ssr.code);
  const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js" } };
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": "<!doctype html><body>" + (await derivedToString(() => App(), { manifest })) + "</body>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/page.js": rewrite(dom.code),
    },
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.click("#shrink");
      await page.waitForFunction(() => document.querySelectorAll("li").length === 1);
      assert.equal(await page.textContent("ul"), "newstartend");
      await page.click("#restore");
      await page.waitForFunction(() => document.querySelectorAll("li").length === 2, null, { timeout: 2000 }).catch(() => {});
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.locator("li").allTextContents(), ["newstartend", "backstartend"]);
    },
  );
});
