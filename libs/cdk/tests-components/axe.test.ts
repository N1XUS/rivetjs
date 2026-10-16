// axe-core over every story: server HTML with its scripts stripped (what the first paint and AT see
// before resume), and resumed pages with overlays open (what the widgets look like after interaction).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import { stories, type Stories } from "./harness.ts";

const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const STORIES = ["/", "/listbox", "/buttons", "/tabs", "/menu", "/dialog", "/popover", "/combobox", "/forms"];

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

async function audit(page: Page): Promise<string[]> {
  // Measure settled styles: overlays fade in (theme transitions).
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run(context: unknown, options: unknown): Promise<{ violations: Violation[] }> } }).axe;
    // Rules about whole-document structure the story shell does not model are out of scope here. A
    // modal overlay (a menu too, as in React Aria) makes the page behind it inert, its heading too.
    const modal = !!document.querySelector("[data-rv-overlay]") && !!document.querySelector("main [inert], main[inert], [inert] main, nav[inert]");
    // An open ComboBox hides the rest of the page from AT with aria-hidden, not inert (React Aria
    // useComboBox `ariaHideOutside([input, popover])`: the page stays keyboard-reachable, the popover is
    // non-modal) — upstream design: the heading is hidden and hidden content keeps its focusables.
    const comboOpen =
      !!document.querySelector('[role=combobox][aria-expanded="true"]') && !!document.querySelector('[aria-hidden="true"] h1, h1[aria-hidden="true"]');
    const result = await axe.run(document, {
      rules: {
        region: { enabled: false },
        ...(modal || comboOpen ? { "page-has-heading-one": { enabled: false } } : {}),
        ...(comboOpen ? { "aria-hidden-focus": { enabled: false } } : {}),
      },
    });
    return result.violations;
  });
  return violations.map((v: Violation) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("axe: server HTML (scripts stripped: before resume) has no violations", async () => {
  const found: string[] = [];
  for (const path of STORIES) {
    const html = (await (await fetch(s.origin + path)).text()).replace(/<script\b[\s\S]*?<\/script>/g, "");
    assert.ok(!html.includes("<script"), "scripts stripped");
    const page = await s.browser.newPage();
    await page.route(s.origin + path, (route) => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto(s.origin + path);
    for (const v of await audit(page)) found.push(path + ": " + v);
    await page.close();
  }
  assert.deepEqual(found, []);
});

test("axe: resumed widgets with overlays open have no violations", async () => {
  const found: string[] = [];
  const check = async (path: string, open: (page: Page) => Promise<void>) => {
    const page = await s.browser.newPage();
    await page.goto(s.origin + path);
    await open(page);
    for (const v of await audit(page)) found.push(path + ": " + v);
    await page.close();
  };
  await check("/menu", async (page) => {
    await page.focus("#edit-trigger");
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
  });
  await check("/dialog", async (page) => {
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.waitForFunction(() => !!document.querySelector("#settings"));
  });
  await check("/popover", async (page) => {
    await page.click("#info-trigger");
    await page.waitForFunction(() => !!document.querySelector("#info"));
  });
  await check("/combobox", async (page) => {
    await page.focus("#fruit");
    await page.keyboard.type("a");
    await page.waitForFunction(() => document.querySelector("#fruit")?.getAttribute("aria-expanded") === "true");
  });
  await check("/listbox", async (page) => {
    await page.focus("#fruit-option-banana");
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.id === "fruit-option-date");
  });
  await check("/tabs", async (page) => {
    await page.focus("#product-tab-specs");
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.activeElement?.id === "product-tab-faq");
  });
  assert.deepEqual(found, []);
});
