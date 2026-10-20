// Derived model, browser side (M2 lane R: R2 loader + R3 adopt): a page rendered by `derivedToString` (boundaries tail +
// derived loader) boots from the tail on the first interaction, adopts boundary units over the live server nodes and
// updates them in place. Fixture: `tests/derived/page.{server,dom}.tsx`, hand-lowered to the derived ABI (the server as
// the M2-C target emits it, the DOM as C3 is to emit it) and compiled with today's server / DOM targets; the last case
// compiles `tests/derived/page.tsx` with the real derived server target (ATTR roots, `<!--[-->` content markers,
// `<h5>-<n>` keys; skips on a wasm without the model). Served as a derived build (`DERIVED_BUILD`:
// lazy rows + `DERIVED` switches); `/rt.js` = the manifest runtime (default export of `@rivetjs/runtime/dom-derived`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, DEV_BUILD, rewrite, withPage } from "./resume/harness.ts";

type Data = { title: string; rows: { id: number }[] };
const fixture = (name: string): Promise<string> => readFile(new URL("./derived/" + name, import.meta.url), "utf8");
const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js", Header: "/page.js", Counter: "/page.js" } };
const data = (n: number): Data => ({ title: "Records", rows: Array.from({ length: n }, (_, i) => ({ id: i + 1 })) });

async function serverHtml(n: number, edit: (source: string) => string = (s) => s): Promise<string> {
  const out = compile(edit(await fixture("page.server.tsx")), { target: "server", filename: "page.server.tsx" });
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: (props: { data: Data }) => ServerValue }>(out.code);
  return (await derivedToString(() => App({ data: data(n) }), { manifest })) as string;
}
async function domModule(edit: (source: string) => string = (s) => s): Promise<string> {
  const out = compile(edit(await fixture("page.dom.tsx")), { target: "dom", filename: "page.dom.tsx" });
  assert.deepEqual(out.diagnostics, []);
  return rewrite(out.code);
}
async function files(
  n = 4,
  options: { dev?: boolean; edit?: (source: string) => string; server?: (source: string) => string } = {},
): Promise<Record<string, string>> {
  return {
    ...DERIVED_BUILD,
    ...(options.dev ? DEV_BUILD : {}),
    "/": "<!doctype html><html><body>" + (await serverHtml(n, options.server)) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": await domModule(options.edit),
  };
}
const text = (page: Page, selector: string): Promise<string | null> => page.textContent(selector);
// Tag server nodes (expando) to check later that the same nodes are on the page.
const tag = (page: Page, selectors: string[]): Promise<void> =>
  page.evaluate((list) => list.forEach((s, i) => ((document.querySelector(s) as unknown as Record<string, number>).__t = i + 1)), selectors);
const tagged = (page: Page, selectors: string[]): Promise<boolean[]> =>
  page.evaluate((list) => list.map((s, i) => (document.querySelector(s) as unknown as Record<string, number> | null)?.__t === i + 1), selectors);
const handled = (page: Page, selector: string): Promise<boolean> =>
  page.evaluate((s) => (document.querySelector(s) as unknown as Record<string, unknown>).$$click !== undefined, selector);

test("server: tail with chunk names, held keys, runtime URL and the derived loader", async () => {
  const html = await serverHtml(3);
  const match = /<script type="rivet\/boundaries" data-rt="\/rt.js" data-events="click keydown">(.*?)<\/script><script>\(function\(\)\{/s.exec(html);
  assert.ok(match, html.slice(-600));
  const tail = JSON.parse(match[1]!);
  assert.deepEqual(tail.m, { App: "/page.js", Header: "/page.js", Counter: "/page.js" });
  assert.deepEqual(tail.k, { "3": "ArrowUp" });
  assert.deepEqual(tail.w, { "1.a-0": [3] });
  assert.deepEqual(
    tail.b.map((r: unknown[]) => r.slice(0, 4)),
    [
      [1, 0, 1, "App"],
      [2, 1, 0, "Header"],
      [3, 1, 1, "Counter"],
    ],
  );
  // The delegated types the boundaries use (`_rB` events); no `data-boot` (no trigger): the pattern above ends the tag.
  assert.ok(!html.includes('type="rivet/state"'));
});

test("boot from the tail: nothing loads before input; a cold click adopts the boundary and updates in place", async () => {
  await withPage(await files(), async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(requests, ["/"], "no module before an interaction");
    await tag(page, ["main", "#count", "#inc", "#title", "ul li:nth-child(2)"]);
    // Counter's first click: the loader holds it, boots the runtime, the runtime adopts App (Counter's wake source) and
    // Counter, then replays the click to Counter's handler.
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
    assert.deepEqual(await tagged(page, ["main", "#count", "#inc", "#title", "ul li:nth-child(2)"]), [true, true, true, true, true], "server nodes kept");
    assert.ok(requests.includes("/rt.js") && requests.includes("/page.js"));
    assert.equal(await text(page, "#title"), "Records (4 rows)");
    // Live from now on: a second click runs synchronously in the native dispatch.
    await page.click("#inc");
    assert.equal(await text(page, "#count"), "7");
    // Keyed keydown hold (`k`): ArrowUp runs Counter's keydown handler.
    await page.focus("#inc");
    await page.keyboard.press("ArrowUp");
    assert.equal(await text(page, "#count"), "17");
  });
});

test("branch adoption: a dependent boundary's Show switches over the adopted server branch", async () => {
  await withPage(await files(), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["header", "#toggle", "#closed"]);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    assert.equal(await page.$("#closed"), null);
    assert.deepEqual(await tagged(page, ["header", "#toggle"]), [true, true]);
    await page.click("#toggle");
    assert.equal(await text(page, "#closed"), "closed");
    assert.equal(await page.$("#open"), null);
  });
});

test("deferred independent child + wake list: Counter stays inert until App's keyed theme is written", async () => {
  await withPage(await files(), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["#theme", "#inc"]);
    // Header (dependent) adopts with App; Counter (independent) is deferred.
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    assert.equal(await handled(page, "#toggle"), true);
    assert.equal(await handled(page, "#inc"), false, "Counter deferred");
    // App's `theme` (key a-0) has Counter on its wake list: the first write materialises Counter, then notifies.
    await page.click("#dark");
    assert.equal(await text(page, "#theme"), "dark");
    assert.equal(await handled(page, "#inc"), true, "Counter materialised by the wake");
    assert.deepEqual(await tagged(page, ["#theme", "#inc"]), [true, true]);
  });
});

test("lazy rows: adopted O(1) without running a row; a row event materialises it, a keyed write the rest", async () => {
  await withPage(await files(6), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["ul li:nth-child(3)", "ul li:nth-child(5)", "ul li:nth-child(3) button"]);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    const rows = () => page.evaluate(() => [...document.querySelectorAll(".pick")].map((b) => (b as unknown as Record<string, unknown>).$$click !== undefined));
    assert.deepEqual(await rows(), [false, false, false, false, false, false], "rows adopted lazily");
    await page.click("ul li:nth-child(3) button");
    const sel = () => page.evaluate(() => [...document.querySelectorAll("li")].map((li) => li.getAttribute("data-sel")).join(""));
    assert.equal(await sel(), "nnynnn");
    // `selected` is read by every row (sampled): its first write materialised the whole list.
    assert.deepEqual(await rows(), [true, true, true, true, true, true]);
    await page.click("ul li:nth-child(5) button");
    assert.equal(await sel(), "nnnnyn");
    assert.deepEqual(await tagged(page, ["ul li:nth-child(3)", "ul li:nth-child(5)", "ul li:nth-child(3) button"]), [true, true, true]);
  });
});

test("triggers: a load / idle / visible boundary materialises without input (data-boot)", async () => {
  for (const flag of [32, 64, 128]) {
    const served = await files(4, { server: (s) => s.replace('_rB("Counter", 1,', '_rB("Counter", ' + (1 | flag) + ",") });
    assert.match(served["/"]!, /<script type="rivet\/boundaries" data-rt="\/rt.js" data-events="click keydown" data-boot>/);
    await withPage(served, async (page, requests) => {
      await page.goto("http://rivet.test/");
      await page.waitForFunction(() => (document.querySelector("#inc") as unknown as Record<string, unknown>).$$click !== undefined);
      assert.ok(requests.includes("/page.js"), String(flag));
      // Its wake source (App) materialised first; nothing else ran: rows stay lazy.
      assert.equal(await handled(page, "#dark"), true);
      assert.equal(await handled(page, "ul li:nth-child(1) button"), false);
      // Live (no hold); the page's first mouse click flushes one task later (first-click defer).
      await page.click("#inc");
      await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
    });
  }
});

test("dev adopt verifier: a hand-broken fixture warns with the boundary name and renders it in the browser", async () => {
  const broken = await files(3, { dev: true, edit: (s) => s.replace(/<h1 id="title">([\s\S]*?)<\/h1>/, '<h2 id="title">$1</h2>') });
  await withPage(broken, async (page) => {
    const warnings: string[] = [];
    page.on("console", (message) => message.type() === "warning" && warnings.push(message.text()));
    await page.goto("http://rivet.test/");
    // The cold click materialises App: the verifier warns, App renders in the browser (the click's target left the page
    // with the server nodes, so it is dropped); the next click runs on the client-rendered nodes.
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#title")!.localName === "h2");
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    const adopt = warnings.filter((w) => w.includes("did not adopt"));
    assert.equal(adopt.length, 1, warnings.join("\n"));
    assert.match(adopt[0]!, /boundary App \(b1\)/);
    assert.match(adopt[0]!, /<h1>|h2/);
    await page.click("#toggle");
    assert.equal(await text(page, "#closed"), "closed");
  });
});

test("adopt cost: materialising the page root is O(spine), not O(rows)", async () => {
  const cost = async (n: number) =>
    withPage(await files(n), async (page) => {
      await page.goto("http://rivet.test/");
      // Start the runtime and load App's chunk (intent), then time the adopt alone.
      await page.dispatchEvent("#title", "focusin");
      await page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => e.name.endsWith("/page.js")));
      return page.evaluate(async () => {
        const rt = (await import("/rt.js" as string)).default as { m(id: number): Promise<void> };
        await new Promise((resolve) => setTimeout(resolve, 50));
        const t = performance.now();
        await rt.m(1);
        const ms = performance.now() - t;
        // Row functions run: none (each row is a lazy key over its server nodes; one detached sample row ran).
        const rows = [...document.querySelectorAll(".pick")].filter((b) => (b as unknown as Record<string, unknown>).$$click !== undefined).length;
        return [ms, rows] as const;
      });
    });
  const [small, smallRows] = await cost(10),
    [large, largeRows] = await cost(1000);
  console.info(`derived adopt of App: 10 rows ${small.toFixed(2)} ms, 1000 rows ${large.toFixed(2)} ms`);
  assert.deepEqual([smallRows, largeRows], [0, 0], "no row materialised by the root's adopt");
  // Timing (coarse: Chromium rounds performance.now to 0.1 ms): eager rows measured 11.8 ms at 1000 rows vs 4.8 lazy.
  assert.ok(large < small * 3 + 6, `1000 rows ${large} ms vs 10 rows ${small} ms`);
});

const compiled = hasDerivedModel() ? test : test.skip;
compiled("compiled derived server output (ATTR roots, content markers, module keys) adopts with the hand-lowered DOM module", async () => {
  const out = compile(await fixture("page.tsx"), {
    target: "server",
    filename: "page.tsx",
    resume: { module: "src/page.tsx", model: "derived", boundaries: ["App", "Header", "Counter"], independent: ["App", "Counter"] },
  } as never);
  assert.deepEqual(out.diagnostics, []);
  // The DOM module takes the server's keys (C3 emits one key plan for both targets), in source order.
  const keys = [...out.code.matchAll(/__rivetR_sig\("([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(keys.length, 4);
  let k = 0;
  const { App } = await importServer<{ App: (props: { data: Data }) => ServerValue }>(out.code);
  const html = (await derivedToString(() => App({ data: data(5) }), { manifest })) as string;
  assert.match(html, /<header data-b="2">/);
  assert.match(html, /<div class="counter" data-b="3">/);
  assert.match(html, /<h1 id="title"><!--\[-->Records<!--\]--> \(<!--\[-->5<!--\]--> rows\)<\/h1>/);
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": await domModule((source) => source.replace(/_sig\("[^"]+"/g, () => '_sig("' + keys[k++] + '"')),
  };
  await withPage(served, async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["header", "#inc", "#count", "#title", "ul li:nth-child(4)"]);
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
    await page.click("#toggle");
    assert.equal(await text(page, "#open"), "open");
    await page.click("ul li:nth-child(4) button");
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("li")].map((li) => li.getAttribute("data-sel")).join("")), "nnnyn");
    await page.click("#dark");
    assert.equal(await text(page, "#theme"), "dark");
    assert.deepEqual(await tagged(page, ["header", "#inc", "#count", "#title", "ul li:nth-child(4)"]), [true, true, true, true, true]);
    assert.equal(await text(page, "#title"), "Records (5 rows)");
  });
});
