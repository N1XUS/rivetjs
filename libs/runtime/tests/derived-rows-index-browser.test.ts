// A derived list's rows adopted from the server follow their index (RESUME-FIX D1): a row the browser never ran (its
// server nodes, no binding) whose index changes — an earlier row removed, rows moved — must show the new index, like a
// row the browser created, keeping its server nodes (it adopts on that write). Before, the client `_for` kept every adopted
// row as "did not read its index" and its server text stayed "2." after the first row left.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const body = `
    const items = SIG("items", [{ id: "a" }, { id: "b" }, { id: "c" }]);
    return OUTPUT(<main>
      <button id="drop" onClick={() => items.set(items().slice(1))}>Drop first</button>
      <button id="swap" onClick={() => { const [x, y, ...rest] = items(); items.set([y, x, ...rest]); }}>Swap</button>
      <button id="add" onClick={() => items.set([{ id: "z" }, ...items()])}>Add first</button>
      <ul><For each={items} by={(item) => item.id}>{(item, index) => <li>{index() + 1}. {item().id}</li>}</For></ul>
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

async function page(run: (page: Page) => Promise<void>): Promise<void> {
  const ssr = compile(server, { target: "server", filename: "index.server.tsx" });
  const dom = compile(client, { target: "dom", filename: "index.dom.tsx" });
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
      assert.deepEqual(await rows(page), ["1. a", "2. b", "3. c"]);
      await run(page);
      assert.deepEqual(errors, []);
    },
  );
}
const rows = (page: Page): Promise<string[]> => page.locator("li").allTextContents();
const until = (page: Page, want: string[]): Promise<unknown> =>
  page
    .waitForFunction((want) => [...document.querySelectorAll("li")].map((li) => li.textContent).join("|") === want.join("|"), want, { timeout: 3000 })
    .catch(() => {});

test("derived For: removing the first item renumbers the adopted server rows, which keep their server nodes", async () => {
  await page(async (page) => {
    await page.evaluate(() => document.querySelectorAll("li").forEach((li, i) => ((li as unknown as { __t: number }).__t = i)));
    await page.click("#drop");
    await until(page, ["1. b", "2. c"]);
    assert.deepEqual(await rows(page), ["1. b", "2. c"]);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("li")].map((li) => (li as unknown as { __t?: number }).__t)), [1, 2]);
  });
});

test("derived For: moved adopted server rows show their new index", async () => {
  await page(async (page) => {
    await page.click("#swap");
    await until(page, ["1. b", "2. a", "3. c"]);
    assert.deepEqual(await rows(page), ["1. b", "2. a", "3. c"]);
    // Live from then on: a browser-created row before them shifts every index.
    await page.click("#add");
    await until(page, ["1. z", "2. b", "3. a", "4. c"]);
    assert.deepEqual(await rows(page), ["1. z", "2. b", "3. a", "4. c"]);
  });
});

test("derived For: an item added before the adopted server rows shifts their index", async () => {
  await page(async (page) => {
    await page.click("#add");
    await until(page, ["1. z", "2. a", "3. b", "4. c"]);
    assert.deepEqual(await rows(page), ["1. z", "2. a", "3. b", "4. c"]);
    await page.click("#drop");
    await until(page, ["1. a", "2. b", "3. c"]);
    assert.deepEqual(await rows(page), ["1. a", "2. b", "3. c"]);
  });
});
