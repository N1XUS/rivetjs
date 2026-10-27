// Spread-object handlers (`/spread-handlers`, FACTS-GAP 2026-10-27): `SpreadCard` builds `{ ...rest, ...(isStatic ? {} :
// { onPointerMove, onPointerLeave }) }` and spreads it on its root. The derived facts read those keys as listeners: the
// card is a conditional boundary listening to pointermove (record only for the live instance), and a cold pointer move
// works. Before: no boundary (HoloCard in a docs frame shipped no loader).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("spread handlers: the card is its own listening record, cold pointer move", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1200, height: 800 } });
  try {
    const seen = watch(page);
    await page.goto(s.origin + "/spread-handlers");
    await page.waitForLoadState("networkidle");
    const tail = await page.evaluate(() => {
      const el = document.querySelector('script[type="rivet/boundaries"]');
      return { json: el ? JSON.parse(el.textContent!) : null, events: el?.getAttribute("data-events") ?? "" };
    });
    const names: [string, number, string?][] = tail.json?.n ?? [];
    const card = names.findIndex(([name]) => name.endsWith("#SpreadCard"));
    assert.ok(card >= 0, "SpreadCard is a record name: " + JSON.stringify(names));
    assert.match(names[card]![2] ?? "", /pointermove/);
    assert.match(tail.events, /pointermove/);
    // One record: the live card (the static instance installs no function: its conditional record is dropped; the
    // `data-b` its root got at render names no record).
    const ids = new Set((tail.json.b as number[][]).map((r) => String(r[0])));
    const b = (sel: string) => page.getAttribute(sel, "data-b");
    assert.ok(ids.has((await b("#sh-live")) ?? ""), "#sh-live record");
    assert.ok(!ids.has((await b("#sh-static")) ?? ""), "#sh-static has no record");
    const box = (await page.locator("#sh-live").boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForFunction(() => document.querySelector("#sh-live")!.getAttribute("data-active") === "true");
    await page.mouse.move(2, 2);
    await page.waitForFunction(() => !document.querySelector("#sh-live")!.hasAttribute("data-active"));
    const st = (await page.locator("#sh-static").boundingBox())!;
    await page.mouse.move(st.x + 10, st.y + 10);
    await page.mouse.move(st.x + st.width / 2, st.y + 20, { steps: 3 });
    await page.waitForTimeout(150);
    assert.equal(await page.getAttribute("#sh-static", "data-active"), null);
    assert.deepEqual(seen.errors, []);
  } finally {
    await page.close();
  }
});
