// URL base path end to end: fixture-base is built with `rivetRouter({ base: "/app" })` and served
// by the node adapter under /app (SSR, data requests, assets, 404 outside the base), driven in
// Chromium (Link / navigate() client navigation, prefetch, back), prerendered by the static adapter
// (files relative to the base) and answered by the fetch adapter.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";
import { loadBuild, readManifests } from "../adapters/build.ts";
import { prerender } from "../adapters/static.ts";
import { createFetch } from "../adapters/fetch.ts";
import { generate } from "../build/codegen.ts";
import { routeTable } from "../build/routes.ts";

const root = new URL("./fixture-base/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("codegen: patterns carry the base, types do not", () => {
  const files = generate(routeTable(["_layout.tsx", "index.tsx", "items/[id].tsx"]), { routesDir: "src/routes", base: "/app/" }).files;
  assert.match(files["routes.ts"]!, /pattern: "\/app", /);
  assert.match(files["routes.ts"]!, /pattern: "\/app\/items\/:id"/);
  assert.match(files["app.tsx"]!, /const PATHS: readonly string\[\] = \[[^\]]*"\/app\/items\/:id"/);
  assert.match(files["entry.server.tsx"]!, /export const base = "\/app";/);
  assert.doesNotMatch(files["routes.d.ts"]!, /\/app/);
  assert.match(generate(routeTable(["index.tsx"]), { routesDir: "src/routes" }).files["entry.server.tsx"]!, /export const base = "";/);
});

test(
  "base path: SSR, assets, data, client navigation, static and fetch adapters under /app",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("SSR under the base; links and assets carry it; outside the base is 404", async () => {
        const home = await fetch(app.url + "/app/");
        assert.equal(home.status, 200);
        const html = await home.text();
        assert.match(html, /<h1>Home<\/h1>/);
        assert.match(html, /<a href="\/app\/about">About<\/a>/);
        assert.match(html, /<a href="\/app\/">Home<\/a>/);
        // `<Link active>`: marked from the request URL; other attributes pass through.
        const tag = (id: string) => new RegExp(`<a [^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? "";
        assert.match(tag("section"), /aria-current="page"/);
        assert.match(tag("section"), /data-current=""/);
        assert.match(tag("section"), /data-kind="nav"/);
        assert.match(tag("section"), /title="Section"/);
        assert.match(tag("section"), /data-rivet-active="prefix"/);
        assert.doesNotMatch(tag("item-2"), /aria-current|data-current/);
        assert.match(tag("item-2"), /data-rivet-active="exact"/);
        const css = /<link rel="stylesheet" href="(\/app\/assets\/styles-[^"]+\.css)">/.exec(html)?.[1];
        assert.ok(css, "stylesheet under the base");
        const asset = await fetch(app.url + css);
        assert.equal(asset.status, 200);
        assert.match(asset.headers.get("cache-control")!, /immutable/);
        assert.equal((await fetch(app.url + "/app")).status, 200);
        assert.equal((await fetch(app.url + "/about")).status, 404);
        assert.equal((await fetch(app.url + "/assets/" + css.split("/").pop())).status, 404);
        const about = await (await fetch(app.url + "/app/about")).text();
        assert.match(about, /<p id="path">(<!--[^>]*-->)?\/app\/about</);
        const data = await fetch(app.url + "/app/about?_rivet=data", { headers: { accept: "application/json" } });
        assert.equal(data.status, 200);
        assert.match(data.headers.get("content-type")!, /json/);
      });

      await t.test("client navigation: Link, navigate(), prefetch, back; links outside the base load documents", async () => {
        const page = await browser.newPage();
        const errors: string[] = [],
          documents: string[] = [],
          data: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (request.resourceType() === "document") documents.push(url.pathname);
          if (url.searchParams.get("_rivet") === "data") data.push(url.pathname);
        });
        await page.goto(app.url + "/app/");
        // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent).
        await page.dispatchEvent("a[href^='/']", "pointerdown");
        await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
        await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
        const heading = (value: string) => page.waitForFunction((value) => document.querySelector("h1")?.textContent === value, value);
        await page.hover('nav a[href="/app/about"]');
        for (let i = 0; i < 100 && !data.length; i++) await page.waitForTimeout(20);
        assert.deepEqual(data, ["/app/about"], "prefetch under the base");
        await page.evaluate(() => document.querySelector<HTMLElement>('nav a[href="/app/about"]')!.click());
        await heading("About");
        assert.equal(new URL(page.url()).pathname, "/app/about");
        const current = (id: string) =>
          page.evaluate((id) => [document.getElementById(id)!.getAttribute("aria-current"), document.getElementById(id)!.hasAttribute("data-current")], id);
        // Active links follow client navigation: below the section link's path, `aria-current="true"`.
        await page.waitForFunction(() => document.getElementById("section")!.getAttribute("aria-current") === "true");
        assert.deepEqual(await current("item-2"), [null, false]);
        assert.equal(await page.textContent("#path"), "/app/about");
        await page.evaluate(() => document.querySelector<HTMLElement>('nav a[href="/app/"]')!.click());
        await heading("Home");
        await page.evaluate(() => document.querySelector<HTMLElement>("#go-item")!.click());
        await heading("Item 2");
        assert.equal(new URL(page.url()).pathname, "/app/items/2");
        await page.waitForFunction(() => document.getElementById("item-2")!.getAttribute("aria-current") === "page");
        assert.deepEqual(await current("item-2"), ["page", true]);
        await page.goBack();
        await heading("Home");
        assert.equal(new URL(page.url()).pathname, "/app/");
        await page.waitForFunction(() => !document.getElementById("item-2")!.hasAttribute("aria-current"));
        assert.deepEqual(await current("section"), ["page", true]);
        assert.deepEqual(documents, ["/app/"], "client navigation only");
        await page.evaluate(() => document.querySelector<HTMLElement>("#outside")!.click());
        await page.waitForURL(/\/elsewhere$/);
        assert.deepEqual(documents, ["/app/", "/elsewhere"], "outside the base: a document load");
        assert.deepEqual(errors, []);
        await page.close();
      });

      await t.test("static adapter: files relative to the base, pages link under it", async () => {
        const out = await mkdtemp(join(tmpdir(), "rivet-base-"));
        try {
          const { entry, handler } = await loadBuild(root + "dist");
          assert.equal(entry.base, "/app");
          const report = await prerender({ handler, routes: entry.routes, outDir: out, base: entry.base!, csp: false });
          assert.deepEqual(report.pages.sort(), ["/app", "/app/about", "/app/items/1", "/app/items/2"]);
          for (const file of ["index.html", "about/index.html", "about/_data.json", "items/1/index.html", "404.html"]) await stat(join(out, file));
          assert.match(await readFile(join(out, "about/index.html"), "utf8"), /<a href="\/app\/items\/1">/);
        } finally {
          await rm(out, { recursive: true, force: true });
        }
      });

      await t.test("fetch adapter answers under the base", async () => {
        const entry = await import(new URL("./fixture-base/dist/server/entry.server.js", import.meta.url).href);
        const worker = createFetch(entry, await readManifests(root + "dist", { base: entry.base }));
        const response = await worker.fetch(new Request("http://edge.example/app/about"));
        assert.equal(response.status, 200);
        assert.match(await response.text(), /<link rel="stylesheet" href="\/app\/assets\/styles-/);
        assert.equal((await worker.fetch(new Request("http://edge.example/about"))).status, 404);
      });
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
