// HoloCard on a resumed page (`/holo-card`; Rivet addition, feature set inspired by HeroUI Pro's public Holo Card docs): a
// cold pointer move writes the pointer variables (corner → near 0 / 100, `data-active`, rotated rotator), leaving resets
// them; the static card ignores the pointer.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("holo card: cold pointer tracking, leave reset, static card", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(s.origin + "/holo-card");
  await page.waitForLoadState("networkidle");
  const vars = (id: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      return {
        x: el.style.getPropertyValue("--holo-card-pointer-x"),
        o: el.style.getPropertyValue("--holo-card-opacity"),
        active: el.getAttribute("data-active"),
      };
    }, id);
  const box = (await page.locator("#hc").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 2, box.y + 4, { steps: 4 });
  await page.waitForFunction(() => Number((document.querySelector("#hc") as HTMLElement).style.getPropertyValue("--holo-card-pointer-x")) > 90);
  const on = await vars("#hc");
  assert.equal(on.o, "1");
  assert.equal(on.active, "true");
  const transform = await page.evaluate(() => getComputedStyle(document.querySelector("#hc .holo-card__rotator")!).transform);
  assert.notEqual(transform, "none");
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => (document.querySelector("#hc") as HTMLElement).style.getPropertyValue("--holo-card-opacity") === "0");
  assert.equal((await vars("#hc")).x, "50");
  const st = (await page.locator("#hc-static").boundingBox())!;
  await page.mouse.move(st.x + 10, st.y + 10);
  await page.mouse.move(st.x + st.width - 10, st.y + 10, { steps: 3 });
  await page.waitForTimeout(150);
  assert.equal((await vars("#hc-static")).x, "");
  await page.close();
});
