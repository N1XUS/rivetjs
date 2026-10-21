// Document links end to end: a production build of fixture-documents (resumed pages, node adapter) in
// Chromium. Links whose path no page route matches — an endpoint (also one a dynamic page pattern
// would fit: the server answers the endpoint first), a static file, an unknown path — load their
// document: no client navigation, no data request, no page chunk prefetch on intent. Page routes
// (dynamic, trailing slash) stay client navigations; `data-rivet-reload` still forces a document. Document routes
// (server reach: pages whose browser graph reaches a server-only module) load documents too and ship no page code; a
// client navigation whose render throws loads the URL's document (router fallback).
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { build } from "vite";
import { chromium, type Page } from "playwright";
import { start } from "../adapters/node.ts";

const root = new URL("./fixture-documents/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test(
  "document links: unmatched paths and endpoints load documents; page routes navigate in the client",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
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
      const mark = () => page.evaluate(() => ((window as unknown as { mark?: number }).mark = 1));
      const marked = () => page.evaluate(() => (window as unknown as { mark?: number }).mark === 1);
      const boot = async (target: Page) => {
        // Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router.
        await target.dispatchEvent("#home", "pointerdown");
        await target.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
        await target.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
      };
      const home = async () => {
        await page.goto(app.url + "/");
        await boot(page);
        await mark();
        documents.length = 0;
        data.length = 0;
      };

      await t.test("generated app: the shadowed endpoint is a row of the client's match table", async () => {
        const source = await readFile(root + ".rivet/app.tsx", "utf8");
        assert.match(source, /for \(const \[at, path\] of \[\[\d+,"\/items\/export"\]\] as const\) modules\.splice\(at, 0, \[path, _endpoint\]\);/);
        assert.doesNotMatch(source, /"\/api\/ping"/);
        // Document routes (`report`: a `*.server.ts` import, `secret`: a declared server-only module behind a helper).
        const paths = JSON.parse(/const PATHS: readonly string\[\] = (\[[^\]]*\]);/.exec(source)![1]!) as string[];
        const rows = JSON.parse(/for \(const n of (\[[\d,]*\]) as const\) modules\[n\] = \[PATHS\[n\]!, _endpoint\];/.exec(source)![1]!) as number[];
        assert.deepEqual(rows.map((n) => paths[n]).sort(), ["/report", "/secret"]);
      });

      await t.test("document routes: no page code and no server data in the client build", async () => {
        const dir = root + "dist/client/assets/";
        const files = await readdir(dir);
        for (const file of files.filter((name) => name.endsWith(".js"))) {
          const text = await readFile(dir + file, "utf8");
          assert.doesNotMatch(text, /Quarterly report|server secret/, file);
        }
        // The App's import of a document page is a stub that throws (never rendered: links load documents).
        assert.ok(
          files.some((name) => name.startsWith("_rivet-document-page_report")),
          files.join(),
        );
      });

      await t.test("page routes (dynamic, trailing slash): client navigation with a data request", async () => {
        await home();
        for (const [id, path, heading] of [
          ["#item", "/items/1", "Item 1"],
          ["#slash", "/items/3/", "Item 3"],
        ] as const) {
          await page.click(id);
          await page.waitForURL(app.url + path);
          await page.waitForFunction((text) => document.querySelector("h1")?.textContent === text, heading);
          assert.ok(await marked(), path + " kept the document");
          assert.ok(data.includes(path), data.join());
        }
        assert.deepEqual(documents, []);
      });

      await t.test("intent on document links fetches no route data", async () => {
        await home();
        for (const id of ["#export", "#ping", "#legacy", "#nope", "#reload", "#report", "#secret"]) {
          await page.hover(id);
          await page.focus(id);
        }
        await page.waitForTimeout(200);
        assert.deepEqual(data, []);
        await page.hover("#item");
        await page.waitForTimeout(100);
        assert.deepEqual(data, ["/items/1"]);
      });

      for (const [id, path, text] of [
        ["#export", "/items/export", "export"],
        ["#ping", "/api/ping", "pong"],
        ["#legacy", "/legacy.html", "Legacy page"],
        ["#nope", "/nope", ""],
        ["#reload", "/items/2", "Item 2"],
        ["#report", "/report", "Quarterly report"],
        ["#secret", "/secret", "server secret"],
      ] as const)
        await t.test(`${path}: the browser loads the document, no data request`, async () => {
          await home();
          await page.click(id);
          await page.waitForURL(app.url + path);
          await page.waitForLoadState("load");
          assert.equal(await marked(), false);
          assert.deepEqual(documents, [path]);
          assert.deepEqual(data, []);
          if (text) assert.ok((await page.textContent("body"))!.includes(text));
        });

      await t.test("cold click (router not loaded yet) on an unknown link: the held click replays as a document load", async () => {
        const cold = await browser.newPage();
        const loads: string[] = [];
        cold.on("request", (request) => request.resourceType() === "document" && loads.push(new URL(request.url()).pathname));
        cold.on("pageerror", (error) => errors.push(error.message));
        await cold.goto(app.url + "/");
        await cold.click("#legacy");
        await cold.waitForURL(app.url + "/legacy.html");
        assert.deepEqual(loads, ["/", "/legacy.html"]);
        await cold.close();
      });

      await t.test("a client navigation whose render throws loads the URL's document", async () => {
        await home();
        await page.click("#broken");
        await page.waitForURL(app.url + "/broken");
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Broken (server)");
        await page.waitForLoadState("load");
        assert.equal(await marked(), false);
        assert.deepEqual(documents, ["/broken"]);
        // The data request ran (a page route); the render failed after the history push.
        assert.deepEqual(data, ["/broken"]);
        // Its `pageerror` can arrive after the document load (slow host): wait for it.
        for (let i = 0; i < 100 && !errors.includes("broken in the browser"); i++) await new Promise((done) => setTimeout(done, 50));
        assert.deepEqual(errors.splice(errors.indexOf("broken in the browser"), 1), ["broken in the browser"]);
        // Back: the previous document (no loop, one history entry for /broken).
        await page.goBack();
        await page.waitForURL(app.url + "/");
      });

      await t.test("back to a document route from a client navigation: the router loads its document", async () => {
        await page.goto(app.url + "/report");
        await boot(page);
        await page.click("#home");
        await page.waitForURL(app.url + "/");
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Home");
        await mark();
        documents.length = 0;
        await page.goBack();
        await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Quarterly report");
        await page.waitForLoadState("load");
        assert.equal(await marked(), false);
        assert.deepEqual(documents, ["/report"]);
        // The stand-in page throws on render (uncaught: the router's fallback loads the document). Its `pageerror` can
        // arrive after the document load (CI: after this step; locally: not yet at this point) — wait for it.
        const isThrown = (message: string) => message.includes("src/routes/report.tsx is a document route");
        for (let i = 0; i < 100 && !errors.some(isThrown); i++) await new Promise((done) => setTimeout(done, 50));
        const thrown = errors.filter(isThrown);
        assert.ok(thrown.length > 0, errors.join());
        errors.splice(0, errors.length, ...errors.filter((message) => !thrown.includes(message)));
      });

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
