// Rows of one lazy list can differ in shape (a collection of static JSX children: ui Breadcrumbs.Item links next to a
// render-function item). A keyed signal read by a row shaped unlike the first one (a middle row of a short list, or the last
// row) must wake the list: before UI-BREADCRUMB the sample dropped those reads and the resumed row kept the server text.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const page = (keys: string[], reader: string) => {
  const body = `
    const label = SIG("label", "old");
    return OUTPUT(<main>
      <button id="set" onClick={() => label.set("new")}>Set</button>
      <ul><For each={() => ${JSON.stringify(keys)}} by={(key) => key}>{(key) =>
        key() === ${JSON.stringify(reader)} ? <li><b>{label()}</b></li> : <li><a href={"#" + key()}>{key()}</a><i>{key()}</i></li>
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
  return { server, client };
};

for (const [name, keys, reader] of [
  ["a middle row", ["a", "b", "c"], "b"],
  ["the last row", ["a", "b", "c"], "c"],
] as const) {
  test(`derived For: a keyed read in ${name} shaped unlike the first row wakes the list`, async () => {
    const { server, client } = page([...keys], reader);
    const ssr = compile(server, { target: "server", filename: "mixed.server.tsx" });
    const dom = compile(client, { target: "dom", filename: "mixed.dom.tsx" });
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
      async (p) => {
        const errors: string[] = [];
        p.on("pageerror", (error) => errors.push(error.message));
        await p.goto("http://rivet.test/");
        assert.equal(await p.textContent("b"), "old");
        await p.click("#set");
        await p.waitForFunction(() => document.querySelector("b")?.textContent === "new", null, { timeout: 2000 }).catch(() => {});
        assert.deepEqual(errors, []);
        assert.equal(await p.textContent("b"), "new");
      },
    );
  });
}
