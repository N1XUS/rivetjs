// Search palette on the BUILT site (nx `docs:test` depends on `docs:build`), in Chromium: a cold keyboard shortcut
// fetches only the palette and the light cdk overlay primitives (DOCS-COLD 2026-10-20: 187 KB before, the cdk Modal /
// Dialog closure with collections; SEARCH-CHUNK 2026-10-27: 223 KB, the palette chunk imported the 189 KB highlighter
// entry that held rolldown's runtime — docs-kit `vite.ts` `docsChunks`), and the palette is a modal: focus inside,
// Escape / outside press close it, the page around it is inert while open, focus returns, the query is kept for the
// next open. A lone Ctrl keydown and trigger hover / focus fetch the palette ahead, so the press fetches none of it
// (CHUNK-CYCLE 2026-10-20).
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const client = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist/client");
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
let server: Server;
let origin: string;
let browser: Browser;

beforeAll(async () => {
  server = createServer((req, res) => {
    let path = resolve(client, "." + decodeURIComponent(new URL(req.url!, "http://x").pathname));
    if (existsSync(path) && !path.includes(".", path.lastIndexOf("/"))) path = resolve(path, "index.html");
    if (!existsSync(path)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[path.slice(path.lastIndexOf("."))] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await new Promise((done) => server?.close(done));
});

/** A docs page, settled (load + its idle work), with every JS response recorded as [path, bytes]. */
async function docsPage(path: string): Promise<{ page: Page; js: [string, number][] }> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const js: [string, number][] = [];
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith(".js")) js.push([url.pathname, (await response.body().catch(() => Buffer.alloc(0))).length]);
  });
  await page.goto(origin + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  return { page, js };
}

/** Raw bytes of the JS the palette's first paint needed (budget: the ~40 KB cdk overlay primitives + the palette). */
const PALETTE_BUDGET = 48 * 1024;

test("search: a cold Ctrl+K fetches only the palette + light overlay primitives; the input is focused", async () => {
  const { page, js } = await docsPage("/start/tutorial/");
  try {
    const mark = js.length;
    await page.keyboard.press("Control+k");
    const input = page.getByRole("combobox", { name: "Search the docs" });
    await input.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.activeElement?.matches(".search-box input"));
    await page.waitForLoadState("networkidle");
    // The DOM runtime chunk (RT-DIET2 DOCS-CHROME: docs pages boot no runtime before input, so the first overlay brings
    // it; once per page, shared with the theme menu / drawer) is not the palette's. The docs page script (DOCS-ZERO:
    // fetched on this first intent, 5 KB) is counted.
    const fetched = js.slice(mark).filter(([path]) => !/\/dom-derived(?:-abi)?-[\w-]+\.js$/.test(path));
    assert.ok(js.slice(mark).length - fetched.length <= 1, "one DOM runtime chunk");
    const bytes = fetched.reduce((sum, [, size]) => sum + size, 0);
    assert.ok(bytes <= PALETTE_BUDGET, `palette fetched ${bytes} B: ${fetched.map(([path, size]) => `${path} ${size}`).join(", ")}`);
    assert.equal(await page.getByRole("dialog", { name: "Search the documentation" }).getAttribute("aria-modal"), "true");
  } finally {
    await page.close();
  }
});

test("search: the palette is fetched ahead on a lone Ctrl keydown and on trigger hover / focus — the press fetches none of it", async () => {
  // The palette files: what a lone Ctrl keydown fetches (the palette chunk + light overlay primitives).
  let palette: string[] = [];
  for (const ahead of ["control", "hover", "focus"] as const) {
    const { page, js } = await docsPage("/start/tutorial/");
    try {
      const before = js.length;
      if (ahead === "hover") await page.hover(".search-button-bar");
      else if (ahead === "focus") await page.focus(".search-button-bar");
      else await page.keyboard.down("Control");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      await page.waitForLoadState("networkidle");
      const fetched = js.slice(before).map(([path]) => path);
      if (ahead === "control") palette = fetched;
      assert.ok(palette.some((path) => /\/dialog-[\w-]+\.js$/.test(path)), `${ahead}: no palette chunk fetched ahead: ${fetched.join(", ")}`);
      for (const path of palette) assert.ok(fetched.includes(path), `${ahead}: ${path} not fetched ahead`);
      const mark = js.length;
      if (ahead === "hover") await page.mouse.down().then(() => page.mouse.up());
      else if (ahead === "focus") await page.keyboard.press("Enter");
      else await page.keyboard.press("k").then(() => page.keyboard.up("Control"));
      await page.getByRole("combobox", { name: "Search the docs" }).waitFor({ state: "visible" });
      await page.waitForLoadState("networkidle");
      const after = js.slice(mark).map(([path]) => path);
      // A press through the link's own click handler still prefetches the shell's intent sibling at low priority (frame
      // menus, loader chunk-group policy); never palette code.
      if (ahead === "control") assert.deepEqual(after, [], "Ctrl+K fetched JS");
      for (const path of after) assert.ok(!palette.includes(path) && !/\/dialog-/.test(path), `${ahead}: the press fetched ${path}`);
    } finally {
      await page.close();
    }
  }
});

test("search: modal palette — Tab stays inside, outside is inert, Escape / outside press close, focus returns, query kept", async () => {
  const { page } = await docsPage("/start/tutorial/");
  try {
    const trigger = page.locator(".search-button-bar");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search the documentation" });
    await dialog.waitFor({ state: "visible" });
    const input = page.getByRole("combobox", { name: "Search the docs" });
    await page.waitForFunction(() => document.activeElement?.matches(".search-box input"));
    await input.fill("signal");
    // Focus trap: Tab cycles input → close button → input.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => !!document.activeElement?.closest(".search-dialog")), "focus left the palette");
    }
    // The page around it: inert while open, scroll locked.
    assert.equal(await page.evaluate(() => (document.querySelector(".site-main, main") as HTMLElement | null)?.closest("[inert]") !== null), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.querySelector("[inert]")), null, "inert released");
    // Focus restore runs after the dialog detached (FocusScope cleanup): wait for it instead of reading the active element at once.
    await page.waitForFunction(() => document.activeElement?.matches(".search-button-bar"), null, { timeout: 5_000 });
    // Reopen: the query is kept; an outside press closes.
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await input.inputValue(), "signal");
    await page.mouse.click(20, 780);
    await dialog.waitFor({ state: "detached" });
  } finally {
    await page.close();
  }
});

// 2026-10-20: a result click pushed the URL but the page stayed — the `::api` card threw `ApiCard: unknown symbol`
// in the browser (`virtual:docs/api` is empty there); the card data is now inlined by content generation.
test("search: a result click navigates on the client; a page with an `::api` card renders", async () => {
  const { page } = await docsPage("/start/tutorial/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.locator(".search-button-bar").click();
    const input = page.getByRole("combobox", { name: "Search the docs" });
    await page.waitForFunction(() => document.activeElement?.matches(".search-box input"));
    await input.fill("signals");
    const hit = page.getByRole("option").filter({ hasText: /^Signals\s*Learn/ }).first();
    await hit.waitFor({ state: "visible" });
    await hit.click();
    await page.waitForURL(origin + "/learn/signals/");
    await page.getByRole("heading", { level: 1, name: "Signals" }).waitFor({ state: "visible" });
    await page.locator(".api-card .api-card-head code", { hasText: "signal" }).first().waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1, "no document reload");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

// DOCS-ZERO 2026-10-27: docs pages link no module; an inline stub (docs-kit `document.ts` `PAGE_STUB`) imports the docs
// page script on the first intent and queues the events that came before it (defaults prevented at once), which the
// module replays. The module is held back here so every event lands before it.
test("page script: no JS before input; events before the module replay (Ctrl+K, theme click, scroll-spy)", async () => {
  const slow = async (page: Page) =>
    page.route(/\/docs-page-[\w-]+\.js$/, async (route) => {
      await new Promise((done) => setTimeout(done, 400));
      await route.continue();
    });
  {
    const { page, js } = await docsPage("/reference/glossary/");
    try {
      assert.equal(js.length, 0, `JS fetched before input: ${js.map(([path]) => path).join(", ")}`);
      await slow(page);
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox", { name: "Search the docs" }).waitFor({ state: "visible" });
      assert.ok(js.some(([path]) => /\/docs-page-/.test(path)), "first intent fetched the page script");
      assert.equal(await page.evaluate(() => (window as unknown as { __rvDocs?: unknown }).__rvDocs), null, "stub handed over");
    } finally {
      await page.close();
    }
  }
  {
    const { page } = await docsPage("/reference/glossary/");
    try {
      await slow(page);
      await page.click(".theme-button");
      await page.getByRole("menuitemradio", { name: "Dark" }).waitFor({ state: "visible" });
      await page.getByRole("menuitemradio", { name: "Dark" }).click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
      // The wheel over the page body (the pointer still rests where the menu was).
      await page.mouse.move(640, 400);
      await page.mouse.wheel(0, 1500);
      await page.waitForFunction(() => document.querySelector('.toc-list a[aria-current="true"]'), null, { timeout: 5_000 });
    } finally {
      await page.close();
    }
  }
});

// STATIC-ZERO-3 2026-10-27: the search page is static (no load-time effect, no resume runtime): no JS before input; with
// `?q=` the stub imports the page script at load, which opens the dialog with the query.
test("search page: no JS before input; ?q= opens the dialog with the query", async () => {
  {
    const { page, js } = await docsPage("/search/");
    try {
      assert.equal(js.length, 0, `JS fetched before input: ${js.map(([path]) => path).join(", ")}`);
    } finally {
      await page.close();
    }
  }
  {
    const { page } = await docsPage("/search/?q=signal");
    try {
      const input = page.getByRole("combobox", { name: "Search the docs" });
      await input.waitFor({ state: "visible" });
      assert.equal(await input.inputValue(), "signal");
    } finally {
      await page.close();
    }
  }
});
