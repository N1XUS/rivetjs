// Compression Dictionary Transport in Chromium (RFC 9842, M5 E3): a static build (`prerenderBuild` writes the site
// dictionary) served by the node adapter. The first document links the dictionary (`Link: rel="compression-dictionary"`),
// Chromium fetches it at idle (`Use-As-Dictionary`, a year fresh), then a client navigation's `_data.json` fetch and the
// next document load go out with `Available-Dictionary` + `dcz` in `Accept-Encoding` and come back `dcz`, decoded by the
// browser (the page renders the loader data).
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { build } from "vite";
import { chromium, type Response as PageResponse } from "playwright";
import { prerenderBuild } from "../adapters/static.ts";
import { serve, type Handler } from "../adapters/node.ts";
import { withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-dictionary/", import.meta.url).pathname;

/** Folder → `index.html` (as docs-kit serve answers prerendered pages). */
const pages =
  (dir: string): Handler =>
  async (request) => {
    const file = join(dir, new URL(request.url).pathname, "index.html");
    return existsSync(file)
      ? new Response(await readFile(file), { headers: { "content-type": "text/html; charset=utf-8" } })
      : new Response("not found", { status: 404 });
  };

test("Chromium: the linked dictionary is fetched, then navigation data and the next document arrive dcz", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await withNodeEnv("production", async () => {
    await build({ root, configFile: root + "vite.config.ts", logLevel: "silent" });
    await build({ root, configFile: root + "vite.config.ts", logLevel: "silent", build: { ssr: true } });
  });
  const report = await prerenderBuild({ dist: root + "dist", csp: false });
  assert.equal(report.dictionaries?.length, 1, "the site's dictionary");
  const dictionary = report.dictionaries![0]!;
  assert.equal(dictionary.prefix, "/");
  const client = root + "dist/client";
  // Chromium treats localhost as a secure context: dictionaries work over plain HTTP here.
  const serving = await serve({ handler: pages(client), client, port: 0, host: "127.0.0.1", onError: (error) => console.error(error) });
  const origin = serving.url.replace("127.0.0.1", "localhost");
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const page = await browser.newPage();
    const seen: { path: string; request: Record<string, string>; response: Record<string, string> }[] = [];
    const record = async (response: PageResponse) => {
      const url = new URL(response.url());
      if (url.origin !== origin) return;
      seen.push({ path: url.pathname, request: await response.request().allHeaders(), response: await response.allHeaders() });
    };
    page.on("response", (response) => void record(response));
    await page.goto(origin + "/");
    const first = seen.find((entry) => entry.path === "/")!;
    assert.equal(first.response.link, `<${dictionary.url}>; rel="compression-dictionary"`);
    // The browser fetches the dictionary at idle.
    for (let i = 0; i < 100 && !seen.some((entry) => entry.path === dictionary.url); i++) await page.waitForTimeout(50);
    const fetched = seen.find((entry) => entry.path === dictionary.url);
    assert.ok(fetched, "dictionary fetched");
    assert.equal(fetched.response["use-as-dictionary"], `match="/*", id="${dictionary.id}"`);
    await page.waitForTimeout(200); // stored after the body completes
    // Client navigation: the router's `_data.json` fetch carries the dictionary and is answered dcz.
    await page.getByRole("link", { name: "Beta", exact: true }).click();
    await page.locator("h1", { hasText: "Doc beta" }).waitFor({ timeout: 5000 });
    const data = seen.find((entry) => entry.path === "/docs/beta/_data.json");
    assert.ok(data, "navigation data requested: " + seen.map((entry) => entry.path).join(", "));
    assert.match(data.request["accept-encoding"]!, /\bdcz\b/);
    assert.match(data.request["available-dictionary"]!, /^:[A-Za-z0-9+/]+=*:$/);
    assert.equal(data.request["dictionary-id"], `"${dictionary.id}"`);
    assert.equal(data.response["content-encoding"], "dcz");
    assert.equal(await page.locator("li").count(), 40, "the dcz data rendered");
    // A document load of another page: dcz too, no Link (the browser has the dictionary).
    await page.goto(origin + "/docs/gamma/");
    assert.equal(await page.locator("h1").textContent(), "Doc gamma");
    const second = seen.find((entry) => entry.path === "/docs/gamma/")!;
    assert.equal(second.response["content-encoding"], "dcz");
    assert.equal(second.response.link, undefined);
    assert.match(second.response.vary!, /Available-Dictionary/);
  } finally {
    await browser.close();
    await serving.close();
    await rm(root + "dist", { recursive: true, force: true });
  }
});
