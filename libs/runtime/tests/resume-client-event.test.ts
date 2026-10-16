// Resume: document / window clientEvent listeners attach before the first interaction's handlers run
// (not only at idle), so a document event dispatched by the first click reaches them; a listener with
// `match` runs (and loads its chunk) only for events inside a matching element.
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

const source = await readFile(new URL("./resume/client-event-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/client-event.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/client-event.tsx").code);
const manifest: ResumeManifest = {
  hash: "client-event",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  // Idle never fires: the listeners can only be there because the first interaction attached them.
  "/": "<!doctype html><html><head><script>window.requestIdleCallback = () => 0;</script></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("resume: document / window clientEvent listeners see an event dispatched by the first interaction's handler", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.click("#ping");
    await page.waitForFunction(() => document.querySelector("#pings")!.textContent === "1", undefined, { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.querySelector("#sizes")!.textContent), "1");
    await page.click("#ping");
    await page.waitForFunction(() => document.querySelector("#pings")!.textContent === "2", undefined, { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.querySelector("#sizes")!.textContent), "2");
    assert.deepEqual(errors, []);
  });
});

test("resume: a clientEvent with `match` ignores events outside a matching element and loads no chunk for them", async () => {
  await withPage(files, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    // A plain signal handler's click boots the runtime and attaches the listener: no Links chunk, no run.
    await page.click("#ping");
    await page.waitForFunction(() => document.querySelector("#pings")!.textContent === "1", undefined, { timeout: 3000 });
    await page.click("#text");
    await page.evaluate(() => new Promise((done) => setTimeout(done, 50)));
    assert.equal(await page.evaluate(() => document.querySelector("#hits")!.textContent), "0");
    assert.ok(!requests.includes("/c/Links.js"), requests.join(" "));
    // Inside the link (its child is the target): the handler runs once, the default is canceled.
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#hits")!.textContent === "1", undefined, { timeout: 3000 });
    assert.equal(await page.evaluate(() => location.hash), "");
    assert.ok(requests.includes("/c/Links.js"));
    assert.deepEqual(errors, []);
  });
});

test("resume: the boot intent is replayed only to listeners whose `match` it meets; focusin `a,form`; `once` + `match` (also consumed by a replayed intent)", async () => {
  const text = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.textContent, id);
  // Hover on a button (its own handler boots the runtime): the replayed pointerover is outside `a,form` → not counted.
  await withPage(files, async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.hover("#ping");
    for (let i = 0; i < 60 && !requests.includes("/c/Links.js") && !requests.includes("/rt.js"); i++) await page.waitForTimeout(50);
    assert.ok(requests.includes("/rt.js"), "intent booted the runtime: " + requests.join(" "));
    await page.evaluate(() => new Promise((done) => setTimeout(done, 300)));
    assert.equal(await text(page, "overs"), "0");
  });
  // Hover on a root-relative link boots the lazy listeners: the intent itself is replayed to the matching one.
  await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await page.hover("#nav");
    await page.waitForFunction(() => document.getElementById("overs")!.textContent === "1", undefined, { timeout: 3000 });
    // The replayed intent ran the `once` listener: it is consumed, a second hover does not run it.
    assert.equal(await text(page, "firsts"), "1");
    await page.hover("#text");
    await page.hover("#nav");
    await page.waitForFunction(() => document.getElementById("overs")!.textContent === "2", undefined, { timeout: 3000 });
    assert.equal(await text(page, "firsts"), "1");
    // focusin inside a form matches `a,form`; once the runtime runs, live events count directly.
    await page.focus("#field");
    await page.waitForFunction(() => document.getElementById("overs")!.textContent === "3", undefined, { timeout: 3000 });
  });
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.click("#ping");
    await page.click("#text");
    await page.click("#once");
    await page.waitForFunction(() => document.getElementById("onces")!.textContent === "1", undefined, { timeout: 3000 });
    await page.click("#once");
    await page.evaluate(() => new Promise((done) => setTimeout(done, 50)));
    assert.equal(await text(page, "onces"), "1");
    assert.deepEqual(errors, []);
  });
});
