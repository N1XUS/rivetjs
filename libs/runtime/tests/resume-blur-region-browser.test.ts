// Resume: a region re-created by the `change` the browser fires at the start of a blur is re-created from a window
// `focusout` listener, after the blur's `blur` / `focusout` reached the field (`activate` / `settling`: the event in
// flight targets the region's content). Replacing the field inside `change` sent the `focusout` to a detached element,
// so a form's delegated handler never saw the field the user left (ui TextField under `@rivetjs/forms`; route-chunk
// builds have the region's chunk ready at the first change, component builds only hid it behind chunk loads —
// ROUTE-CHUNKS 2026-10-18). A region its input's `focus` re-creates does so from the window `focusin` listener: the
// replacement's refocus (`keep`) runs inside the user's trusted focus sequence, never from a timer (a refocus without
// a user event, the 2026-10-18 timer fix: BLUR-FIX).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";
import type { Page } from "playwright";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/blur-region-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/blur-region.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/blur-region.tsx").code);
const manifest: ResumeManifest = {
  hash: "blur-region",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

// Before the page's scripts: records every programmatic `focus()` with the event being dispatched at the time.
const recordFocusCalls = () => {
  const calls: string[] = ((window as unknown as { __focusCalls: string[] }).__focusCalls = []);
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    const event = window.event;
    calls.push(this.id + " in " + (event ? event.type + (event.isTrusted ? "" : " (untrusted)") : "no event"));
    focus.call(this, options);
  };
};
const focusCalls = (page: Page) => page.evaluate(() => (window as unknown as { __focusCalls: string[] }).__focusCalls);

test("resume: the change at the start of a blur re-creates the field's region after its focusout", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(recordFocusCalls);
    await page.goto("http://rivet.test/");
    // The field's chunk is evaluated once the probe's click took effect: the blur's `change` then runs live, inside
    // the browser's dispatch (a cold replay runs outside it and sends the focusout to the old element anyway).
    await page.click("#probe");
    await page.waitForFunction(() => document.querySelector("#probed")!.textContent === "1", undefined, { timeout: 3000 });
    await page.focus("#field");
    await page.keyboard.type("x");
    await page.locator("#field").blur();
    await page.waitForFunction(() => document.querySelector("#committed")!.textContent === "x", undefined, { timeout: 3000 });
    // The form saw the focusout while the field was still in the document; the region re-created after it.
    await page.waitForFunction(() => document.querySelector("#blurs")!.textContent === "1", undefined, { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#field")!.hasAttribute("data-r")), false);
    // Focus had left the field when the region re-created: nothing refocused.
    assert.deepEqual(await focusCalls(page), []);
    assert.deepEqual(errors, []);
  });
});

test("resume: a mouse focus re-creating the field's region refocuses the replacement inside the trusted focusin", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(recordFocusCalls);
    await page.goto("http://rivet.test/");
    await page.click("#probe");
    await page.waitForFunction(() => document.querySelector("#probed")!.textContent === "1", undefined, { timeout: 3000 });
    await page.click("#focus-field");
    await page.waitForFunction(() => document.querySelector("#focused")!.textContent === "1", undefined, { timeout: 3000 });
    // Re-created (no server marker attribute), and the replacement holds focus.
    assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#focus-field")!.hasAttribute("data-r")), false);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "focus-field");
    // The only programmatic focus is the `keep` refocus, inside the browser's own focus sequence.
    assert.deepEqual(await focusCalls(page), ["focus-field in focusin"]);
    assert.deepEqual(errors, []);
  });
});

test("resume: a cold change / blur / focusout replay re-creates the field's region after the replayed focusout", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      // The chunk lands after the whole blur sequence was dispatched: every event replays from the cold chain.
      await page.focus("#field");
      await page.keyboard.type("x");
      await page.locator("#field").blur();
      await page.waitForFunction(() => document.querySelector("#committed")!.textContent === "x", undefined, { timeout: 3000 });
      await page.waitForFunction(() => document.querySelector("#blurs")!.textContent === "1", undefined, { timeout: 3000 });
      assert.equal(await page.evaluate(() => document.querySelector<HTMLInputElement>("#field")!.hasAttribute("data-r")), false);
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/Page.js": 150 } },
  );
});
