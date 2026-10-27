// Derived model, cold context menu (COLD-CTXMENU): a `contextmenu` before the boundary's chunk ran is held — the browser's
// own menu canceled — when the target is inside the nearest `data-cm` (cdk MenuTrigger `trigger="contextMenu"`: ui
// ContextMenu's first right click showed the native menu over the replayed one); the runtime then replays it. A listening
// element without `data-cm` (a link) keeps the browser's menu: nothing says its handler cancels it.
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Menus() {
  const opened = signal(0);
  const seen = signal("");
  return (
    <div id="box">
      <div
        id="area"
        data-cm=""
        onContextMenu={(e) => {
          e.preventDefault();
          opened.set(opened() + 1);
        }}
      >
        <span id="inner">Right click here</span>
      </div>
      <a id="link" href="/elsewhere" onContextMenu={() => seen.set(seen() + "link")}>
        link
      </a>
      <output id="out">{opened()}</output>
      <output id="seen">{seen()}</output>
    </div>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/menus.tsx", boundaries: ["Menus"], independent: ["Menus"] };

compiled("cold contextmenu: inside data-cm the browser's menu is held and the replay opens the widget's; elsewhere it shows", async () => {
  const server = compile(SOURCE, { target: "server", filename: "menus.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "menus.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Menus } = await importServer<{ Menus: () => ServerValue }>(server.code);
  const symbols = { "src/menus.tsx#Menus": "/menus.js" };
  const html = (await derivedToString(() => Menus(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, preload: { lean: true } } as never)) as string;
  assert.match(html, /data-events="[^"]*\bcontextmenu\b/, "the page's delegated types include contextmenu");
  let release!: () => void;
  const cold = new Promise<void>((resolve) => (release = resolve));
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/menus.js": rewrite(dom.code),
  };
  await withPage(
    served,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      // Each trusted contextmenu's default once its dispatch ended (the loader's capture listener runs before this one's
      // bubbling phase; read after dispatch, as the browser decides whether its own menu shows).
      await page.evaluate(() => {
        const w = window as unknown as { cm: [string, Event][] };
        w.cm = [];
        addEventListener("contextmenu", (e) => e.isTrusted && w.cm.push([(e.target as Element).id, e]), true);
      });
      const prevented = () =>
        page.evaluate(() => (window as unknown as { cm: [string, Event][] }).cm.map(([id, e]) => id + ":" + e.defaultPrevented).join(" "));
      // Cold (the chunk is held back): a right click on the area's child is held — no native menu.
      await page.click("#inner", { button: "right" });
      // A right click on the link (its record listens, no data-cm): the browser's menu shows.
      await page.click("#link", { button: "right" });
      assert.equal(await prevented(), "inner:true link:false");
      release();
      // The replay runs the handlers: the area's menu opens, the link's handler sees its event.
      await page.waitForFunction(() => document.querySelector("#out")!.textContent === "1");
      await page.waitForFunction(() => document.querySelector("#seen")!.textContent === "link");
      // Live now: the handler cancels the browser's menu itself.
      await page.click("#area", { button: "right" });
      await page.waitForFunction(() => document.querySelector("#out")!.textContent === "2");
      assert.equal(await prevented(), "inner:true link:false area:true");
      assert.deepEqual(errors, []);
    },
    { delays: { "/menus.js": cold } },
  );
});
