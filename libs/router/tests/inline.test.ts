// Canary for in-file route server code: a production build whose pages and layout declare
// `serverLoad`/`serverGuard`/`onGet` next to the component, a plain `.ts` endpoint route, and a sibling
// `.server.ts` merged with in-file exports. The client output must hold no server code; the server
// answers; the resumed page stays interactive. Then the same app on the dev server.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { build, createServer } from "vite";
import { chromium } from "playwright";
import { start } from "../adapters/node.ts";
import { nodeEnv, withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-inline/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

test("production build: no server code in the client output; server exports answer; page resumes", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent" }));
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent", build: { ssr: true } }));
  const client = await files(root + "dist/client");
  assert.ok(client.some((f) => f.endsWith(".js")));
  for (const file of client) {
    const text = await readFile(file, "utf8");
    for (const banned of ["inline-fixture-secret-token", "serverLoad", "serverGuard", "db.server", "pong", "put ok", "options ok"])
      assert.ok(!text.includes(banned), `${banned} in ${file}`);
  }
  const server = (await Promise.all((await files(root + "dist/server")).map((f) => readFile(f, "utf8")))).join("\n");
  assert.ok(server.includes("inline-fixture-secret-token"));

  const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  try {
    const home = await fetch(app.url + "/");
    const html = (await home.text()).replace(/<!--.*?-->/g, "");
    assert.match(html, /<p id="site">Inline true<\/p>/);
    assert.match(html, /<h1 id="count">2 items<\/h1>/);
    assert.equal(await (await fetch(app.url + "/?ping")).text(), "pong");
    assert.equal(await (await fetch(app.url + "/", { method: "PUT" })).text(), "put ok");
    assert.equal((await fetch(app.url + "/", { method: "OPTIONS" })).headers.get("x-inline-options"), "options ok");
    assert.equal((await fetch(app.url + "/", { method: "DELETE" })).status, 405);

    const item = await fetch(app.url + "/items/b");
    assert.equal(item.headers.get("x-item"), "1");
    assert.match((await item.text()).replace(/<!--.*?-->/g, ""), /<h1 id="item">Beta \(b\)<\/h1>/);
    assert.equal((await fetch(app.url + "/items/zzz")).status, 404);
    assert.match(await (await fetch(app.url + "/items/a?_rivet=data")).text(), /Alpha/);

    assert.deepEqual(await (await fetch(app.url + "/api/ping?q=1")).json(), { pong: "1" });
    assert.deepEqual(await (await fetch(app.url + "/api/ping", { method: "POST", body: "hi", headers: { origin: app.url } })).json(), { echo: "hi" });
    // text/plain without Origin / Sec-Fetch-Site (a cross-site form could send it): rejected.
    assert.equal((await fetch(app.url + "/api/ping", { method: "POST", body: "hi" })).status, 403);

    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(app.url + "/");
    await page.getByRole("button", { name: "Likes 0" }).click();
    await page.getByRole("button", { name: "Likes 1" }).waitFor();
    await page.getByRole("button", { name: "Clicks 0" }).click();
    await page.getByRole("button", { name: "Clicks 1" }).waitFor();
    // Client navigation fetches the in-file loader's data.
    await page.locator("nav").getByRole("link", { name: "Beta" }).click();
    await page.locator("#item", { hasText: "Beta (b)" }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await app.close();
  }
});

// Regression (2026-10-11): rolldown 1.2.12 keys a context resolve's options by `resolveOptionsMap.size`, so concurrent
// `this.resolve(…, { custom })` calls reuse a live key and the compiler's fact resolutions lost their marker: the
// server-only guard then failed the client build at random. A plugin firing concurrent option-carrying resolves on every
// transform makes the collision certain; the guard must still tell fact resolutions from imports.
test("client build: the server-only guard holds under concurrent context resolves", async () => {
  const outDir = root + "dist/noise";
  const noise = {
    name: "concurrent-resolves",
    async transform(_code: string, id: string) {
      if (!/\.[jt]sx?$/.test(id) || id.includes("node_modules")) return null;
      const self = this as unknown as { resolve(id: string, importer: string, options: object): Promise<unknown> };
      await Promise.all(Array.from({ length: 16 }, (_, i) => self.resolve("@rivetjs/reactivity", id, { custom: { noise: i } })));
      return null;
    },
  };
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent", plugins: [noise], build: { outDir } }));
  for (const file of await files(outDir)) assert.ok(!(await readFile(file, "utf8")).includes("inline-fixture-secret-token"), file);
  await rm(outDir, { recursive: true, force: true });
});

test("dev server: in-file exports run on the server; browser modules are stripped", async () => {
  const restoreEnv = nodeEnv("development");
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  try {
    assert.match(await (await fetch(origin + "/")).text(), /<h1 id="count">2 items<\/h1>/);
    assert.equal(await (await fetch(origin + "/?ping")).text(), "pong");
    assert.deepEqual(await (await fetch(origin + "/api/ping?q=dev")).json(), { pong: "dev" });
    // The browser's copy of the page module: no loader, no server import.
    const module = await (await fetch(origin + "/src/routes/index.tsx")).text();
    assert.match(module, /Likes/);
    assert.doesNotMatch(module, /serverLoad|db\.server|pong/);
  } finally {
    await server.close();
    restoreEnv();
  }
});
