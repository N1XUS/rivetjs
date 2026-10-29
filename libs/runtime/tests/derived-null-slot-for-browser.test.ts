// An array child holding a keyed `<For>` after another child (`[null, <For/>]`: a provider's content with an empty slot
// before the rows, cdk Tree's `{rootIndicator}{rows}` before TREE-LEVEL) whose rows re-render in their own effects
// (ranged rows: a row returns an accessor). The array's insertion must reconcile against the rows' live nodes, both its
// last node list and the new one (NULL-SLOT 2026-10-29): the list's node list cached in a cell was read before the rows
// re-rendered (a resumed page's rows adopt after it: rows doubled on a reorder), and the slot's flattened copy kept a
// re-rendered row's old nodes (client and resumed: the row's new nodes stayed behind when it was removed).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const body = `
    const keys = SIG("keys", ["d", "j", "s", "e"]);
    const names = SIG("names", { d: "D", j: "J", s: "S", e: "E" });
    const extra = () => null;
    return OUTPUT(<main>
      <button id="rename" onClick={() => names.set({ ...names(), s: "S2" })}>Rename</button>
      <button id="move" onClick={() => keys.set(["j", "s", "d", "e"])}>Move</button>
      <button id="insert" onClick={() => keys.set(["j", "x", "s", "d", "e"])}>Insert</button>
      <button id="drop" onClick={() => { names.set({ ...names(), s: "S3" }); keys.set(["j", "x", "d", "e"]); }}>Drop</button>
      <Wrap>{extra()}<For each={keys} by={(k) => k}>{(key) => () => { keys(); names(); return [null, <li>{key()}{untrack(() => names()[key()] ?? "")}</li>]; }}</For></Wrap>
    </main>);
`;
const wrap = `import { createContext, untrack } from "@rivetjs/reactivity";
const Ctx = createContext(0);
function Wrap(props) { return <ul><Provider token={Ctx} value={1}>{props.children}</Provider></ul>; }`;
const server = `import { For, Provider } from "@rivetjs/runtime/dom";
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";
${wrap}
export function App() { const B = _rB("App", 1, {}, "click"); try {
${body.replaceAll("SIG(", "_rSig(").replace("OUTPUT(", "_rBOut(B,")}
} finally { _rBEnd(B); } }`;
const client = `import { For, Provider } from "@rivetjs/runtime/dom";
import { _b, _sig } from "@rivetjs/runtime/dom-derived";
${wrap}
export function App() { return _b("App", () => {
${body.replaceAll("SIG(", "_sig(").replace("OUTPUT(", "(")}
}); }`;

test("derived For after a null child slot: re-rendered rows survive reorder, insert and removal", async () => {
  const ssr = compile(server, { target: "server", filename: "null-slot.server.tsx" });
  const dom = compile(client, { target: "dom", filename: "null-slot.dom.tsx" });
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
      const rows = () => page.locator("li").allTextContents();
      const until = (text: string) =>
        page
          .waitForFunction((text) => [...document.querySelectorAll("li")].map((li) => li.textContent).join(",") === text, text, { timeout: 2000 })
          .catch(() => {});
      assert.deepEqual(await rows(), ["dD", "jJ", "sS", "eE"]);
      await page.click("#rename");
      await until("dD,jJ,sS2,eE");
      assert.deepEqual(await rows(), ["dD", "jJ", "sS2", "eE"]);
      await page.click("#move");
      await until("jJ,sS2,dD,eE");
      assert.deepEqual(await rows(), ["jJ", "sS2", "dD", "eE"]);
      await page.click("#insert");
      await until("jJ,x,sS2,dD,eE");
      assert.deepEqual(await rows(), ["jJ", "x", "sS2", "dD", "eE"]);
      await page.click("#drop");
      await until("jJ,x,dD,eE");
      assert.deepEqual(await rows(), ["jJ", "x", "dD", "eE"]);
      assert.equal(await page.locator("ul").evaluate((ul) => ul.querySelectorAll("li").length), 4);
      assert.deepEqual(errors, []);
    },
  );
});

// The same array insertion on a client-rendered list: a row re-rendered in place, then removed, leaves no nodes behind.
const unit = `
import { mount, _tpl, _insert, _for } from "/dom.ts";
import { signal, batch } from "/reactivity.mjs";
export function run() {
  const target = document.body.appendChild(document.createElement("div"));
  const keys = signal(["d", "j", "s", "e"]), names = signal({ d: "D", j: "J", s: "S", e: "E" });
  mount(() => {
    const root = _tpl("<ul></ul>")();
    const row = (key) => () => { keys(); const li = document.createElement("li"); li.textContent = key() + names()[key()]; return li; };
    _insert(root, [null, _for({ each: keys, by: (k) => k, children: row })]);
    return root;
  }, target);
  const text = () => [...target.querySelectorAll("li")].map((li) => li.textContent).join(",");
  const out = [text()];
  batch(() => names.set({ ...names(), s: "S2" }));
  out.push(text());
  batch(() => keys.set(["j", "s", "d", "e"]));
  out.push(text());
  batch(() => names.set({ ...names(), s: "S3" }));
  batch(() => keys.set(["j", "d", "e"]));
  out.push(text());
  return out.join(" | ");
}
`;
test("client For after a null child slot: a re-rendered row leaves nothing behind when removed", async () => {
  await withPage({ "/": "<!doctype html><body></body>", "/unit.mjs": unit }, async (page) => {
    await page.goto("http://rivet.test/");
    const result = await page.evaluate(async () => ((await import("/unit.mjs" as string)) as { run(): string }).run());
    assert.equal(result, "dD,jJ,sS,eE | dD,jJ,sS2,eE | jJ,sS2,dD,eE | jJ,dD,eE");
  });
});
