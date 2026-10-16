// COMBOBOX-DEV (2026-10-08): the ui ComboBox on the dev server (`vite serve`, development condition: dev reactivity,
// dev a11y checks) logs no error and no `Rivet a11y` warning, cold and through an interaction. Was: the first
// interaction re-created the ComboBox, its collection build pass (a `computed`) rendered the InputGroup's
// `[Input, Trigger]` cells and runtime `cells` wrote their signals there ("Signal writes are not allowed during
// computed evaluation"); the server input's `aria-describedby` named the unrendered ComboBoxValue / description ids.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = new URL("./app/", import.meta.url).pathname;

test("dev server: ComboBox cold load + open / type / pick log no error and no a11y warning", async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    const html = await (await fetch(origin + "/combo-box-dev")).text();
    // Server markup: the input names only the parts that render (RA useSlotId after hydration).
    // (Parts keep generated ids: a part's own `id` is not yet merged into the owner's references, RA `mergeIds`.)
    const input = (testId: string) => new RegExp(`data-testid="${testId}"[^]*?(<input[^>]*>)`).exec(html)?.[1] ?? "";
    assert.ok(input("cbd") && !input("cbd").includes("aria-describedby"), input("cbd"));
    const described = /aria-describedby="([^"]+)"/.exec(input("cbd-desc"))?.[1];
    const description = /<[^>]*data-testid="cbd-desc-description"[^>]*>/.exec(html)?.[0] ?? "";
    assert.ok(described && description.includes(`id="${described}"`), `${described} -> ${description}`);

    const page = await browser.newPage();
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => (message.type() === "error" ? errors : message.type() === "warning" ? warnings : []).push(message.text()));
    await page.goto(origin + "/combo-box-dev");
    await page.waitForLoadState("networkidle");
    // Cold: the dev a11y audit of the server markup (IDREFs are judged once the document settles).
    await page.waitForTimeout(300);
    assert.deepEqual(
      warnings.filter((w) => w.startsWith("Rivet a11y")),
      [],
      "cold",
    );

    for (const testId of ["cbd", "cbd-desc"]) {
      const field = `[data-testid=${testId}] input`;
      await page.click(field);
      await page.keyboard.press("ArrowDown");
      await page.waitForSelector("[role=listbox] [role=option]");
      await page.keyboard.type("c");
      await page.waitForFunction(() => document.querySelectorAll("[role=listbox] [role=option]").length >= 1);
      await page.click("[role=listbox] [role=option]");
      await page.waitForFunction((field) => document.querySelector<HTMLInputElement>(field)!.value === "Cat", field);
      await page.waitForTimeout(300);
    }
    assert.equal(
      await page.getAttribute("[data-testid=cbd-desc] input", "aria-describedby"),
      await page.getAttribute("[data-testid=cbd-desc-description]", "id"),
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(
      warnings.filter((w) => w.startsWith("Rivet") || /Signal writes/.test(w)),
      [],
    );
  } finally {
    await browser.close();
    await server.close();
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});
