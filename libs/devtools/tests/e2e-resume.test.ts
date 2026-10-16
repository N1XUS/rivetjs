// DevTools on a resumed dev page (the router fixture's default: dev pages resume like production):
// Performance measures the resumed page while the panel stays on non-inspection tabs; an inspection
// tab switches the page to client render (the hot-update fallback), after which the tree and live
// signals work, with a notice in the panel.
import { test } from "vitest";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const fixture = new URL("../../router/tests/fixture/", import.meta.url).pathname;

test("resumed dev page: measured while resumed, switched to client render for inspection", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/devtools-e2e-"));
  await cp(fixture, root, { recursive: true, filter: (path) => !/[/\\](\.rivet|dist|node_modules)$/.test(path) });
  const server = await createServer({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 1100 } })).newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(origin + "/items/1");
    assert.equal(await page.locator('[data-rivet-dev="resume"]').count(), 1, "the page is resumed");
    // An interaction on the resumed page (once the agent listens): its handler chunk loads on demand.
    await page.locator("rivet-devtools button.toggle").waitFor({ state: "attached" });
    await page.click("#likes");
    await page.locator("#likes", { hasText: "Likes 1" }).waitFor();

    // The panel reopens on its last tab (kept for the tab session): Performance keeps the page resumed.
    await page.evaluate(() => sessionStorage.setItem("rivet-devtools-ui:tab", "performance"));
    await page.keyboard.press("Alt+Shift+R");
    const panel = page.frameLocator("rivet-devtools iframe");
    await panel.locator(".perf-pane .perf-summary").waitFor();
    const notice = panel.locator("p.page-mode");
    await notice.locator("xpath=self::*[@data-mode='resumed']").waitFor();
    assert.match((await notice.textContent()) ?? "", /^Resumed page: Components, Signals/);
    const resume = panel.locator(".metric.resume");
    assert.equal(await resume.locator(".label").textContent(), "Resumed page");
    await resume.locator(".value").filter({ hasNotText: /^0 ·/ }).waitFor();
    assert.match((await resume.locator(".rating").first().textContent()) ?? "", /^first click: /);
    await page.waitForTimeout(300);
    assert.equal(await page.textContent("#likes"), "Likes 1", "still resumed: the page's state is intact");
    await page.screenshot({ path: ".artifacts/devtools-resumed.png" });

    // Components: switches to client render (the HMR fallback); the tree and live values follow.
    await panel.locator('[data-tab="components"]').click();
    await notice.locator("xpath=self::*[@data-mode='client']").waitFor();
    assert.match((await notice.textContent()) ?? "", /^Switched to client render for inspection \(performance up to \d+\.\d s was measured on the resumed page\)\.$/);
    const row = panel.locator('.row[data-name="ItemPage"]');
    await row.waitFor();
    await row.locator(".tag").click();
    const likes = panel.locator('[data-owner="ItemPage"] li.signal[data-name="ItemPage › likes"]');
    await likes.waitFor();
    // Client render starts from the server state (signals reset once at the switch, as on a hot update).
    await page.locator("#likes", { hasText: "Likes 0" }).waitFor();
    await page.click("#likes");
    await likes.locator(".value", { hasText: "1" }).waitFor();
    await page.screenshot({ path: ".artifacts/devtools-resumed-inspect.png" });

    // Performance keeps what it measured before the switch, and marks the switch.
    await panel.locator('[data-tab="performance"]').click();
    await panel.locator(".metric.resume .switched", { hasText: /^client render from \d+\.\d s$/ }).waitFor();
    assert.equal(await panel.locator(".metric.resume .label").textContent(), "Resumed page");
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
