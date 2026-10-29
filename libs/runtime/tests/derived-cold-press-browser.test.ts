// Derived model: a cold press (DERIVED-C, dom-resume's cold-press replay ported to `dom-derived`). The loader holds the
// press's pointerdown / mousedown / pointerup / mouseup / click (default `data-events`); once the chunk loaded the runtime
// puts focus back where it was at dispatch, replays the handlers in order — a listener a replayed press start attached
// (RA usePress's document `pointerup`) sees the later replayed events — and focuses as the default would unless a
// handler canceled it. Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function App() {
  const pressed = signal(false);
  const presses = signal(0);
  const clicks = signal(0);
  const hovered = signal(false);
  const downs = signal(0);
  const start = () => {
    pressed.set(true);
    document.addEventListener("pointerup", () => (pressed.set(false), presses.set(presses() + 1)), { once: true });
  };
  return (
    <main>
      <input id="before" />
      <button id="press" data-pressed={pressed() ? "" : undefined} onPointerDown={start} onClick={() => clicks.set(clicks() + 1)}>
        {presses()}/{clicks()}
      </button>
      <button id="held" onMouseDown={(e) => e.preventDefault()} onClick={() => clicks.set(clicks() + 1)}>
        held
      </button>
      <div id="grip" tabIndex={0} onPointerDown={(e) => e.preventDefault()} onMouseDown={() => downs.set(downs() + 1)} onClick={() => clicks.set(clicks() + 1)}>
        grip {downs()}
      </div>
      <button id="plain" onClick={() => clicks.set(clicks() + 1)}>
        plain
      </button>
      <button id="hover" data-hovered={hovered() ? "" : undefined} onPointerEnter={() => hovered.set(true)} onPointerLeave={() => hovered.set(false)} onClick={() => clicks.set(clicks() + 1)}>
        hover
      </button>
      <p id="clicks">{clicks()}</p>
    </main>
  );
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };

async function served(): Promise<Record<string, string>> {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js" } };
  const html = (await derivedToString(() => App(), { manifest })) as string;
  // The default delegated types (pointer / mouse / focus events) + the hover button's own: `data-events` lists both.
  assert.match(
    html,
    / data-events="click input change submit keydown pointerdown pointerup pointercancel mousedown mouseup focusin focusout pointerenter pointerleave"/,
  );
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
}
const active = (page: Page): Promise<string> => page.evaluate(() => document.activeElement?.id || document.activeElement?.localName || "");
const ring = (page: Page): Promise<boolean> => page.evaluate(() => !!document.activeElement?.matches(":focus-visible"));
// The replay chain is done: the listener recording put the native `addEventListener` back.
const idle = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => /\[native code\]/.test(Function.prototype.toString.call(EventTarget.prototype.addEventListener)), undefined, { timeout: 5000 });

async function cold(run: (page: Page) => Promise<void>): Promise<void> {
  await withPage(
    await served(),
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await page.focus("#before");
      await run(page);
      assert.deepEqual(errors, []);
    },
    { delays: { "/page.js": 400 } },
  );
}

compiled("cold press: the press start's handler and the listener it attached both see the replayed press (usePress shape)", async () => {
  await cold(async (page) => {
    await page.click("#press");
    await page.waitForFunction(() => document.querySelector("#press")!.textContent === "1/1", undefined, { timeout: 5000 });
    await idle(page);
    assert.equal(await page.getAttribute("#press", "data-pressed"), null, "the replayed pointerup ended the press");
    assert.equal(await active(page), "press", "the default focus followed");
    assert.equal(await ring(page), false, "a mouse focus: no focus ring");
    // Live from now on.
    await page.click("#press");
    assert.equal(await page.textContent("#press"), "2/2");
  });
});

compiled("cold press: a mousedown a handler cancels gives focus back (radio label shape)", async () => {
  await cold(async (page) => {
    await page.click("#held");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 5000 });
    await idle(page);
    assert.equal(await active(page), "before");
  });
});

compiled("cold press: a canceled pointerdown keeps focus and its compatibility mousedown never runs (resize handle shape)", async () => {
  await cold(async (page) => {
    // FUZZ-UI 2026-10-29 (ui `/app-layout-sheet`, sidebar resize handle): a canceled pointerdown suppresses the mousedown
    // and its focus move in the browser; the replay ran the held mousedown and focused the handle.
    await page.click("#grip");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 5000 });
    await idle(page);
    assert.equal(await active(page), "before");
    assert.equal((await page.textContent("#grip"))!.trim(), "grip 0");
    // Live: the same as a loaded page.
    await page.click("#grip");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "2", undefined, { timeout: 5000 });
    assert.equal(await active(page), "before");
    assert.equal((await page.textContent("#grip"))!.trim(), "grip 0");
  });
});

compiled("cold press: an uncanceled press focuses its target as a mouse focus", async () => {
  await cold(async (page) => {
    await page.click("#plain");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 5000 });
    await idle(page);
    assert.equal(await active(page), "plain");
    assert.equal(await ring(page), false);
  });
});

compiled("cold press: focus moved after the press (a script focus, a Tab) stays where it went", async () => {
  await cold(async (page) => {
    // Before the chunk loaded: the press focused #plain natively, then focus moved on (Playwright `press` / a tab-in).
    await page.click("#plain");
    await page.focus("#held");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 5000 });
    await idle(page);
    assert.equal(await active(page), "held", "the replayed press's default focus does not pull focus back");
  });
});

compiled("cold hover: the units a press adopted get the enter events the pointer made before they existed", async () => {
  await cold(async (page) => {
    await page.hover("#hover");
    await page.click("#hover");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 5000 });
    await idle(page);
    assert.equal(await page.getAttribute("#hover", "data-hovered"), "");
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => !document.querySelector("#hover")!.hasAttribute("data-hovered"), undefined, { timeout: 2000 });
  });
});

compiled("cold hover: the synthetic enters follow the browser's order (every pointerenter outermost first, then every mouseenter)", async () => {
  await cold(async (page) => {
    await page.evaluate(() => {
      const log: string[] = ((window as unknown as { enters: string[] }).enters = []);
      for (const type of ["pointerenter", "mouseenter"])
        window.addEventListener(
          type,
          (event) => event.isTrusted || log.push(type + " " + ((event.target as Element).id || (event.target as Element).localName)),
          true,
        );
    });
    await page.hover("#hover");
    await page.click("#hover");
    await page.waitForFunction(() => document.querySelector("#clicks")!.textContent === "1", undefined, { timeout: 5000 });
    await idle(page);
    const enters = await page.evaluate(() => (window as unknown as { enters: string[] }).enters);
    assert.deepEqual(
      enters,
      ["html", "body", "main", "hover"].map((el) => "pointerenter " + el).concat(["html", "body", "main", "hover"].map((el) => "mouseenter " + el)),
    );
  });
});
