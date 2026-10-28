// Docs page script stub (`page-stub.ts`, THEME-JS 2026-10-28): an event on a chrome button (theme menu, mobile menu,
// search) preloads that part's closure with the page script, once; other events preload only the script's own imports.
// `chromeParts` (vite.ts) builds those closures from the client bundle.
// Run: `npx vitest run --project docs-kit libs/docs-kit/tests/page-stub.test.ts`.
import { strict as assert } from "node:assert";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import type { Rollup } from "vite";
import { PAGE_STUB, type StubParts } from "../page-stub.ts";
import { chromeParts } from "../vite.ts";

const chunk = (fileName: string, imports: string[], facadeModuleId: string | null = null) =>
  ({ type: "chunk", fileName, imports, facadeModuleId }) as unknown as Rollup.OutputChunk;

test("chromeParts: each part's chunk + its static closure, minus the page script's closure, URLs shared", () => {
  const chunks = [
    chunk("assets/docs-page.js", ["assets/preload-helper.js"], "/kit/page-script.ts"),
    chunk("assets/preload-helper.js", []),
    chunk("assets/theme.js", ["assets/menu.js", "assets/runtime.js", "assets/preload-helper.js"], "/kit/theme.tsx"),
    chunk("assets/menu.js", ["assets/press.js", "assets/runtime.js"]),
    chunk("assets/press.js", ["assets/runtime.js"]),
    chunk("assets/runtime.js", []),
    chunk("assets/mobile.js", ["assets/press.js", "assets/dialog.js"], "/kit/mobile.tsx"),
    chunk("assets/dialog.js", ["assets/runtime.js"]),
  ];
  const parts = chromeParts(
    chunks,
    "/kit/page-script.ts",
    [
      [".theme", "/kit/theme.tsx"],
      [".mobile", "/kit/mobile.tsx"],
      [".gone", "/kit/tree-shaken.tsx"],
    ],
    "/base/",
  );
  const files = (selector: string) => parts.lists.find(([name]) => name === selector)![1].map((index) => parts.urls[index]);
  assert.deepEqual(files(".theme"), ["/base/assets/theme.js", "/base/assets/menu.js", "/base/assets/press.js", "/base/assets/runtime.js"]);
  assert.deepEqual(files(".mobile"), ["/base/assets/mobile.js", "/base/assets/press.js", "/base/assets/runtime.js", "/base/assets/dialog.js"]);
  assert.equal(parts.urls.length, new Set(parts.urls).size, "deduped");
  assert.ok(!parts.urls.some((url) => url.includes("preload-helper")), "the page script's own imports stay out");
  assert.deepEqual(
    parts.lists.map(([selector]) => selector),
    [".theme", ".mobile"],
    "a part without a chunk is left out",
  );
  assert.deepEqual(chromeParts(chunks, "/kit/missing.ts", [], "/"), { urls: [], lists: [] });
});

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const ORIGIN = "http://stub.test";
const parts: StubParts = {
  urls: ["/a/theme.js", "/a/menu.js", "/a/mobile.js", "/a/dialog.js"],
  lists: [
    [".theme-button[data-chrome]", [0, 1]],
    [".menu-button[data-chrome]", [2, 1]],
    [".search-button", [3]],
  ],
};
const BODY =
  '<button class="theme-button" data-chrome style="width:40px;height:40px">t</button>' +
  '<button class="menu-button" data-chrome style="width:40px;height:40px">m</button>' +
  '<a class="search-button" href="/search/" style="display:block;width:40px;height:40px">s</a>' +
  '<p id="text" style="height:40px">text</p>';

/** A page with the stub; the page script never answers (the stub stays attached). */
async function stubPage(stubParts: StubParts = parts): Promise<Page> {
  const page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><script>${PAGE_STUB("/a/docs-page.js", ["/a/helper.js"], stubParts)}</script></head><body>${BODY}</body></html>`,
      });
      return;
    }
    if (url.pathname === "/a/docs-page.js") return; // held: the stub keeps handling events
    await route.fulfill({ contentType: "text/javascript", body: "export {};" });
  });
  await page.goto(ORIGIN + "/");
  return page;
}
const preloads = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map((link) => new URL(link.href).pathname));

test("stub: an event on a chrome button preloads its part's closure once, with the script's imports", async () => {
  const page = await stubPage();
  try {
    await page.hover("#text");
    assert.deepEqual(await preloads(page), ["/a/helper.js"], "plain intent: the script's own imports only");
    await page.hover(".theme-button");
    assert.deepEqual(await preloads(page), ["/a/helper.js", "/a/theme.js", "/a/menu.js"]);
    await page.hover("#text");
    await page.click(".theme-button");
    assert.deepEqual(await preloads(page), ["/a/helper.js", "/a/theme.js", "/a/menu.js"], "once per part");
    await page.hover(".menu-button");
    assert.deepEqual((await preloads(page)).slice(3), ["/a/mobile.js", "/a/menu.js"], "a shared file may repeat (the module map dedupes)");
  } finally {
    await page.close();
  }
});

test("stub: the search shortcut preloads the search part; a detached stub preloads nothing", async () => {
  const page = await stubPage();
  try {
    await page.keyboard.press("Control+k");
    assert.deepEqual(await preloads(page), ["/a/helper.js", "/a/dialog.js"]);
  } finally {
    await page.close();
  }
  const detached = await stubPage();
  try {
    await detached.evaluate(() => ((window as unknown as { __rvDocs: unknown }).__rvDocs = null));
    await detached.hover(".theme-button");
    await detached.hover(".theme-button", { position: { x: 2, y: 2 } });
    assert.deepEqual(await preloads(detached), [], "the module ran: no stub preloads");
  } finally {
    await detached.close();
  }
});

test("stub: without parts (dev, unbuilt) it preloads the script's imports only", async () => {
  const page = await stubPage({ urls: [], lists: [] });
  try {
    await page.click(".theme-button");
    assert.deepEqual(await preloads(page), ["/a/helper.js"]);
  } finally {
    await page.close();
  }
});
