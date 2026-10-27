// ContextMenu / Command on a resumed page (`/menus-pro`; Rivet additions, feature sets inspired by HeroUI Pro's public docs):
// no component script before input; a right click on the trigger opens the menu at the pointer, an item runs + closes, Escape
// closes; the palette opens from its button with the field focused, typing filters (textValue search terms), Enter runs the
// focused command and the palette closes; Escape on an empty field closes it.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("menus pro: nothing before input, then context menu + command palette behave", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  const seen = watch(page);
  await page.goto(s.origin + "/menus-pro");
  await page.waitForLoadState("networkidle");
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /context-menu|command|menu|autocomplete|dialog/i.test(u)),
    [],
  );

  // ContextMenu: right click opens near the pointer
  const box = (await page.locator("#cm").boundingBox())!;
  await page.mouse.click(box.x + 60, box.y + 40, { button: "right" });
  await page.waitForSelector("[role=menu][aria-label=Edit]");
  const pop = (await page.locator("[data-slot=context-menu-popover]").boundingBox())!;
  assert.ok(Math.abs(pop.x - (box.x + 60)) < 24 && Math.abs(pop.y - (box.y + 40)) < 24, `at pointer: ${JSON.stringify(pop)}`);
  await page.click("[role=menuitem][data-key=paste]");
  await page.waitForFunction(() => document.querySelector("#cm-last")?.textContent === "paste");
  await page.waitForSelector("[role=menu][aria-label=Edit]", { state: "detached" });
  await page.mouse.click(box.x + 30, box.y + 30, { button: "right" });
  await page.waitForSelector("[role=menu][aria-label=Edit]");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=menu][aria-label=Edit]", { state: "detached" });

  // Command palette
  await page.click("#cmd-open");
  await page.waitForSelector("[data-slot=command-dialog][role=dialog]");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-slot") === "command-input");
  await page.keyboard.type("money");
  await page.waitForFunction(() => document.querySelectorAll("[data-slot=command-list] [role=menuitem]").length === 1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#cm-last")?.textContent === "cmd:billing");
  await page.waitForSelector("[data-slot=command-dialog]", { state: "detached" });
  await page.click("#cmd-open");
  await page.waitForSelector("[data-slot=command-dialog][role=dialog]");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-slot=command-dialog]", { state: "detached" });
  assert.deepEqual(seen.errors, []);
  await page.close();
});
