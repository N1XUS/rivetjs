// Dev resume (`vite serve`) of source-package components: @rivetjs/cdk symbols keep package ids,
// their dev chunks are served from the package's file URL, the widget resumes and works, each library
// module runs once, and the dev a11y checks start at load.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { readable } from "../../runtime/tests/resume/wire.ts";

const root = new URL("./app/", import.meta.url).pathname;
const aria = new URL("../", import.meta.url).pathname;

test("dev resume: aria ListBox resumes with package symbol ids, one instance per module, a11y checks at load", async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const server = await createServer({ root, configFile: root + "vite.config.ts", logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  try {
    const html = await (await fetch(origin + "/listbox")).text();
    assert.match(html, /data-rivet-dev="resume"/);
    const state = readable(JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/.exec(html)![1]!)) as {
      c: string[];
      s: Record<string, number>;
    };
    assert.ok(
      Object.keys(state.s).some((id) => id.startsWith("@rivetjs/cdk/listbox/index.tsx#ListBoxInner$")),
      Object.keys(state.s).join(),
    );
    const chunk = "/@fs" + aria + "listbox/index.tsx?rivet-chunk=ListBoxInner";
    assert.ok(state.c.includes(chunk), state.c.join("\n"));
    assert.equal((await fetch(origin + chunk)).status, 200);

    const page = await browser.newPage();
    const errors: string[] = [],
      warnings: string[] = [],
      scripts: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => (message.type() === "error" ? errors : message.type() === "warning" ? warnings : []).push(message.text()));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.resourceType() === "script") scripts.push(decodeURIComponent(url.pathname + url.search));
    });
    await page.goto(origin + "/listbox");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getAttribute("#fruit-option-banana", "aria-selected"), "true");
    // Before any interaction: the story markup is clean, and the dev checks already watch the page.
    assert.deepEqual(
      warnings.filter((w) => w.startsWith("Rivet a11y")),
      [],
    );
    await page.evaluate(() => document.body.append(Object.assign(document.createElement("img"), { id: "probe", src: "/x.png" })));
    await page.waitForFunction(() => document.querySelector("#probe"));
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(
      warnings.some((w) => w.startsWith("Rivet a11y [img-alt]")),
      warnings.join("\n"),
    );
    await page.focus("#fruit-option-banana");
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.activeElement?.id === "fruit-option-date", undefined, { timeout: 10_000 });
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.querySelector("#fruit-value")?.textContent === "Picked: date");
    await page.waitForLoadState("networkidle");
    assert.ok(scripts.includes(chunk), scripts.join("\n"));
    // One instance per library module: no module requested under two URLs (plain + `?t=` / `?import`).
    const library = scripts.filter((url) => url.startsWith("/@fs" + aria) || url.includes("/libs/cdk/"));
    const plain = library.filter((url) => !url.includes("rivet-chunk=")).map((url) => url.split("?")[0]!);
    assert.ok(plain.some((url) => url.endsWith("/listbox/index.tsx")) && plain.some((url) => url.includes("/libs/cdk/")), plain.join("\n"));
    assert.equal(new Set(plain).size, plain.length, plain.join("\n"));
    assert.deepEqual(
      errors.filter((e) => !/x\.png|404/.test(e)),
      [],
    );
  } finally {
    await browser.close();
    await server.close();
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});
