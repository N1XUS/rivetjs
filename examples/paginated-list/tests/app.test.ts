// Builds the example and boots the production server: canonical redirects, query handling, the data endpoint, JS budget.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const cwd = process.cwd();
const PORT = 4471;
const base = `http://127.0.0.1:${PORT}`;
let serving: { close(): Promise<unknown> } | undefined;
let jsBytes = 0;

beforeAll(async () => {
  const bin = ["node_modules/vite/bin/vite.js", "../../node_modules/vite/bin/vite.js"].map((p) => join(root, p)).find((p) => existsSync(p))!;
  for (const args of [["build"], ["build", "--ssr"]])
    execFileSync(process.execPath, [bin, ...args], { cwd: root, stdio: "pipe", env: { ...process.env, NODE_ENV: "production" } });
  process.chdir(root);
  const { start } = await import("@rivetjs/router/node");
  serving = (await start({ dist: join(root, "dist"), port: PORT, host: "127.0.0.1" })) as typeof serving;
  const html = await (await fetch(base + "/")).text();
  for (const m of html.matchAll(/src="([^"]+\.js)"/g)) jsBytes += (await (await fetch(base + m[1])).arrayBuffer()).byteLength;
}, 180_000);
afterAll(async () => {
  await serving?.close();
  process.chdir(cwd);
});

const page = async (search: string) => (await (await fetch(base + "/" + search)).text()).replace(/<!--.*?-->/g, "");

test("first page: summary, rows, next link, no previous link", async () => {
  const html = await page("");
  assert.match(html, /Showing 1–10 of 240/);
  assert.match(html, /<title>Books, page 1 of 24<\/title>/);
  assert.match(html, /rel="next"[^>]*href="\?page=2"|href="\?page=2"[^>]*rel="next"/);
  assert.doesNotMatch(html, /rel="prev"/);
});

test("invalid and out-of-range pages redirect to the canonical URL", async () => {
  for (const [search, to] of [
    ["?page=99", "/?page=24"],
    ["?page=0", "/"],
    ["?page=abc", "/"],
    ["?page=1.5", "/"],
    ["?page=Infinity", "/"],
    ["?q=zzzz&page=9", "/?q=zzzz"],
    ["?per=20&page=50", "/?per=20&page=12"],
  ]) {
    const r = await fetch(base + "/" + search, { redirect: "manual" });
    assert.ok(r.status >= 300 && r.status < 400, `${search}: ${r.status}`);
    const location = new URL(r.headers.get("location")!, base);
    assert.equal(location.pathname + location.search, to);
  }
});

test("search, sort and page size", async () => {
  const found = await page("?q=engine");
  assert.match(found, /Showing 1–10 of 12/);
  assert.match(found, /value="engine"/);
  const sorted = await page("?sort=year&dir=desc&per=20");
  assert.match(sorted, /Showing 1–20 of 240/);
  assert.match(sorted, /aria-sort="descending"/);
  const years = [...sorted.matchAll(/tabular-nums">(\d{4})</g)].map((m) => Number(m[1]));
  assert.equal(years.length, 20);
  assert.deepEqual(
    years,
    [...years].sort((a, b) => b - a),
  );
  assert.match(await page("?q=zzzz"), /No books match/);
});

test("the data endpoint answers in-place navigations", async () => {
  const r = await fetch(base + "/?page=3&_rivet=data", { headers: { accept: "application/json" } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /json/);
  assert.match(await r.text(), /"page":3/);
});

test("client JS stays within budget", () => {
  const budget = 40 * 1024;
  assert.ok(jsBytes <= budget, `${jsBytes} > ${budget}`);
});

test("cold pagination, history and search update the live list without a document reload", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors: string[] = [];
    const documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
    });
    await page.goto(base);
    await page.evaluate(() => document.querySelector("main")!.setAttribute("data-kept", "yes"));
    await page.locator("#next").click();
    await page.waitForFunction(() => document.querySelector("#summary")?.textContent === "Showing 11–20 of 240");
    assert.equal(await page.title(), "Books, page 2 of 24");
    await page.goBack();
    await page.waitForFunction(() => document.querySelector("#summary")?.textContent === "Showing 1–10 of 240");
    await page.goForward();
    await page.waitForFunction(() => document.querySelector("#summary")?.textContent === "Showing 11–20 of 240");
    await page.getByRole("navigation", { name: "Rows per page" }).getByRole("link", { name: "20", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#summary")?.textContent === "Showing 1–20 of 240");
    await page.locator("#q").fill("engine");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#summary")?.textContent === "Showing 1–12 of 12");
    assert.equal(new URL(page.url()).search, "?q=engine&per=20");
    assert.equal(await page.locator("#rows tr").count(), 12);
    assert.equal(await page.locator("main").getAttribute("data-kept"), "yes");
    assert.deepEqual(documents, [base + "/"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
