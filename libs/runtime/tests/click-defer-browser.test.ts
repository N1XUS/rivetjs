import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "./resume/harness.ts";

// The first trusted mouse click per document (Playwright `page.click` → `isTrusted`, `pointerType` "mouse"): the
// handler runs in the click task, its DOM flush one task later (`_dispatch`). Chrome stalls the frame after the
// first DOM-changing mouse click of a tab; later clicks paint sooner synchronously, so they flush in their task,
// as do keyboard / touch / synthetic clicks. Every handler path: delegated `_on`, `_listen`, `clientEvent`.
const page = `<!doctype html><body><div id=app></div><script type=module>
import { mount, _tpl, _on, _listen, clientEvent } from "/dom.ts";
import { signal, batch, _bindingEffect } from "/reactivity.mjs";
const mode = new URLSearchParams(location.search).get("mode");
window.m = { log: [] };
const count = signal(0), tpl = _tpl("<div><button id=b>inc</button><span id=c>0</span></div>");
const paint = () => requestAnimationFrame(() => { const ch = new MessageChannel(); ch.port1.onmessage = () => (m.paint = performance.now()); ch.port2.postMessage(0); });
mount(() => {
  const root = tpl(), button = root.firstChild, span = button.nextSibling;
  _bindingEffect(() => { const n = count(); span.textContent = String(n); if (n) paint(); });
  const handler = (e) => {
    m.click = e.timeStamp;
    count.set(count() + 1);
    // Signal reads see the write at once; only the DOM waits.
    m.log.push("read " + count() + " dom " + span.textContent);
    queueMicrotask(() => m.log.push("microtask dom " + span.textContent));
  };
  if (mode === "sync") button.addEventListener("click", (e) => batch(() => handler(e)));
  else if (mode === "on") _on(button, "click", handler);
  else if (mode === "listen") _listen(button, "click", handler);
  else if (mode === "client") clientEvent(button, "click", handler);
  return root;
}, document.getElementById("app"));
// Registered after the delegated dispatcher: a task posted here follows the deferred flush's task.
document.addEventListener("click", () => { const ch = new MessageChannel(); ch.port1.onmessage = () => m.log.push("next task dom " + document.getElementById("c").textContent); ch.port2.postMessage(0); });
window.ready = true;
</script>`;

const open = async (p: import("playwright").Page, mode: string) => {
  await p.goto("http://rivet.test/?mode=" + mode);
  await p.waitForFunction(() => (window as unknown as { ready?: boolean }).ready);
};
const log = (p: import("playwright").Page) => p.evaluate(() => (window as unknown as { m: { log: string[] } }).m.log);

for (const mode of ["on", "listen", "client"])
  test(`trusted mouse click (${mode}): handler + signal reads now, DOM one task later`, async () => {
    await withPage({ "/": page }, async (p) => {
      await open(p, mode);
      await p.click("#b");
      await p.waitForFunction(() => (window as unknown as { m: { log: string[] } }).m.log.length >= 3);
      assert.deepEqual(await log(p), ["read 1 dom 0", "microtask dom 0", "next task dom 1"]);
      // Later clicks on this document flush in their own task; updates never reorder.
      await p.click("#b");
      await p.click("#b");
      await p.waitForFunction(() => (window as unknown as { m: { log: string[] } }).m.log.length >= 9);
      assert.equal(await p.textContent("#c"), "3");
      assert.deepEqual((await log(p)).slice(3), ["read 2 dom 1", "microtask dom 2", "next task dom 2", "read 3 dom 2", "microtask dom 3", "next task dom 3"]);
    });
  });

test("keyboard Enter, touch tap and synthetic clicks flush synchronously", async () => {
  await withPage({ "/": page }, async (p) => {
    await open(p, "on");
    await p.focus("#b");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => (window as unknown as { m: { log: string[] } }).m.log.length >= 3);
    assert.deepEqual((await log(p)).slice(0, 3), ["read 1 dom 0", "microtask dom 1", "next task dom 1"]);
    // A trusted touch tap (pointerType "touch"; what Playwright's `tap` sends through CDP).
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    const box = (await p.locator("#b").boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await p.waitForFunction(() => (window as unknown as { m: { log: string[] } }).m.log.length >= 6);
    assert.deepEqual((await log(p)).slice(3, 5), ["read 2 dom 1", "microtask dom 2"]);
    // `el.click()` / testing-library `fireEvent` / user-event: untrusted, DOM updated when dispatch returns.
    assert.equal(await p.evaluate(() => (document.getElementById("b")!.click(), document.getElementById("c")!.textContent)), "3");
  });
});

test("first mouse click of a tab paints sooner than with a synchronous flush", async () => {
  // Chromium stalls the frame after the first DOM-changing mouse click of a tab (Playwright headless Chromium:
  // click→paint p50 ~45–58 ms with the flush in the click task vs ~32 ms deferred one task). Fresh tab per sample.
  const latency = { sync: [] as number[], on: [] as number[] };
  await withPage({ "/": page }, async (p, _requests, browser) => {
    await p.goto("http://rivet.test/?mode=none");
    for (let i = 0; i < 4; i++)
      for (const mode of ["sync", "on"] as const) {
        const context = await browser.newContext(),
          tab = await context.newPage();
        // Served through the harness page (its route holds the runtime sources).
        await tab.route("http://rivet.test/**", async (route) => {
          const url = route.request().url();
          const body = await p.evaluate((u) => fetch(u).then((r) => r.text()), url);
          await route.fulfill({ body, contentType: new URL(url).pathname === "/" ? "text/html" : "text/javascript" });
        });
        await open(tab, mode);
        await tab.waitForTimeout(200);
        await tab.click("#b");
        await tab.waitForFunction(() => (window as unknown as { m: { paint?: number } }).m.paint != null);
        latency[mode].push(await tab.evaluate(() => (({ m }) => m.paint - m.click)(window as unknown as { m: { paint: number; click: number } })));
        await context.close();
      }
  });
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1]!;
  const sync = median(latency.sync),
    deferred = median(latency.on);
  if (process.env.CLICK_DEFER_LOG) process.stderr.write("click→paint " + JSON.stringify(latency) + "\n");
  assert.ok(deferred < sync * 0.85, `click→paint p50 deferred ${deferred.toFixed(1)} ms vs sync ${sync.toFixed(1)} ms`);
});

// A first mouse click whose update detaches the hovered element (a navigation replacing the content under the
// pointer): Chrome's hover-update task then stalls the next frame ~50 ms. DOM v2 removals in that deferred flush
// keep the hovered element hidden until the next frame's rAF (removed before that frame paints); every other
// removal, and every later click's, is immediate.
const routes = `<!doctype html><body><main id=app></main><script type=module>
import { mount, _tpl, _on, _insert } from "/dom.ts";
import { signal } from "/reactivity.mjs";
window.m = { log: [] };
const page = signal(0), tpl = _tpl("<section><p>other</p><a class=go href=/x>go</a></section>");
mount(() => {
  const host = document.createElement("div");
  _insert(host, () => {
    const n = page(), root = tpl();
    root.id = "s" + n;
    // After the flush that rendered this page (a microtask queued from inside it).
    if (n)
      queueMicrotask(() => {
        const old = document.getElementById("s" + (n - 1));
        m.log.push(["flushed", old ? getComputedStyle(old).display : "removed"]);
        requestAnimationFrame(() => requestAnimationFrame(() => m.log.push(["frame", document.getElementById("s" + (n - 1)) ? "kept" : "removed"])));
      });
    _on(root.lastChild, "click", (e) => {
      e.preventDefault();
      page.set(n + 1);
    });
    return root;
  });
  return host;
}, document.getElementById("app"));
window.ready = true;
</script>`;

test("first mouse click detaching the hovered element: kept hidden until the next frame, later clicks remove at once", async () => {
  await withPage({ "/": routes }, async (p) => {
    await p.goto("http://rivet.test/");
    await p.waitForFunction(() => (window as unknown as { ready?: boolean }).ready);
    const entries = (n: number) =>
      p
        .waitForFunction((n) => (window as unknown as { m: { log: unknown[] } }).m.log.length >= n, n)
        .then(() => p.evaluate(() => (window as unknown as { m: { log: unknown[] } }).m.log));
    await p.click("#s0 .go");
    assert.deepEqual(await entries(2), [
      ["flushed", "none"],
      ["frame", "removed"],
    ]);
    await p.click("#s1 .go");
    assert.deepEqual((await entries(4)).slice(2), [
      ["flushed", "removed"],
      ["frame", "removed"],
    ]);
    assert.equal(await p.locator("section").count(), 1);
  });
});
