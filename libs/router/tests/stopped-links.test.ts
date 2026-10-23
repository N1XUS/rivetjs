// Stopped link clicks end to end (lane RESUME-PINS, resume fuzz T31 cdk /links, /sidebar): a production build of
// fixture-stopped-links (resumed pages, node adapter) in Chromium. A link's own resumed handler runs from the resume
// loader's document capture listener; one that stops propagation (a cdk Link's press) hid the click from the router's
// bubbling listener, so the browser followed it natively: a same-page `#hash` target was not focused, a page route
// loaded a document. The App's capture listener takes those clicks: same result as a client render.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "vite";
import { chromium, type Page } from "playwright";
import { start } from "../adapters/node.ts";

const root = new URL("./fixture-stopped-links/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test(
  "stopped link clicks: a resumed handler's stopPropagation still lets the router route the link",
  steps(async (t) => {
    await rm(root + "dist", { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent" });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
    const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      const page = await browser.newPage();
      const errors: string[] = [],
        documents: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
      const mark = () => page.evaluate(() => ((window as unknown as { mark?: number }).mark = 1));
      const marked = () => page.evaluate(() => (window as unknown as { mark?: number }).mark === 1);
      // Warm: the runtime started and the link's handler chunk is live (intent: focus on the link, then idle).
      const warm = async (target: Page, link: string) => {
        await target.focus(link);
        await target.waitForFunction(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function");
        // No new resource for 300 ms (the hinted chunks landed; `networkidle` never settles here).
        await target.waitForFunction(
          () => {
            const w = window as unknown as { __n?: number; __t?: number };
            const n = performance.getEntriesByType("resource").length;
            if (n !== w.__n) ((w.__n = n), (w.__t = performance.now()));
            return performance.now() - w.__t! > 300;
          },
          undefined,
          { polling: 50 },
        );
        await target.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
      };
      const home = async () => {
        await page.goto(app.url + "/");
        await mark();
        documents.length = 0;
      };

      await t.test("generated app: the capture listener takes stopped clicks only", async () => {
        const { readFile } = await import("node:fs/promises");
        const source = await readFile(root + ".rivet/app.tsx", "utf8");
        assert.match(
          source,
          /clientEvent\(document, "click", \(event: MouseEvent\) => _onStopped\(event, \(\) => .*\), \{ capture: true, preload: "intent", match: "a" \}\);/,
        );
      });

      for (const mode of ["warm", "cold"] as const)
        await t.test(`${mode}: a same-page #hash link focuses its target`, async () => {
          await home();
          if (mode === "warm") await warm(page, "#to-target");
          await page.click("#to-target");
          await page.waitForFunction(() => document.activeElement?.id === "target", undefined, { timeout: 5000 });
          assert.equal(await page.getAttribute("#target", "tabindex"), "-1");
          assert.equal(new URL(page.url()).hash, "#target");
          assert.ok(await marked(), "same document");
          assert.deepEqual(documents, []);
        });

      for (const mode of ["warm", "cold"] as const)
        await t.test(`${mode}: a page route link navigates in the client`, async () => {
          await home();
          if (mode === "warm") await warm(page, "#to-other");
          await page.click("#to-other");
          await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Other", undefined, { timeout: 5000 });
          assert.ok(await marked(), "client navigation, no document load");
          assert.deepEqual(documents, []);
        });

      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await app.close();
    }
  }),
);
