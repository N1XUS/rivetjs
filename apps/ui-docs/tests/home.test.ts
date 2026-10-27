// Home page contracts on the BUILT site (apps/ui-docs/dist/client): structure, light + dark, phone width,
// and every interactive part working on a cold page (first input, no warm-up). Needs `nx run ui-docs:build` first: the
// suite skips without a build, unless RIVET_UI_DOCS_SITE=1 (CI ui-docs job, after the build) makes a missing build fail.
import { strict as assert } from "node:assert";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, test } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const app = resolve(fileURLToPath(new URL("..", import.meta.url)));
const client = resolve(app, "dist/client");
const built = existsSync(resolve(client, "index.html"));
const required = process.env.RIVET_UI_DOCS_SITE === "1";
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
};

test("built site present when required", () => {
  if (required) assert.ok(built, `RIVET_UI_DOCS_SITE=1 but ${client}/index.html is missing (run nx run ui-docs:build)`);
});

describe.skipIf(!built)("ui-docs home (built)", () => {
  let server: Server;
  let origin: string;
  let browser: Browser;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let path = resolve(client, "." + decodeURIComponent(new URL(req.url!, "http://x").pathname));
      if (existsSync(path) && !path.slice(path.lastIndexOf("/")).includes(".")) path = resolve(path, "index.html");
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

  async function home(options: { width?: number; scheme?: "light" | "dark" } = {}): Promise<Page> {
    const context = await browser.newContext({ viewport: { width: options.width ?? 1440, height: 900 }, colorScheme: options.scheme ?? "light" });
    const page = await context.newPage();
    await page.goto(origin + "/", { waitUntil: "load" });
    return page;
  }
  const close = (page: Page) => page.context().close();

  test("structure: hero, showcase, sections, component directory from the nav", async () => {
    const page = await home();
    try {
      assert.equal(
        (await page.getByRole("heading", { level: 1 }).innerText()).replace(/\s+/g, " ").trim(),
        "Polished components. Resumable from the first byte.",
      );
      assert.equal(await page.locator("h1 .uih-gradient").textContent(), "Resumable");
      const h2 = (await page.locator(".uih h2").allTextContents()).map((t) => t.trim());
      for (const title of ["One attribute, a different look", "Light and dark, from one set of tokens", "Accessible without extra work", "Your classes win"])
        assert.ok(h2.includes(title), `section "${title}" (got ${h2.join(" | ")})`);
      // Directory = every component page (content/components/*.md minus the overview), each linking to its page.
      const pages = readdirSync(resolve(app, "content/components")).filter((f) => f.endsWith(".md") && f !== "overview.md").length;
      const links = await page.locator(".uih-directory a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      assert.equal(links.length, pages);
      assert.ok(links.every((href) => /^\/components\/[a-z-]+\/$/.test(href ?? "")));
      assert.ok(h2.includes(`${pages} components, one stylesheet`));
      // Starter command: a docs code panel (copy button handled by the page script).
      assert.equal(await page.locator(".uih-install pre").textContent(), "npm create rivet@latest my-app -- --template ui");
      assert.equal(await page.locator(".uih-install .copy-button").count(), 1);
      // Collage tiles render server-side.
      for (const tile of ["form", "kpi", "verify", "buttons", "profile", "signup", "unsaved", "review", "schedule", "chart", "prompt"])
        assert.equal(await page.locator(`#home-collage [data-tile="${tile}"]`).count(), 1, tile);
    } finally {
      await close(page);
    }
  });

  test("no JS before input: no boundary boots at load (no load / idle / visible effects)", () => {
    const html = readFileSync(resolve(client, "index.html"), "utf8");
    const tail = /<script type="rivet\/boundaries"([^>]*)>/.exec(html);
    assert.ok(tail, "boundary tail");
    assert.ok(!/\sdata-boot\b/.test(tail[1]), "data-boot on the tail: a component on the home page starts the runtime at load");
  });

  test("light and dark: ui tokens follow the theme; the scheme panels stay forced", async () => {
    const lum = (page: Page, selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => {
          // Canvas resolves any CSS colour syntax (oklch, color-mix results) to sRGB bytes.
          const context = document.createElement("canvas").getContext("2d")!;
          context.fillStyle = getComputedStyle(el).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
          return (r + g + b) / 3;
        });
    const light = await home({ scheme: "light" });
    const dark = await home({ scheme: "dark" });
    try {
      assert.equal(await dark.evaluate(() => document.documentElement.dataset.theme), "dark");
      assert.ok((await lum(light, "#home-collage")) > 200, "light collage background");
      assert.ok((await lum(dark, "#home-collage")) < 60, "dark collage background");
      for (const page of [light, dark]) {
        assert.ok((await lum(page, ".uih-scheme-light")) > 200, "forced-light panel stays light");
        assert.ok((await lum(page, ".uih-scheme-dark")) < 60, "forced-dark panel stays dark");
      }
    } finally {
      await close(light);
      await close(dark);
    }
  });

  test("phone width: no horizontal scroll, collage in one column", async () => {
    const page = await home({ width: 375 });
    try {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
      const columns = await page.locator(".uih-bento").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      assert.equal(columns, 1);
    } finally {
      await close(page);
    }
  });

  test("cold: an accent swatch re-themes the collage; a view opens its screen frame", async () => {
    const page = await home();
    try {
      await page.getByRole("option", { name: "Ember" }).click();
      await page.waitForFunction(() => document.getElementById("home-collage")?.dataset.uiPreset === "ember", null, { timeout: 10000 });
      await page.getByRole("radio", { name: "Mail" }).click();
      await page.locator(".uih-screen iframe[src='/examples/showcase-mail/frame/']").waitFor({ timeout: 10000 });
      assert.equal(await page.locator("#home-collage").isVisible(), false, "collage hidden while a screen is open");
      await page.getByRole("radio", { name: "Components" }).click();
      await page.locator("#home-collage").waitFor({ state: "visible", timeout: 10000 });
      assert.equal(await page.locator(".uih-screen").count(), 0);
    } finally {
      await close(page);
    }
  });

  test("cold: collage tiles answer their first press", async () => {
    const page = await home();
    try {
      await page.locator("#home-follow").click();
      await page.waitForFunction(() => document.getElementById("home-followers")?.textContent === "4,211", null, { timeout: 10000 });
      assert.equal(await page.locator("#home-follow").textContent(), "Following");
      await page.locator("#home-save").click();
      await page.locator('[data-tile="unsaved"]').getByText("Changes saved").waitFor({ timeout: 10000 });
      await page.locator('[data-tile="review"] .rating__item').nth(1).click();
      await page.waitForFunction(() => document.getElementById("home-stars")?.textContent === "2", null, { timeout: 10000 });
    } finally {
      await close(page);
    }
  });

  test("cold: the look switch swaps the Themes cards' preset and the builder link", async () => {
    const page = await home();
    try {
      await page.locator(".uih-looks-bar").getByRole("radio", { name: "Brutalist" }).click();
      await page.waitForFunction(() => document.getElementById("home-looks")?.dataset.uiPreset === "brutalist", null, { timeout: 10000 });
      await page.waitForFunction(() => document.getElementById("home-edit-theme")?.getAttribute("href")?.startsWith("/themes/?"), null, { timeout: 10000 });
    } finally {
      await close(page);
    }
  });

  test("cold keyboard: the delivery radios move with the arrow keys", async () => {
    const page = await home();
    try {
      const standard = page.locator('input[name="home-delivery"][value="standard"]');
      await standard.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(() => (document.querySelector('input[name="home-delivery"][value="express"]') as HTMLInputElement | null)?.checked, null, {
        timeout: 10000,
      });
      assert.equal(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.value), "express");
    } finally {
      await close(page);
    }
  });
});
