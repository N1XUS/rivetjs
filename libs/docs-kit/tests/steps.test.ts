// Example test steps (define.ts `Step`) against a plain page in Chromium: each input step fires the
// events it documents, and the assertion steps see the result. Run: `npx vitest run --project docs-kit`
// (nx `docs-kit:test`).
import { strict as assert } from "node:assert";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import type { Step } from "../define.ts";
import { run } from "../tools/example-checks.ts";

// Every listened event appends its type (and pointerType for pointer events) to #log.
const PAGE = `<!doctype html><html><body style="margin:0">
<button id="b" style="width:120px;height:40px">Button</button>
<div id="scroller" style="width:200px;height:100px;overflow:auto"><div style="height:1000px">tall</div></div>
<div id="from" draggable="true" style="width:60px;height:40px;background:#ccc">from</div>
<div id="to" style="width:60px;height:40px;margin-top:40px;background:#eee">to</div>
<p id="log"></p>
<script>
  const log = (text) => (document.getElementById("log").textContent += text + " ");
  const b = document.getElementById("b");
  for (const type of ["click", "dblclick", "contextmenu", "mouseenter", "touchstart", "touchend"]) b.addEventListener(type, (e) => log(type));
  b.addEventListener("pointerdown", (e) => log("pointerdown:" + e.pointerType));
  document.getElementById("scroller").addEventListener("wheel", (e) => log("wheel:" + e.deltaY));
  document.getElementById("from").addEventListener("dragstart", () => log("dragstart"));
  const to = document.getElementById("to");
  to.addEventListener("dragover", (e) => e.preventDefault());
  to.addEventListener("drop", (e) => (e.preventDefault(), log("drop")));
</script></body></html>`;

let browser: Browser;
let page: Page;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser.close();
});

async function steps(...list: Step[]): Promise<string> {
  page = await browser.newPage();
  try {
    await page.setContent(PAGE);
    for (const step of list) await run(page, step, "steps-test");
    return (await page.textContent("#log")) ?? "";
  } finally {
    await page.close();
  }
}

test("hover fires mouseenter", async () => {
  assert.match(await steps({ hover: "#b" }, { expect: ["#log", "mouseenter"] }), /mouseenter/);
});

test("dblclick fires dblclick", async () => {
  assert.match(await steps({ dblclick: "#b" }, { expect: ["#log", "dblclick"] }), /click.* click.* dblclick/);
});

test("rightclick fires contextmenu, not click", async () => {
  const log = await steps({ rightclick: "#b" }, { expect: ["#log", "contextmenu"] });
  assert.doesNotMatch(log, /(^| )click/);
});

test("contextmenu passes when the page cancels the browser's menu, fails when it does not", async () => {
  page = await browser.newPage();
  try {
    await page.setContent(PAGE);
    await assert.rejects(run(page, { contextmenu: "#b" }, "steps-test"), /browser's own context menu was not canceled/);
    // A handler that stops propagation too (cdk MenuTrigger): read from the window capture listener after dispatch.
    await page.evaluate(() => document.getElementById("b")!.addEventListener("contextmenu", (e) => (e.preventDefault(), e.stopPropagation())));
    await run(page, { contextmenu: "#b" }, "steps-test");
  } finally {
    await page.close();
  }
});

test("longpress holds the mouse down for the given time before releasing", async () => {
  page = await browser.newPage();
  try {
    await page.setContent(PAGE);
    await page.evaluate(() => {
      const b = document.getElementById("b")!;
      let down = 0;
      b.addEventListener("mousedown", () => (down = performance.now()));
      b.addEventListener("mouseup", () => (document.getElementById("log")!.textContent += `held:${performance.now() - down >= 280} `));
    });
    await run(page, { longpress: ["#b", 300] }, "steps-test");
    await run(page, { expect: ["#log", "held:true"] }, "steps-test");
    assert.match((await page.textContent("#log")) ?? "", /pointerdown:mouse/);
  } finally {
    await page.close();
  }
});

test("wheel fires wheel with deltaY and scrolls", async () => {
  page = await browser.newPage();
  try {
    await page.setContent(PAGE);
    await run(page, { wheel: ["#scroller", 300] }, "steps-test");
    await run(page, { expect: ["#log", "wheel:300"] }, "steps-test");
    await page.waitForFunction(() => document.getElementById("scroller")!.scrollTop > 0, undefined, { timeout: 5000 });
  } finally {
    await page.close();
  }
});

test("drag drops the source on the target", async () => {
  assert.match(await steps({ drag: ["#from", "#to"] }, { expect: ["#log", "drop"] }), /dragstart.*drop/);
});

test("tap fires touch events, a touch pointer and click", async () => {
  const log = await steps({ tap: "#b" }, { expect: ["#log", "click"] });
  assert.match(log, /touchstart/);
  assert.match(log, /pointerdown:touch/);
  assert.match(log, /touchend/);
});

test("a failing step names the example and the step", async () => {
  await assert.rejects(steps({ hover: "#missing" }), /example steps-test: step \{"hover":"#missing"\} failed/);
});

// A menu zooming in that closes when the page scrolls (a non-modal popover, React Aria `useCloseOnScroll`): the click
// waits out the entrance animation instead of letting Playwright's not-stable retries force-scroll the page (COLD-FIX-B).
const ZOOM = `<!doctype html><html><body style="margin:0;height:3000px">
<style>@keyframes zoom { from { transform: scale(0.9) translateY(4px); opacity: 0 } }</style>
<div id="menu" style="position:absolute;top:400px;left:40px;width:180px;animation:zoom 200ms ease-out">
  <div id="item" style="height:36px" onclick="document.getElementById('log').textContent += 'click '">Rename</div>
</div>
<p id="log"></p>
<script>addEventListener("scroll", () => document.getElementById("menu")?.remove(), { once: true });</script>
</body></html>`;

test("click waits for the target's entrance animation (no forced scroll closes the menu)", async () => {
  for (let i = 0; i < 3; i++) {
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    try {
      await page.setContent(ZOOM);
      await run(page, { click: "#item" }, "steps-test");
      assert.equal(await page.textContent("#log"), "click ");
      assert.equal(await page.evaluate(() => scrollY), 0);
    } finally {
      await page.close();
    }
  }
});

test("viewport changes responsive layout without firing input", async () => {
  page = await browser.newPage();
  try {
    await page.setContent(PAGE);
    await run(page, { viewport: [375, 812] }, "steps-test");
    assert.deepEqual(page.viewportSize(), { width: 375, height: 812 });
    assert.equal(await page.evaluate(() => matchMedia("(width < 1024px)").matches), true);
    assert.equal(await page.textContent("#log"), "");
    await run(page, { viewport: [1440, 900] }, "steps-test");
    assert.equal(await page.evaluate(() => matchMedia("(width < 1024px)").matches), false);
  } finally {
    await page.close();
  }
});
