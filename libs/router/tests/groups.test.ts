// Nested path-less groups (`(site)/careers/(jobs)/<slug>`) in static mode with transitions: client
// navigation between pages of one group layout and across groups renders the page (not `_404`), in
// the dev server and in the production static build, with and without trailing slashes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHTTPServer } from "node:http";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { build, createServer } from "vite";
import { chromium, type Page } from "playwright";
import { prerenderBuild } from "../adapters/static.ts";
import { rivetRouter } from "../build/vite.ts";
import { nodeEnv, withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-groups/", import.meta.url).pathname;

function watch(page: Page) {
  const errors: string[] = [],
    documents: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
  return { errors, documents };
}
const heading = (page: Page) => page.locator("h1").first().textContent();

/** Start at `/`, click through careers → job → back → other job → contact → home, all client side (`documents`: each
 * click loads a document instead — the client router off and nothing live on the pages). */
async function walk(page: Page, origin: string, documents = false): Promise<void> {
  const log = watch(page);
  await page.goto(origin + "/");
  await page.waitForLoadState("networkidle");
  const step = async (name: string, expected: string) => {
    await page.getByRole("link", { name, exact: true }).first().click();
    await page
      .locator("h1", { hasText: expected })
      .waitFor({ timeout: 5000 })
      .catch(() => undefined);
    assert.equal(await heading(page), expected, `after clicking ${name}: ${page.url()}`);
  };
  await step("Careers", "Careers");
  await step("Analyst", "Job analyst");
  await step("Back", "Careers");
  await step("Buyer", "Job buyer");
  await step("Contact", "Contact");
  await step("Privacy", "Privacy");
  await step("Home", "Home");
  if (documents) assert.deepEqual(log.documents, ["/", "/careers/", "/careers/analyst/", "/careers/", "/careers/buyer", "/contact/", "/privacy/", "/"]);
  else assert.deepEqual(log.documents, ["/"], "client navigations only");
  assert.deepEqual(log.errors, []);
}

test("dev: client navigation into nested route groups renders the pages", async () => {
  const restoreEnv = nodeEnv("development");
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    await walk(await browser.newPage(), origin);
    // The dev server answers the static data files the client reads (`<page>/_data.json`) like the
    // prerendered ones: the page's data, 404 for no page.
    const data = await fetch(origin + "/careers/analyst/_data.json");
    assert.equal(data.status, 200);
    assert.match(data.headers.get("content-type")!, /^application\/json/);
    assert.equal((await fetch(origin + "/nope/_data.json")).status, 404);
  } finally {
    await browser.close();
    await server.close();
    restoreEnv();
  }
});

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
/** Files of a prerendered site: `dir/index.html` for folders, `404.html` (status 404) otherwise. */
function serveStatic(dir: string): Promise<{ origin: string; close(): void }> {
  const server = createHTTPServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    let file = join(dir, path.endsWith("/") ? path + "index.html" : path);
    if (
      !(await stat(file).then(
        (s) => s.isFile(),
        () => false,
      ))
    )
      file = join(dir, path, "index.html");
    const found = await stat(file).then(
      (s) => s.isFile(),
      () => false,
    );
    res.writeHead(found ? 200 : 404, { "content-type": TYPES[extname(found ? file : ".html")] ?? "application/octet-stream" });
    res.end(await readFile(found ? file : join(dir, "404.html")));
  });
  return new Promise((done) =>
    server.listen(0, () => done({ origin: `http://localhost:${(server.address() as { port: number }).port}`, close: () => server.close() })),
  );
}

test("static build: client navigation into nested route groups renders the prerendered pages", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await withNodeEnv("production", async () => {
    await build({ root, configFile: root + "vite.config.ts", logLevel: "silent" });
    await build({ root, configFile: root + "vite.config.ts", logLevel: "silent", build: { ssr: true } });
  });
  const report = await prerenderBuild({ dist: root + "dist", csp: false });
  assert.deepEqual(report.pages.sort(), ["/", "/careers", "/careers/analyst", "/careers/buyer", "/contact", "/privacy"]);
  const site = await serveStatic(root + "dist/client");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    await walk(await browser.newPage(), site.origin);
  } finally {
    await browser.close();
    site.close();
  }
});

// ZERO Z3: `clientRouter` off (the default) and nothing live on a page: the generated Root / App are weak boundaries, so the
// prerendered pages ship no boundaries tail, no loader and no module script; links load documents.
test("static build, client router off: pages with nothing live ship no JS and links load documents", async () => {
  // Own dist + generated dir (the server entry module of the build above stays cached in this process).
  const dist = root + "dist/documents/";
  await rm(dist, { recursive: true, force: true });
  const config = {
    root,
    configFile: false as const,
    logLevel: "silent" as const,
    plugins: [rivetRouter({ mode: "static", transitions: true, outDir: "dist/documents/.rivet" })],
  };
  await withNodeEnv("production", async () => {
    await build({ ...config, build: { outDir: dist + "client" } });
    await build({ ...config, build: { ssr: true, outDir: dist + "server" } });
  });
  await prerenderBuild({ dist, csp: false });
  for (const path of ["", "careers/", "careers/analyst/", "contact/"]) {
    const html = await readFile(dist + "client/" + path + "index.html", "utf8");
    assert.ok(!html.includes('type="rivet/boundaries"'), path + ": no boundaries tail");
    assert.doesNotMatch(html, /<script\b[^>]*type="module"|modulepreload/, path + ": no module script");
  }
  // No page references a script: the prerender prunes every client chunk.
  assert.deepEqual(await readdir(dist + "client/assets").catch(() => []), []);
  const site = await serveStatic(dist + "client");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    await walk(await browser.newPage(), site.origin, true);
  } finally {
    await browser.close();
    site.close();
    await rm(dist, { recursive: true, force: true });
  }
});
