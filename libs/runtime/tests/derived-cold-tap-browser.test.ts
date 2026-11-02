// WebKit touch (COLD-WK-LINUX 2026-11-02): a tap synthesizes mouse events and `click` only when the node or an ancestor
// responds to clicks itself. Delegated handlers listen on the document, which does not count, so a tap on a plain element
// with `onClick` fired pointer + touch events and then nothing, cold or warm. The WebKit cases need a WebKit whose tap path
// has that check (Linux; Playwright's macOS WebKit always clicks); the Chromium cases pin the listeners on every host.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, hasWebkit, rewrite, withPage } from "./resume/harness.ts";

const source = `import { signal } from "@rivetjs/reactivity";
export function Tap() {
  const count = signal(0);
  return <main>
    <div id="plain" style={{ width: "200px", height: "60px" }} onClick={() => {
      count.update((value) => value + 1);
      if (!document.getElementById("overlay"))
        document.body.append(<div id="overlay" style={{ position: "fixed", top: "0", right: "0", width: "200px", height: "200px" }} onClick={() => count.update((value) => value + 10)}><span id="inside">Overlay</span></div> as Node);
    }}><span id="inner">Tap</span></div>
    <output id="count">{count()}</output>
  </main>;
}
export function Quiet() {
  const text = signal("");
  return <section>
    <p id="quiet" style={{ height: "60px" }}>No click here</p>
    <input id="field" onInput={(event) => text.set(event.currentTarget.value)} />
    <output>{text()}</output>
  </section>;
}`;

const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/tap.tsx", boundaries: ["Tap", "Quiet"], independent: ["Tap", "Quiet"] };

async function files() {
  const server = compile(source, { target: "server", filename: "tap.tsx", resume } as never);
  const dom = compile(source, { target: "dom", filename: "tap.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Tap, Quiet } = await importServer<{ Tap: () => ServerValue; Quiet: () => ServerValue }>(server.code);
  const html = await derivedToString(() => [Tap(), Quiet()] as unknown as ServerValue, {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/tap.tsx#Tap": "/tap.js", "src/tap.tsx#Quiet": "/tap.js" } },
    preload: { lean: true },
  });
  return {
    ...DERIVED_BUILD,
    "/": '<!doctype html><html><body><p id="static" style="height:60px">Static</p>' + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/tap.js": rewrite(dom.code),
  };
}

// The click listeners elements get, by id ("#" = anything without one).
const SPY = () => {
  const seen: string[] = ((globalThis as unknown as { __clicks: string[] }).__clicks = []);
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: never[]) {
    if (type === "click" && (this as unknown as Node).nodeType === 1) seen.push((this as Element).id || "#");
    return (add as (...args: unknown[]) => void).call(this, type, ...rest);
  } as typeof add;
};
const clicks = (page: import("playwright").Page) => page.evaluate(() => (globalThis as unknown as { __clicks: string[] }).__clicks);

compiled("a tap gives the target a click listener of its own only inside a boundary that hears clicks, before its chunk loads", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await withPage(
    await files(),
    async (page) => {
      await page.addInitScript(SPY);
      await page.goto("http://rivet.test/");
      await page.tap("#static");
      assert.deepEqual(await clicks(page), [], "outside every boundary");
      await page.tap("#inner");
      assert.deepEqual(await clicks(page), ["inner"], "the target, while the chunk is held");
      assert.equal(await page.textContent("#count"), "0");
      release();
      await page.waitForFunction(() => document.getElementById("count")?.textContent === "1");
      await page.tap("#inner");
      await page.waitForFunction(() => document.getElementById("count")?.textContent === "2");
      // The loader's on the target, then the adopted runtime's on the node holding the handler.
      assert.deepEqual([...new Set(await clicks(page))], ["inner", "plain"]);
    },
    { touch: true, delays: { "/tap.js": held } },
  );
});

compiled("a boundary that hears no clicks stays untouched by a tap", async () => {
  // The names table lists Quiet's types: `input`, no `click`.
  await withPage(
    await files(),
    async (page) => {
      await page.addInitScript(SPY);
      await page.goto("http://rivet.test/");
      await page.tap("#quiet");
      assert.deepEqual(await clicks(page), []);
    },
    { touch: true },
  );
});

compiled("a delegated click outside every boundary (an overlay the handler built) gets its listener from the runtime", async () => {
  await withPage(
    await files(),
    async (page) => {
      await page.addInitScript(SPY);
      await page.goto("http://rivet.test/");
      await page.tap("#inner");
      await page.waitForSelector("#overlay");
      await page.evaluate(() => (globalThis as unknown as { __clicks: string[] }).__clicks.splice(0));
      await page.tap("#inside");
      await page.waitForFunction(() => document.getElementById("count")?.textContent === "11");
      assert.deepEqual(await clicks(page), ["overlay"], "the node holding the handler");
    },
    { touch: true },
  );
});

(hasWebkit() && hasDerivedModel() ? test : test.skip)(
  "WebKit: a tap on a plain element runs its onClick cold, warm and in an overlay",
  async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await withPage(
      await files(),
      async (page) => {
        await page.goto("http://rivet.test/");
        await page.tap("#inner");
        release();
        await page.waitForFunction(() => document.getElementById("count")?.textContent === "1", undefined, { timeout: 5000 });
        await page.tap("#inner");
        await page.waitForFunction(() => document.getElementById("count")?.textContent === "2", undefined, { timeout: 5000 });
        await page.tap("#inside");
        await page.waitForFunction(() => document.getElementById("count")?.textContent === "12", undefined, { timeout: 5000 });
      },
      { engine: "webkit", touch: true, delays: { "/tap.js": held } },
    );
  },
  30000,
);
