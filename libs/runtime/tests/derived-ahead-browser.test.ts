// Derived model, fetch-ahead timing and intent (ZERO ONDEMAND): the tail's `data-fo` list (the runtime + the chunks of the
// boundaries that can become live + their static closures) is fetched as low-priority modulepreloads in the first idle
// period after `load` (default), right after `load` (`preload.ahead: "load"`), or not before the first intent (`"intent"` /
// `lean`); intent (pointer down, a pointer resting 80 ms, focus, touch, key) fetches the whole list at high priority at once
// (no import waterfall) and the event replays. Hover events boot like any held event in the background modes (a pass
// adopts before the press); on `intent` pages they never boot by themselves: a pointer passing over a listening boundary
// loads nothing, and the hover it left is dropped (no stale enter after a later adopt).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Root() {
  return (
    <main>
      <p id="text" style={{ height: "200px" }}>static text</p>
      <Inner start={1} />
      <Outer start={10} />
    </main>
  );
}
export function Inner(props) {
  const n = signal(props.start);
  return <button id="inner" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
export function Outer(props) {
  const n = signal(props.start);
  return <button id="outer" style={{ margin: "40px" }} onClick={() => n.set(n() + 1)} onPointerEnter={() => n.set(n() + 100)}>{n()}</button>;
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/page.tsx", boundaries: ["Root", "Inner", "Outer"], independent: ["Root", "Inner", "Outer"] };
const symbols = { "src/page.tsx#Root": "/root.js", "src/page.tsx#Inner": "/inner.js", "src/page.tsx#Outer": "/outer.js" };

async function render(preload?: object): Promise<string> {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { Root } = await importServer<{ Root: () => ServerValue }>(server.code);
  return (await derivedToString(() => Root(), { manifest: { hash: "t", runtime: "/rt.js", symbols }, ...(preload ? { preload } : {}) } as never)) as string;
}
function site(html: string): Record<string, string> {
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(dom.diagnostics, []);
  const code = rewrite(dom.code);
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/root.js": code,
    "/inner.js": code,
    "/outer.js": code,
  };
}
const links = (page: Page) =>
  page.$$eval('link[rel="modulepreload"]', (list) => list.map((l) => [l.getAttribute("href"), (l as HTMLLinkElement).fetchPriority]));
const fo = (html: string): string[] => /data-fo="([^"]*)"/.exec(html)![1]!.split(" ");
const center = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).boundingBox())!;
  return [box.x + box.width / 2, box.y + box.height / 2] as const;
};

compiled("fetch-ahead timing: data-fw per preload option; the list ships in every mode", async () => {
  const idle = await render(),
    load = await render({ ahead: "load" }),
    intent = await render({ ahead: "intent" }),
    lean = await render({ lean: true });
  // The non-listening root is not live (D5): not in the list.
  assert.deepEqual(fo(idle), ["/rt.js", "/inner.js", "/outer.js"]);
  assert.doesNotMatch(idle, /data-fw/);
  assert.match(load, /data-fo="[^"]*" data-fw="load"/);
  assert.match(intent, /data-fo="[^"]*" data-fw="intent"/);
  assert.equal(lean, intent, "lean = ahead: intent");
});

compiled("fetch-ahead: idle (default) preloads the list at low priority after load, evaluating nothing; Save-Data skips it", async () => {
  const html = await render();
  await withPage(site(html), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 3);
    assert.deepEqual(
      await links(page),
      fo(html).map((href) => [href, "low"]),
    );
    assert.equal(await page.textContent("#inner"), "1");
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    assert.ok(requests.includes("/rt.js"));
  });
  await withPage(site(html), async (page, requests) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true }));
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(300);
    assert.deepEqual(await links(page), [], "Save-Data: no background fetch");
    assert.deepEqual(
      requests.filter((path) => /^\/(rt|root|inner|outer)\.js$/.test(path)),
      [],
    );
    // Intent still fetches (the whole list, high priority) and the click replays.
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    assert.deepEqual(
      await links(page),
      fo(html).map((href) => [href, "high"]),
    );
  });
});

compiled("fetch-ahead: intent loads nothing before the first intent, then the whole list at once (high) and the press replays", async () => {
  const html = await render({ ahead: "intent" });
  await withPage(site(html), async (page, requests) => {
    const loaded = () => requests.filter((path) => /^\/(rt|root|inner|outer)\.js$/.test(path));
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(300);
    assert.deepEqual(await links(page), []);
    assert.deepEqual(loaded(), [], "no JS before input");
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    assert.deepEqual(
      await links(page),
      fo(html).map((href) => [href, "high"]),
    );
    assert.deepEqual([...new Set(loaded())].sort(), ["/inner.js", "/outer.js", "/root.js", "/rt.js"], "the list + the root the click adopts around");
  });
  // Keyboard: Tab focus is intent (focusin), Enter replays the activation.
  await withPage(site(html), async (page) => {
    await page.goto("http://rivet.test/");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 3);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
  });
});

compiled("hover, idle / load (default): a pointer passing over a listening boundary boots and adopts before any press", async () => {
  for (const preload of [undefined, { ahead: "load" }]) {
    const html = await render(preload);
    const files = { ...site(html), "/rt.js": 'export { default } from "/dom-derived.ts";\nwindow.__rt = (window.__rt || 0) + 1;' };
    await withPage(files, async (page) => {
      await page.goto("http://rivet.test/");
      await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 3);
      assert.equal(await page.evaluate(() => (window as unknown as { __rt?: number }).__rt), undefined, "preloaded, not evaluated");
      const [ox, oy] = await center(page, "#outer"),
        [tx, ty] = await center(page, "#text");
      // A pass (no rest): the held hover boots the runtime at once, so the press after it pays no adopt.
      await page.mouse.move(ox, oy);
      await page.mouse.move(tx, ty);
      await page.waitForFunction(() => (window as unknown as { __rt?: number }).__rt === 1);
      await page.click("#inner");
      await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    });
  }
});

compiled("hover intent: a resting pointer loads and replays the enter; a passing pointer loads nothing and its hover is dropped", async () => {
  const html = await render({ ahead: "intent" });
  // Passing: over #outer and off again within the 80 ms dwell — nothing loads; a later click elsewhere adopts without
  // replaying the stale enter (#outer stays 10).
  await withPage(site(html), async (page, requests) => {
    const loaded = () => requests.filter((path) => /^\/(rt|root|inner|outer)\.js$/.test(path));
    await page.goto("http://rivet.test/");
    const [ox, oy] = await center(page, "#outer"),
      [tx, ty] = await center(page, "#text");
    await page.mouse.move(ox, oy);
    await page.mouse.move(tx, ty);
    await page.waitForTimeout(300);
    assert.deepEqual(loaded(), [], "a pass over a listening boundary loads nothing");
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    await page.waitForTimeout(100);
    assert.equal(await page.textContent("#outer"), "10", "the left hover is not replayed");
  });
  // Resting: the dwell boots, the held enter replays while the pointer is still there.
  await withPage(site(html), async (page, requests) => {
    const loaded = () => requests.filter((path) => /^\/(rt|root|inner|outer)\.js$/.test(path));
    await page.goto("http://rivet.test/");
    const [ox, oy] = await center(page, "#outer");
    await page.mouse.move(ox, oy);
    await page.waitForFunction(() => document.querySelector("#outer")!.textContent === "110");
    assert.ok(loaded().includes("/rt.js"));
    assert.deepEqual(
      await links(page),
      fo(html).map((href) => [href, "high"]),
    );
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector("#outer")!.textContent === "111");
    await page.waitForTimeout(100);
    assert.equal(await page.textContent("#outer"), "111", "one enter: the replayed one, no synthetic second on the press");
  });
});
