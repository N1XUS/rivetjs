import assert from "node:assert/strict";
import type { Page } from "playwright";

export const pages = ["products", "dashboard", "settings", "article"] as const;
export type RealPage = (typeof pages)[number];
export const mainInteraction = {
  products: { target: ".add-cart", result: "#cart-count", text: "1" },
  dashboard: { target: "#sort-table", result: "#sort-state", text: "Descending" },
  settings: { target: "#save", result: "#form-status", text: "Please correct 15 fields" },
  article: { target: "#open-search", result: "#dialog-title", text: "Search documentation" },
} as const;

/** Product markup only: omit framework scripts, attributes and comment markers. */
export async function markup(page: Page) {
  return page.locator("#real-page").evaluate((root) => {
    const visit = (node: Element): unknown => [
      node.tagName,
      [...node.attributes]
        .filter((a) => /^(id|class|type|role|href|name|data-id|disabled|checked|aria-.+)$/.test(a.name))
        .map((a) => [a.name, a.value])
        .sort(),
      [...node.childNodes]
        .filter((child) => child.nodeType === 3)
        .map((child) => child.textContent)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
      [...node.children].filter((child) => child.tagName !== "SCRIPT").map(visit),
    ];
    return JSON.stringify(visit(root));
  });
}

export async function verifyPage(page: Page, kind: RealPage) {
  const click = async (selector: string) => page.locator(selector).first().click();
  const text = async (selector: string, expected: string) => {
    await page
      .waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent === expected, { selector, expected })
      .catch((e) => {
        throw Error(`${selector}: expected ${JSON.stringify(expected)}: ${e}`);
      });
  };
  const count = async (selector: string, expected: number) => {
    await page.waitForFunction(({ selector, expected }) => document.querySelectorAll(selector).length === expected, { selector, expected });
  };
  const main = mainInteraction[kind];
  await click(main.target);
  await text(main.result, main.text);
  if (kind === "products") {
    await count(".product", 48);
    await click("#next");
    await text("#page-number", "2");
    await click("#previous");
    await text("#page-number", "1");
    await click("#chip-office");
    await text("#result-count", "32");
    await count(".product", 32);
    await page.selectOption("#sort", "price-desc");
    await page.waitForFunction(() => document.querySelector(".product")?.getAttribute("data-id") === "96");
    await page.fill("#search", "nothing-matches");
    await text("#result-count", "0");
    await count(".product", 0);
    assert.equal(await page.locator("#next").isDisabled(), true);
    await page.fill("#search", "");
    await click("#chip-all");
    await count(".product", 48);
    await text("#cart-count", "1");
  } else if (kind === "dashboard") {
    await count("tbody tr", 50);
    assert.equal(await page.locator("tbody tr").first().getAttribute("data-id"), "100");
    await click("#next");
    await text("#page-number", "2");
    assert.equal(await page.locator("tbody tr").first().getAttribute("data-id"), "50");
    await click("#tab-activity");
    await text("#tab-content", "Recent activity: 12 projects delivered");
    await click("#menu-toggle");
    await click("#export");
    await text("#dashboard-status", "Export prepared");
    await page.fill("#date-from", "2026-10-02");
    await text("#date-summary", "2026-10-02 to 2026-10-28");
  } else if (kind === "settings") {
    await count("[aria-invalid=true]", 15);
    assert.equal(await page.locator("[role=dialog]").count(), 0);
    for (let i = 0; i < 15; i++) await page.fill(`#field-${i}`, i === 1 ? "alex@example.test" : "Updated value");
    await click("#notifications");
    assert.equal(await page.locator("#notifications").isChecked(), false);
    await click("#save");
    await text("#dialog-title", "Confirm settings");
    await click("#cancel");
    await count("[role=dialog]", 0);
    await click("#save");
    await click("#confirm");
    await text("#form-status", "Settings saved");
  } else {
    await count(".doc-section", 12);
    await page.fill("#doc-search", "Deployment");
    await count("#search-results a", 1);
    await click("#close-search");
    await count("[role=dialog]", 0);
    await click("#copy-0");
    await text("#copy-status", "Copied example 1");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "const workspace = createWorkspace();\nworkspace.start();");
    await click('#toc a[href="#section-3"]');
    assert.equal(new URL(page.url()).hash, "#section-3");
  }
}
