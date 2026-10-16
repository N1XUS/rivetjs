// T5 HMR (dev server + Chromium; rulings: an island module edit re-hydrates that island only, a Rivet module edit
// keeps the islands mounted). The fake framework has no HMR of its own, so a framework module edit reaches the island
// module's dev accept (`__rivetBridgeDev.replace`); a Rivet page edit re-renders the page and the facades take over
// the islands they disposed (`hot.ts` park / claim: same DOM, framework handle kept, new props).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { rivet } from "@rivetjs/compiler/vite";
import { fixtureApp } from "./app.ts";

test("dev HMR: framework module edit re-mounts its islands only; Rivet page edit keeps every island mounted", { timeout: 60_000 }, async () => {
  const app = await fixtureApp("hmr");
  const server = await createServer({
    configFile: false,
    root: app.root,
    logLevel: "silent",
    plugins: [rivet({ bridges: [app.fake()] })],
    server: { port: 0, watch: { usePolling: true, interval: 50 } },
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const consoleLines: string[] = [];
    page.on("console", (message) => consoleLines.push(message.text()));
    await page.goto(origin + "/dev.html");
    await page.locator(".counter button").waitFor();
    await page.locator(".badge").waitFor();
    // Adapter calls but `update` (live props).
    const log = () =>
      page.evaluate(() =>
        ((globalThis as { __fake?: unknown[][] }).__fake ?? []).filter((entry) => entry[0] !== "update").map((entry) => entry.slice(0, 2).join(" ")),
      );
    assert.deepEqual((await log()).sort(), ["mount c0", "mount c1"]);
    await page.click(".counter button");
    await page.click(".counter button");
    await page.locator(".total", { hasText: "3" }).waitFor();
    // Marks that survive only without a reload / without a new island root.
    await page.evaluate(() => {
      (window as { __kept?: boolean }).__kept = true;
      for (const root of document.querySelectorAll("rivet-island")) (root as { __mark?: string }).__mark = root.getAttribute("data-ri")!;
    });
    const marks = () => page.evaluate(() => [...document.querySelectorAll("rivet-island")].map((root) => (root as { __mark?: string }).__mark ?? "new"));

    // 1. Framework module edit: only Counter's island re-mounts (new component), Badge and the Rivet state stay.
    const counter = resolve(app.root, "src/Counter.fake.js");
    await writeFile(counter, (await readFile(counter, "utf8")).replaceAll("<button>+</button>", "<button>add</button>"));
    await page.locator(".counter button", { hasText: "add" }).waitFor();
    assert.deepEqual((await log()).slice(2), ["unmount", "mount c0"]);
    assert.equal(await page.locator(".total").textContent(), "3");
    assert.equal(await page.evaluate(() => (window as { __kept?: boolean }).__kept), true, "no full reload");
    assert.deepEqual(await marks(), ["c0", "c1"]);
    await page.click(".counter button");
    await page.locator(".total", { hasText: "4" }).waitFor();

    // 2. Rivet page edit: the page re-renders (its signal kept), both islands keep their root and framework handle.
    const before = (await log()).length;
    const pageFile = resolve(app.root, "src/page.tsx");
    await writeFile(
      pageFile,
      (await readFile(pageFile, "utf8")).replace('<p class="total">{n()}</p>', '<p class="total">{n()}</p>\n      <p class="edited">edited</p>'),
    );
    await page.locator(".edited").waitFor();
    const after = (await log()).slice(before);
    assert.ok(!after.some((entry) => entry.startsWith("mount") || entry === "unmount"), "no re-mount: " + after.join(", "));
    assert.deepEqual(await marks(), ["c0", "c1"]);
    assert.equal(await page.locator(".total").textContent(), "4");
    // The kept island's callbacks reach the re-rendered page.
    await page.click(".counter button");
    await page.locator(".total", { hasText: "5" }).waitFor();
    assert.equal(await page.locator(".count").textContent(), "5", "live props reach the kept island");

    // 3. Export list change: the facade is regenerated and its importers update (a new component export is usable).
    const hooks = resolve(app.root, "src/Hooks.fake.js");
    await writeFile(
      hooks,
      (await readFile(hooks, "utf8")) +
        `export const Extra = component({ html: () => "", attach(root) { root.innerHTML = '<s class="extra">EXTRA</s>'; return { update() {}, destroy() {} }; } });\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    await writeFile(
      pageFile,
      (await readFile(pageFile, "utf8"))
        .replace('import { Badge } from "./Hooks.fake.js";', 'import { Badge, Extra } from "./Hooks.fake.js";')
        .replace('<p class="edited">edited</p>', '<p class="edited">edited</p>\n      <Extra client="load" />'),
    );
    await page.locator(".extra", { hasText: "EXTRA" }).waitFor();
    assert.equal(await page.evaluate(() => (window as { __kept?: boolean }).__kept), true, "no full reload: " + consoleLines.join("\n"));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
    await app.remove();
  }
});
