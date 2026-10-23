// Deferred loaders end to end (production build of fixture-deferred): the shell streams before the deferred loaders
// settle (fallbacks + the synchronous sibling first, each boundary's content later as a streamed segment, out of order),
// the data endpoint answers resolved values, a failing deferred loader renders its boundary's error view under a 200,
// deferred loaders cannot set headers / cookies; in Chromium the streamed holes resume (handlers inside the segment, the
// layout's own state) and client navigations render deferred data from the data endpoint. Dev: a synchronous read of a
// deferred handle fails the render with DeferredDataError.
import { test } from "vitest";
import { steps } from "@rivetjs/testing/steps";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build, createServer } from "vite";
import { chromium } from "playwright";
import { loadBuild } from "../adapters/build.ts";
import { start } from "../adapters/node.ts";
import { nodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-deferred/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";
const dist = root + "dist";

/** Read a body chunk by chunk: the text and the text received before `marker` first appeared. */
async function chunks(response: Response, onChunk?: (text: string) => void): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value, { stream: true });
    onChunk?.(text);
  }
}

test(
  "deferred loaders: shell first, holes streamed, data endpoint resolved, resumed in Chromium",
  steps(async (t) => {
    delete process.env.GATE_AUTO;
    await rm(dist, { recursive: true, force: true });
    await build({ root, configFile, logLevel: "silent", build: { outDir: dist + "/client" } });
    await build({ root, configFile, logLevel: "silent", build: { ssr: true, outDir: dist + "/server" } });
    const { handler } = await loadBuild(dist, { onError: () => {} });
    const get = (path: string) => handler(new Request("http://localhost" + path, { headers: { cookie: "user=ann" } }));

    await t.test("the shell streams before the deferred loaders settle; each hole arrives as a segment", async () => {
      const response = await get("/");
      assert.equal(response.status, 200);
      let before = "";
      const body = chunks(response, (text) => (before ||= text.includes("Sync sibling") ? text : ""));
      // The shell (both fallbacks + the sync sibling after the page's boundary) is out while both gates are closed.
      await new Promise((done) => setTimeout(done, 30));
      assert.match(before, /<span id="user-wait">…<\/span>/);
      assert.match(before, /<p id="item-wait">Loading item…<\/p><!--\/a--><!--\]--><p id="sync">Sync sibling<\/p>/);
      assert.doesNotMatch(before, /Hello ann|Deferred item/);
      // Out of order: the page's hole first (its gate opens first), then the layout's.
      await get("/gate?open=item");
      await new Promise((done) => setTimeout(done, 20));
      await get("/gate?open=user");
      const html = await body;
      // Derived model: the boundaries tail, then the segments in settle order; the item's value (a Date inside) ships as
      // its resume table (settled 2), the user's as JSON data.
      const item = html.indexOf('<template data-a="2"><article id="item"><h2>Deferred item</h2><p id="year">1970</p>');
      const user = html.indexOf('<template data-a="1"><span id="user">Hello <!--[-->ann<!--]--></span></template>');
      const tail = html.indexOf('<script type="rivet/boundaries" data-rt=');
      assert.ok(tail > 0 && item > tail && user > item, "boundaries tail, then the item segment, then the user segment");
      assert.match(html, /"a":\[\[1,3,0\],\[2,4,0\]\]/);
      assert.match(html, /<script type="rivet\/boundaries" data-patch="2">\{"v":1,"b":\[\],"a":\[\[2,4,0,2,\{"t":/);
      assert.match(html, /data-patch="1">\{"v":1,"b":\[\],"a":\[\[1,3,0,1,\{"name":"ann"\}\]\]\}/);
      assert.ok(html.endsWith("</div></body></html>"));
    });

    await t.test("data endpoint: deferred loaders awaited, resolved values in the answer", async () => {
      let answered = false;
      const answer = get("/?_rivet=data").then((r) => ((answered = true), r));
      await new Promise((done) => setTimeout(done, 30));
      assert.equal(answered, false);
      await get("/gate?open=item");
      await get("/gate?open=user");
      const text = await (await answer).text();
      assert.match(text, /"Deferred item"/);
      assert.match(text, /\{"j":\{"name":"ann"\}\}/);
      assert.match(text, /\{"d":0\}/, "the Date survives (resume table encoding)");
    });

    await t.test("a failing deferred loader: 200, the boundary's error view", async () => {
      const response = await get("/broken");
      const opened = setTimeout(() => void get("/gate?open=user"), 10);
      const html = await chunks(response);
      clearTimeout(opened);
      assert.equal(response.status, 200);
      // Rejected before the shell reached it: rendered in place (a later rejection would stream as a segment).
      assert.match(html, /<p id="failed">404<\/p>/);
    });

    await t.test("a deferred loader cannot set headers or cookies (TypeError), reads cookies", async () => {
      const response = await get("/late");
      setTimeout(() => void get("/gate?open=user"), 10);
      const html = await chunks(response);
      assert.equal(response.headers.get("x-late"), null);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.match(html, /<li id="late-user">ann<\/li>/);
      assert.match(html, /<li class="late-error">TypeError: A deferred loader cannot set headers/);
      assert.match(html, /<li class="late-error">TypeError: A deferred loader cannot set cookies/);
    });

    process.env.GATE_AUTO = "1";
    const app = await start({ dist, port: 0, onError: () => {} });
    const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
    try {
      await t.test("Chromium: holes swap in and resume; client navigation renders deferred data", async () => {
        const context = await browser.newContext();
        await context.addCookies([{ name: "user", value: "ann", url: app.url }]);
        const page = await context.newPage();
        const errors: string[] = [];
        const data: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (url.searchParams.get("_rivet") === "data") data.push(url.pathname);
        });
        await page.goto(app.url + "/");
        await page.waitForSelector("#item h2");
        await page.waitForSelector("#user");
        assert.equal(await page.textContent("#user"), "Hello ann");
        assert.equal(await page.locator("#item-wait").count(), 0);
        // A handler inside the streamed segment, then the layout's own state.
        await page.click("button.tag >> text=b");
        await page.waitForFunction(() => document.querySelector("#picked")?.textContent === "b");
        await page.click("#visits");
        await page.waitForFunction(() => document.querySelector("#visits")?.textContent === "Visits 1");
        assert.equal(await page.textContent("#user"), "Hello ann");
        // Client navigation away and back: the page's deferred data comes resolved from the data endpoint.
        await page.click("a[href='/other']");
        await page.waitForSelector("#other");
        await page.click("a[href='/']");
        await page.waitForSelector("#item h2");
        assert.equal(await page.textContent("#year"), "1970");
        await page.click("button.tag >> text=a");
        await page.waitForFunction(() => document.querySelector("#picked")?.textContent === "a");
        assert.equal(await page.textContent("#visits"), "Visits 1", "the layout stayed mounted");
        assert.ok(data.includes("/other") && data.includes("/"), "both navigations used the data endpoint: " + data.join(" "));
        // resource() + Suspense over a deferred handle (document load).
        await page.goto(app.url + "/res");
        await page.waitForSelector("#count");
        assert.equal(await page.textContent("#count"), "3");
        await page.click("#bump");
        await page.waitForFunction(() => document.querySelector("#bump")?.textContent === "Bumps 1");
        assert.deepEqual(errors, []);
        await context.close();
      });
    } finally {
      await browser.close();
      await app.close();
      delete process.env.GATE_AUTO;
    }
  }),
);

test("dev: reading a deferred handle synchronously fails the render with DeferredDataError (overlay)", async () => {
  process.env.GATE_AUTO = "1";
  const restoreEnv = nodeEnv("development");
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0 } });
  await server.listen();
  try {
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    // The page renders after the document started (lazy page view): 200 + the dev render-failure comment and overlay.
    const response = await fetch(origin + "/sync-read");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /rivet:resume-error/);
    assert.match(html, /render failed in route "sync-read": Deferred loader data read synchronously \(`data\.title`\)/);
    const fine = await fetch(origin + "/");
    assert.equal(fine.status, 200);
    assert.match(await fine.text(), /Deferred item/);
  } finally {
    await server.close();
    restoreEnv();
    delete process.env.GATE_AUTO;
  }
});
