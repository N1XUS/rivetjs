// /about/benchmarks/ on the BUILT site (nx `docs:test` depends on `docs:build`), in Chromium. STATIC-ZERO-3 2026-10-27:
// the charts are server HTML + CSS (docs-kit `BenchChart.tsx`, `bench-chart.css`; they were canvases drawn by a
// `visible` client effect that booted the resume runtime at load): no JS before input, marks placed by their share of
// the axis at both widths, CSS hover tooltips, keyboard reading (arrows / Home / End / Escape) with the docs page script.
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

async function benchmarks(width: number): Promise<{ page: Page; js: string[] }> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const js: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".js")) js.push(new URL(request.url()).pathname);
  });
  await page.goto(origin + "/about/benchmarks/", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  return { page, js };
}

/** Bar widths of the first bar chart over its track width, against value / axis max of the visible axis. */
const geometry = async (page: Page) => {
  // Scrolled into view first: the rows' scroll-driven entrance (view timeline) settles on the next frames.
  await page.evaluate(() => document.querySelector('.bench-chart[data-kind="bar"] .bench-plot')!.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const plot = document.querySelector<HTMLElement>('.bench-chart[data-kind="bar"] .bench-plot')!;
    const axis = [...plot.querySelectorAll<HTMLElement>(".bench-axis")].find((el) => el.offsetParent !== null)!;
    const ticks = [...axis.querySelectorAll("span:not(.bench-unit)")].map((el) => Number(el.textContent!.replace(/,/g, "")));
    const max = ticks.at(-1)!;
    const table = [...plot.closest("figure")!.querySelectorAll(".bench-table tbody tr td:nth-of-type(2)")].map((td) => Number(td.textContent!.replace(/,/g, "")));
    return [...plot.querySelectorAll<HTMLElement>(".bench-row")].map((row, i) => {
      const track = row.querySelector<HTMLElement>(".bench-track")!.getBoundingClientRect();
      const bar = row.querySelector<HTMLElement>(".bench-bar")!.getBoundingClientRect();
      return { share: bar.width / track.width, want: table[i]! / max, value: row.querySelector(".bench-value")!.textContent };
    });
  });
};

test("benchmarks: no JS before input; bars match the table values at both widths", async () => {
  for (const width of [1280, 412]) {
    const { page, js } = await benchmarks(width);
    try {
      assert.deepEqual(js, [], `JS fetched before input at ${width}px`);
      await page.waitForTimeout(300);
      const rows = await geometry(page);
      assert.ok(rows.length > 2);
      for (const row of rows) assert.ok(Math.abs(row.share - row.want) < 0.01, `bar ${row.value}: ${row.share} vs ${row.want} at ${width}px`);
      assert.equal(await page.evaluate(() => document.querySelectorAll(".bench-chart canvas").length), 0);
    } finally {
      await page.close();
    }
  }
});

test("benchmarks: hover shows the row's tooltip; keyboard steps through the values and announces them", async () => {
  const { page } = await benchmarks(1280);
  try {
    const plot = page.locator('.bench-chart[data-kind="bar"] .bench-plot').first();
    await plot.scrollIntoViewIfNeeded();
    const second = plot.locator(".bench-row").nth(1);
    await second.hover();
    assert.ok(await second.locator(".bench-tip").isVisible(), "hover tooltip");
    assert.match((await second.locator(".bench-tip").innerText()) ?? "", /median/);
    await page.mouse.move(5, 5);
    // Keyboard modality first (a Tab), so the scripted focus is :focus-visible like a Tab onto the plot.
    await page.keyboard.press("Tab");
    await plot.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector('.bench-chart[data-kind="bar"] .bench-row[data-active]'));
    const say = await plot.locator(".bench-live").textContent();
    assert.match(say ?? "", /median .+, /);
    const scroll = await page.evaluate(() => scrollY);
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const rows = [...document.querySelector('.bench-chart[data-kind="bar"] .bench-plot')!.querySelectorAll(".bench-row")];
      return rows.at(-1)!.hasAttribute("data-active");
    });
    assert.equal(await page.evaluate(() => scrollY), scroll, "chart keys do not scroll the page");
    assert.ok(await plot.locator(".bench-row[data-active] .bench-tip").isVisible());
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector('.bench-chart[data-kind="bar"] .bench-row[data-active]'));
  } finally {
    await page.close();
  }
});
