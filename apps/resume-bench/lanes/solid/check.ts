// Verifies the Solid lane against ../../FIXTURE.md: build into a temp dir, serve statically, drive Chromium.
import type { AddressInfo } from "node:net";
import { build } from "./build.ts";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const out = await mkdtemp(join(tmpdir(), "resume-bench-solid-"));
await build(out);

const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const served: string[] = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url!, "http://x").pathname;
  served.push(path);
  if (path.startsWith("/item/")) return res.writeHead(404).end("not found");
  const file = path === "/" ? "/index.html" : normalize(path);
  try {
    const body = await readFile(join(out, file));
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const results: { name: string; ok: boolean }[] = [];
const check = (name: string, ok: unknown, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch();
const errors: string[] = [];
try {
  // 1. SSR HTML
  const html = await readFile(join(out, "index.html"), "utf8");
  const rows = html.match(/<li[^>]*class="row"[^>]*data-id="\d+"/g) ?? [];
  check("SSR HTML contains 1000 rows", rows.length === 1000, `${rows.length}`);
  check("SSR has header/panel/canvas/filter", [/<header id="bar" style="position:sticky;top:0;background:#fff">/, /<p[^>]* id="closed">closed<\/p>/, /<canvas id="chart" width="300" height="150"/, /<input id="filter" type="search"/].every((re) => re.test(html)));

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`console.${m.type()}: ${m.text()}`));
  const jsResponses: { url: string; body: Buffer }[] = [];
  page.on("response", async (r) => {
    if (r.request().resourceType() === "script") jsResponses.push({ url: r.url(), body: await r.body().catch(() => Buffer.alloc(0)) });
  });
  let documents = 0;
  page.on("request", (r) => r.isNavigationRequest() && r.frame() === page.mainFrame() && documents++);

  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const preJs = jsResponses.map((r) => ({ url: new URL(r.url).pathname, raw: r.body.length, gz: gzipSync(r.body).length }));
  const preRaw = preJs.reduce((a, r) => a + r.raw, 0);
  const preGz = preJs.reduce((a, r) => a + r.gz, 0);
  console.log("JS before interaction:", preJs.map((r) => `${r.url} ${r.raw}B (${r.gz}B gz)`).join(", "), `total ${preRaw}B raw / ${preGz}B gz`);
  check("lazy Detail chunk not loaded before navigation", !preJs.some((r) => r.url.includes("Detail")));

  // 2. analytics at idle
  await page.waitForFunction(() => window.__analytics?.length! >= 1, null, { timeout: 5000 }).catch(() => {});
  check("analytics pageview at idle", JSON.stringify(await page.evaluate(() => window.__analytics)) === JSON.stringify([["pageview", "/"]]));

  // 3. counter
  await page.click("#inc");
  await page.waitForFunction(() => document.querySelector<HTMLElement>("#count")!.textContent === "1", null, { timeout: 3000 }).catch(() => {});
  check("counter increments after hydration", (await page.textContent("#count")) === "1");

  // 4. toggle
  await page.click("#toggle");
  await page.waitForSelector("#open", { timeout: 3000 }).catch(() => {});
  const openHtml = await page.evaluate(() => document.querySelector("#panel")?.innerHTML);
  check("toggle shows open <b>N</b>", openHtml === '<p id="open">open <b>1</b></p>', openHtml);
  await page.click("#inc");
  await page.waitForTimeout(50);
  check("open region tracks counter", (await page.textContent("#open b")) === "2");
  await page.click("#toggle");
  await page.waitForTimeout(50);
  check("toggle back to closed", (await page.evaluate(() => document.querySelector<HTMLElement>("#panel")!.innerHTML)) === '<p id="closed">closed</p>');

  // 5. scroll + canvas (full list makes page tall)
  check("canvas not drawn while off-screen", (await page.getAttribute("#chart", "data-drawn")) === null);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForFunction(() => document.querySelector<HTMLElement>("#scrolled")!.textContent === "scrolled", null, { timeout: 3000 }).catch(() => {});
  check("#scrolled -> scrolled after scrollY > 100", (await page.textContent("#scrolled")) === "scrolled");
  await page.evaluate(() => document.querySelector<HTMLElement>("#chart")!.scrollIntoView());
  await page.waitForFunction(() => document.querySelector<HTMLElement>("#chart")!.dataset.drawn === "1", null, { timeout: 3000 }).catch(() => {});
  check("canvas data-drawn=1 after scrolling into view", (await page.getAttribute("#chart", "data-drawn")) === "1");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector<HTMLElement>("#scrolled")!.textContent === "top", null, { timeout: 3000 }).catch(() => {});
  check("#scrolled -> top after scrolling back", (await page.textContent("#scrolled")) === "top");

  // 6. filter + pick
  await page.fill("#filter", "golf");
  await page.waitForFunction(() => document.querySelectorAll("#rows li.row").length === 100, null, { timeout: 3000 }).catch(() => {});
  check('filter "golf" leaves 100 rows', (await page.locator("#rows li.row").count()) === 100);
  await page.click('#rows li[data-id="17"] button.pick');
  await page.waitForTimeout(50);
  check("pick adds sel", (await page.getAttribute('#rows li[data-id="17"]', "class")) === "row sel");
  check("only one row selected", (await page.locator("#rows li.sel").count()) === 1);

  // 7. client navigation to detail
  await page.evaluate(() => (window.__marker = 1));
  const docsBefore = documents;
  await page.click('#rows li[data-id="7"] a.open');
  await page.waitForSelector("#detail", { timeout: 5000 }).catch(() => {});
  check("row link -> /item/7", new URL(page.url()).pathname === "/item/7");
  check("#detail shows label", (await page.textContent("#detail h2").catch(() => null)) === "Row 7 golf");
  check("no document reload", documents === docsBefore && (await page.evaluate(() => window.__marker)) === 1);
  check("list unmounted on detail", (await page.locator("#rows").count()) === 0);
  await page.waitForFunction(() => window.__analytics?.length! >= 2, null, { timeout: 5000 }).catch(() => {});
  check("analytics pageview on navigation", JSON.stringify(await page.evaluate(() => window.__analytics)) === JSON.stringify([["pageview", "/"], ["pageview", "/item/7"]]));

  // 8. back link
  await page.click("#back");
  await page.waitForSelector("#rows", { timeout: 3000 }).catch(() => {});
  check("back link -> /", new URL(page.url()).pathname === "/");
  check("filter preserved after back link", (await page.inputValue("#filter")) === "golf" && (await page.locator("#rows li.row").count()) === 100);
  check("selection preserved after back link", (await page.getAttribute('#rows li[data-id="17"]', "class")) === "row sel");

  // 9. browser back
  await page.click('#rows li[data-id="27"] a.open');
  await page.waitForSelector("#detail", { timeout: 3000 }).catch(() => {});
  check("second navigation shows detail", (await page.textContent("#detail h2").catch(() => null)) === "Row 27 golf");
  await page.goBack();
  await page.waitForSelector("#rows", { timeout: 3000 }).catch(() => {});
  check("browser back -> list", new URL(page.url()).pathname === "/" && (await page.locator("#detail").count()) === 0);
  check("filter preserved after browser back", (await page.inputValue("#filter")) === "golf" && (await page.locator("#rows li.row").count()) === 100);
  await page.goForward();
  await page.waitForSelector("#detail", { timeout: 3000 }).catch(() => {});
  check("browser forward -> detail", (await page.textContent("#detail h2").catch(() => null)) === "Row 27 golf");
  check("still no document reload", documents === docsBefore && (await page.evaluate(() => window.__marker)) === 1);

  // 10. hygiene
  check("no page errors / console errors (incl. hydration mismatch)", errors.length === 0, errors.join(" | "));
  check("no /api/items fetch (data came from hydration payload)", !served.includes("/api/items"));
  check("no /item/* document request hit server", !served.some((p) => p.startsWith("/item/")));
} finally {
  await browser.close();
  server.close();
  await rm(out, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
