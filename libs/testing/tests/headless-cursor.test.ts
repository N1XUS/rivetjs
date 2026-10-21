// Headless cursor guard (`headless-cursor.ts`, installed by `node-env.ts` in every Playwright context): trusted
// pointer / mouse arrivals at screen (0, 0) — CI's virtual cursor — never reach the page; scripted input elsewhere
// does, and moving away to (0, 0) still tells the element it leaves.
import { test } from "vitest";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const PAGE = `data:text/html,<style>body{margin:0}a,b{display:block;width:200px;height:50px}</style><a id=a href=%23x>a</a><b id=b>b</b>
<script>window.log=[];for(const t of ['pointerover','pointerenter','pointermove','pointerout','pointerleave','mouseover','mouseout'])
for(const id of ['a','b'])document.getElementById(id).addEventListener(t,e=>{if(!log.includes(t+':'+id))log.push(t+':'+id)})</script>`;

test("origin arrivals are swallowed in every context; scripted moves and leaves reach the page", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const page of [await browser.newPage(), await (await browser.newContext()).newPage()]) {
      await page.goto(PAGE);
      const log = () => page.evaluate(() => (window as unknown as { log: string[] }).log.splice(0).sort());
      // The CI cursor: a trusted arrival at the origin, over the first link.
      await page.mouse.move(0, 0);
      assert.deepEqual(await log(), []);
      assert.ok(await page.evaluate(() => (window as unknown as { __rivetOriginPointer?: Record<string, number> }).__rivetOriginPointer?.pointerover));
      // Scripted input: over / enter / move reach the element.
      await page.mouse.move(20, 75);
      assert.deepEqual(await log(), ["mouseover:b", "pointerenter:b", "pointermove:b", "pointerover:b"]);
      // "Move away" to the origin: the element left still gets out / leave; the arrival over `a` stays swallowed.
      await page.mouse.move(0, 0);
      assert.deepEqual(await log(), ["mouseout:b", "pointerleave:b", "pointerout:b"]);
    }
  } finally {
    await browser.close();
  }
});
