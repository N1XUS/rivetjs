// HoloCard on a resumed page (`/holo-card`; Rivet addition, feature set inspired by HeroUI Pro's public Holo Card docs): a
// cold pointer move writes the pointer variables (corner → near 0 / 100, `data-active`, rotated rotator), leaving resets
// them; the static card ignores the pointer.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch, scriptsOf, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("holo card: cold pointer tracking, leave reset, static card", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1200, height: 900 } });
  const observed = watch(page);
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
  assert.equal(
    observed.scripts.some((path) => path.includes("holo-card-gyro")),
    false,
    "hover never fetches the sensor tracker",
  );
  await page.close();
});

test("holo card: cold touch tap loads device tracking, calibrates and keeps the glare after pointerleave", async () => {
  const page = await s.browser.newPage({ hasTouch: true, viewport: { width: 1200, height: 900 } });
  const observed = watch(page);
  await page.addInitScript(() => {
    const state = window as unknown as { holoPermissionCalls: number };
    state.holoPermissionCalls = 0;
    Object.defineProperty(window, "DeviceOrientationEvent", {
      configurable: true,
      value: {
        requestPermission: () => {
          state.holoPermissionCalls++;
          return Promise.resolve("granted");
        },
      },
    });
  });
  try {
    await page.goto(s.origin + "/holo-card");
    await page.waitForLoadState("networkidle");
    assert.deepEqual(scriptsOf(observed.scripts, /holo-card\.tsx#HoloCardRoot/), []);
    assert.equal(
      observed.scripts.some((path) => path.includes("holo-card-gyro")),
      false,
    );
    await page.locator("#hc").tap();
    await page.waitForFunction(() => (window as unknown as { holoPermissionCalls: number }).holoPermissionCalls === 1);
    await page.waitForLoadState("networkidle");
    assert.ok(observed.scripts.some((path) => path.includes("holo-card-gyro")));
    // Repeated readings also cover the observer's asynchronous first viewport notification.
    await page.waitForFunction(() => {
      window.dispatchEvent(Object.assign(new Event("deviceorientation"), { beta: 40, gamma: 10 }));
      return (document.querySelector("#hc") as HTMLElement).style.getPropertyValue("--holo-card-opacity") === "1";
    });
    await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("deviceorientation"), { beta: 40, gamma: 35 })));
    await page.waitForFunction(() => Number((document.querySelector("#hc") as HTMLElement).style.getPropertyValue("--holo-card-pointer-x")) > 99);
    await page.locator("#hc").dispatchEvent("pointerleave", { pointerType: "touch" });
    assert.equal(await page.locator("#hc").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--holo-card-opacity")), "1");
    await page.locator("#hc").tap();
    assert.equal(await page.evaluate(() => (window as unknown as { holoPermissionCalls: number }).holoPermissionCalls), 1);
    assert.deepEqual(observed.errors, []);
  } finally {
    await page.close();
  }
});
