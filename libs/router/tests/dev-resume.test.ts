// Dev resume (`vite serve`): pages resume like production builds — boundaries tail, inline loader, module
// chunks served by Vite — and a component edit reloads the page (adopted boundaries are not hot-replaced). Framework modules keep one browser instance under `?t=` (E16).
import { test } from "vitest";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Page } from "playwright";
import { bare, nodeEnv } from "./vite-env.ts";
import { expandTail } from "@rivetjs/runtime/resume-format";

const fixture = new URL("./fixture/", import.meta.url).pathname;
const runtimeDom = new URL("../../runtime/dom.ts", import.meta.url).pathname;

/** A private copy of the fixture (tests edit its files); ItemPage counts its runs per realm. */
async function copyFixture(): Promise<string> {
  await mkdir(".artifacts", { recursive: true });
  const copy = (await mkdtemp(resolve(".artifacts/router-dev-resume-"))) + "/";
  await cp(fixture, copy, { recursive: true, filter: (path) => !/[/\\](\.rivet|dist)$/.test(path) });
  const page = copy + "src/routes/items/[id].tsx";
  const source = await readFile(page, "utf8");
  await writeFile(
    page,
    source.replace(
      "  const likes = signal(0);",
      "  (globalThis as { __componentRuns?: number }).__componentRuns = ((globalThis as { __componentRuns?: number }).__componentRuns ?? 0) + 1;\n  const likes = signal(0);",
    ),
  );
  return copy;
}
async function devServer(root: string): Promise<{ server: ViteDevServer; origin: string }> {
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  return { server, origin: server.resolvedUrls!.local[0]!.replace(/\/$/, "") };
}
/** Page with error, document-load and script-request logs. */
async function watch(page: Page) {
  const errors: string[] = [],
    documents: string[] = [],
    scripts: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.resourceType() === "document") documents.push(url.pathname);
    else scripts.push(decodeURIComponent(url.pathname + url.search));
  });
  return { errors, documents, scripts };
}
const runs = (page: Page) => page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns ?? 0);

test("dev resume: the page resumes like production, an interaction loads its chunk, links navigate in the document", async () => {
  const restoreEnv = nodeEnv("development");
  const root = await copyFixture();
  const { server, origin } = await devServer(root);
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const html = await (await fetch(origin + "/items/1")).text();
    assert.match(bare(html), /<div data-rivet-dev="resume" style="display:contents"><div id="shell">/);
    assert.match(html, /<button type="button" id="likes">Likes <!--\[-->0<!--\]--><\/button>/);
    const tag = /<script type="rivet\/boundaries"[^>]*>/.exec(html)![0]!;
    const tail = expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/.exec(html)![1]!)) as { m: Record<string, string> };
    // The derived runtime entry of the compiler plugin; boundary chunks = the modules Vite serves.
    assert.match(tag, /data-rt="\/@id\/__x00__rivet-derived-entry"/);
    const chunks = Object.values(tail.m);
    assert.ok(chunks.includes("/src/routes/items/[id].tsx"), chunks.join());
    assert.ok(chunks.includes("/.rivet/app.tsx"), chunks.join());
    assert.ok(!html.includes("rivet-dev-data"), "no embedded client-render data");
    // The dev scripts follow the resumed app (its boundaries tail and loader) inside the container.
    const end = html.slice(html.lastIndexOf("</script><script nonce="));
    assert.ok(
      /<script type="module" src="\/@vite\/client" nonce="[^"]+"><\/script><script type="module" src="\/\.rivet\/entry\.dev\.tsx" nonce="[^"]+"><\/script><\/div><\/body>/.test(
        end,
      ),
      end.slice(-400),
    );

    const page = await browser.newPage();
    const log = await watch(page);
    await page.goto(origin + "/items/1");
    await page.waitForLoadState("networkidle");
    // Resumed: no component ran in the browser before it is used (its module is only fetched ahead).
    assert.equal(await runs(page), 0);
    // Z1: the router's listeners load on interaction, so nothing boots the runtime at idle (it and the App
    // chunk are only fetched: low-priority modulepreload hints).
    assert.equal(
      await page.evaluate(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function"),
      false,
      "the resume runtime did not boot at idle",
    );
    await page.getByRole("button", { name: "Likes 0" }).click();
    await page.getByRole("button", { name: "Likes 1" }).waitFor();
    // The click adopted ItemPage over the server nodes: its body ran twice (the adopt run's probe, then the adopt).
    assert.equal(await runs(page), 2);
    await page.getByRole("button", { name: "Layout clicks 0" }).click();
    await page.getByRole("button", { name: "Layout clicks 1" }).waitFor();

    // A link click: the resumed router navigates in the document (creating the next page in the browser).
    await page.locator("nav").getByRole("link", { name: "Second", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#item-id")?.textContent === "2");
    assert.equal(await page.title(), "Second item");
    assert.equal(await page.textContent("#layout-clicks"), "Layout clicks 1");
    assert.deepEqual(log.documents, ["/items/1"]);
    assert.deepEqual(log.errors, []);

    // A cold link click (fresh page, nothing booted): the loader holds it, loads the runtime + router
    // and replays it, so it navigates in the document too, as in production (Z1).
    const cold = await browser.newPage();
    const coldLog = await watch(cold);
    await cold.goto(origin + "/items/1");
    await cold.waitForLoadState("networkidle");
    assert.equal(await cold.evaluate(() => typeof (document as unknown as { $rdp?: unknown }).$rdp === "function"), false);
    await cold.locator("nav").getByRole("link", { name: "Second", exact: true }).click();
    await cold.waitForFunction(() => document.querySelector("#item-id")?.textContent === "2");
    assert.deepEqual(coldLog.documents, ["/items/1"]);
    assert.deepEqual(coldLog.errors, []);
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
    restoreEnv();
  }
});

test("dev resume: a component edit reloads the page, which renders the edit", async () => {
  const restoreEnv = nodeEnv("development");
  const root = await copyFixture();
  const { server, origin } = await devServer(root);
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  const pageFile = root + "src/routes/items/[id].tsx";
  const pageSource = await readFile(pageFile, "utf8");
  try {
    const page = await browser.newPage();
    const log = await watch(page);
    await page.goto(origin + "/items/1");
    await page.getByRole("button", { name: "Likes 0" }).click();
    await page.getByRole("button", { name: "Likes 1" }).waitFor();
    await page.waitForLoadState("networkidle");

    // An edit of a resume module: a full reload (resumed signal state is not carried over), resumable again.
    await writeFile(pageFile, pageSource.replace('<p id="item-id">', '<p id="edited">edited</p>\n      <p id="item-id">'));
    await page.waitForSelector("#edited", { timeout: 10_000 });
    assert.equal(await page.textContent("#likes"), "Likes 0");
    assert.equal(await page.locator("#item").count(), 1);
    assert.equal(await page.locator('script[type="rivet/boundaries"]').count(), 1);
    assert.deepEqual(log.documents, ["/items/1", "/items/1"]);
    await page.getByRole("button", { name: "Likes 0" }).click();
    await page.getByRole("button", { name: "Likes 1" }).waitFor();
    await page.locator("nav").getByRole("link", { name: "Second", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#item-id")?.textContent === "2");
    assert.deepEqual(log.documents, ["/items/1", "/items/1"]);
    assert.deepEqual(log.errors, []);
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
    restoreEnv();
  }
});

test("dev: a cache-busted framework module URL re-exports the plain one (one runtime instance in the browser)", async () => {
  const restoreEnv = nodeEnv("development");
  const { server, origin } = await devServer(fixture);
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const plain = "/@fs" + runtimeDom;
    const facade = await fetch(origin + plain + "?t=123");
    assert.match(facade.headers.get("content-type")!, /javascript/);
    assert.equal(await facade.text(), `export * from ${JSON.stringify(plain)};\n`);
    // App modules and other queries are served as usual.
    assert.match(await (await fetch(origin + "/src/routes/index.tsx?t=1")).text(), /export/);
    assert.doesNotMatch(await (await fetch(origin + plain + "?t=1&import")).text(), /^export \* from/);

    const page = await browser.newPage();
    await page.goto(origin + "/");
    const same = await page.evaluate(async (url) => {
      const [a, b] = await Promise.all([import(url), import(url + "?t=" + Date.now())]);
      return a.mount === b.mount && a.signalProps === b.signalProps && typeof a.mount === "function";
    }, plain);
    assert.equal(same, true);
  } finally {
    await browser.close();
    await server.close();
    restoreEnv();
  }
});
