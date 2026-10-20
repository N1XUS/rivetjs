// Lane R2 resume fixes in Chromium: function children of native elements update after resume.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  FnChild(): ServerValue;
  Invalid(): ServerValue;
  FragmentFn(): ServerValue;
  SpreadCase(): ServerValue;
  ColdInvalid(): ServerValue;
  ColdKeys(): ServerValue;
}

const source = await readFile(new URL("./resume/r2-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/r2.tsx");
const server = await importServer<Fixture>(compileResume(source, "server", "src/r2.tsx").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = {
  hash: "r2",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
for (const component of ["FnChild", "Invalid", "FragmentFn", "SpreadCase", "ColdInvalid", "ColdKeys"] as const) {
  const html = await resumableToString(() => server[component](), { manifest });
  files["/" + component.toLowerCase()] = "<!doctype html><html><head></head><body>" + html + "</body></html>";
}

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  return errors;
};
const text = (page: Page, selector: string, value: string) =>
  page.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("function children (`{() => log().join()}`, `{() => log().map(…)}`) bind and update after resume", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/fnchild");
    await page.click("#add");
    await text(page, "#plain", "x0");
    await text(page, "#text", "x0");
    await page.click("#add");
    await text(page, "#text", "x0, x1");
    await text(page, "#list", "x0x1");
    assert.equal(await page.evaluate(() => document.querySelectorAll("#list li").length), 2);
    assert.equal(await page.evaluate(() => (window as { __componentRuns?: number }).__componentRuns), undefined);
    assert.deepEqual(errors, []);
  });
});

test("a loaded `invalid` handler queued behind a cold event is still canceled at dispatch", async () => {
  await withPage(
    files,
    async (page) => {
      const errors = errorsOf(page);
      await page.goto("http://rivet.test/invalid");
      // Load the form's chunk (Invalid); Other's chunk stays slow.
      await page.click("#warm");
      await text(page, "#seen", "w");
      await page.evaluate(() => {
        const log: string[] = ((window as { log?: string[] }).log = []);
        for (const id of ["a", "c"]) document.getElementById(id)!.addEventListener("invalid", (e) => log.push(id + ":" + e.defaultPrevented));
      });
      await page.click("#submit");
      assert.deepEqual(await page.evaluate(() => (window as { log?: string[] }).log), ["a:true", "c:true"]);
      // The queued handler still runs once the cold chain drains.
      await text(page, "#seen", "wc");
      await text(page, "#b", "1");
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/Other.js": 400 } },
  );
});

test("a cold `invalid` whose handler did not cancel it focuses the form's first invalid control", async () => {
  await withPage(
    files,
    async (page) => {
      const errors = errorsOf(page);
      await page.goto("http://rivet.test/coldinvalid");
      await page.click("#send");
      // Both invalid events ran the (slow) capture handler; then #x (the first invalid control) got focus.
      await text(page, "#invalids", "2");
      await page.waitForFunction(() => document.activeElement?.id === "x", null, { timeout: 5000 });
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/ColdInvalid.js": 400 } },
  );
});

test("cold key events queued before a replayed handler moved focus replay at the newly focused element", async () => {
  await withPage(
    files,
    async (page) => {
      const errors = errorsOf(page);
      await page.goto("http://rivet.test/coldkeys");
      await page.focus("#k1");
      for (const key of ["a", "b", "c"]) await page.keyboard.press(key);
      await text(page, "#keys", " k1:a k2:b k2:c");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "k2");
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/ColdKeys.js": 400 } },
  );
});

test("function children inside a component's fragment re-render after resume (region wakes on their reads)", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/fragmentfn");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#frag input")].map((i) => (i as HTMLInputElement).value)), ["a"]);
    await page.click("#more");
    await text(page, "#joined", "keys:a,b");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#frag input")].map((i) => (i as HTMLInputElement).value)), ["a", "b"]);
    assert.deepEqual(errors, []);
  });
});

test("a resumed spread's camelCase keys (`tabIndex`, `readOnly`) update the server's lowercase attributes in place", async () => {
  await withPage(files, async (page) => {
    const errors = errorsOf(page);
    await page.goto("http://rivet.test/spreadcase");
    assert.equal(await page.getAttribute("#cell", "tabindex"), "-1");
    await page.evaluate(() => {
      const log: (string | null)[] = ((window as { log?: (string | null)[] }).log = []);
      const cell = document.getElementById("cell")!;
      // Old values in order: a remove-then-set shows up as an extra record whose old value is null.
      new MutationObserver((records) => records.forEach((r) => r.attributeName === "tabindex" && log.push(r.oldValue))).observe(cell, {
        attributes: true,
        attributeOldValue: true,
      });
    });
    await page.click("#cell");
    await page.waitForFunction(() => document.getElementById("cell")!.getAttribute("tabindex") === "0", undefined, { timeout: 5000 });
    await page.waitForTimeout(50);
    assert.deepEqual(await page.evaluate(() => (window as { log?: (string | null)[] }).log), ["-1"]);
    assert.equal(await page.getAttribute("#cell", "readonly"), "");
    assert.deepEqual(errors, []);
  });
});
