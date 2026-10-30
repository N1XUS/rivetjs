// Derived model, browser side (M2 lane R: R2 loader + R3 adopt; lane C3: the compiled DOM target): a page rendered by
// `derivedToString` (boundaries tail + derived loader) boots from the tail on the first interaction, adopts boundary units
// over the live server nodes and updates them in place. Fixture: `tests/derived/page.{server,dom}.tsx`, hand-lowered to
// the derived ABI (bare boundary names) and compiled with today's server / DOM targets; the last case compiles
// `tests/derived/page.tsx` with the real derived server target (ATTR roots, `<!--[-->` content markers, `<h5>-<n>` keys)
// and the real derived DOM target (C3: `_b` / `_sig`, module-qualified names `src/page.tsx#App`; skips on a wasm without
// the model). Served as a derived build (`DERIVED_BUILD`: lazy rows + `DERIVED` switches); `/rt.js` = the manifest
// runtime (default export of `@rivetjs/runtime/dom-derived`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { readFile } from "node:fs/promises";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, DEV_BUILD, rewrite, withPage } from "./resume/harness.ts";
// Tail v2 (ZERO S2) in its flush shape (names resolved, runs expanded), loosely typed like the JSON it was.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tailJson = (tail: unknown): any => expandTail(tail as never);

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
  page.evaluate((s) => (document.querySelector(s) as unknown as Record<string, unknown>).$rclick !== undefined, selector);

test("dev dispose cancels an adoption waiting for its page ready hook", async () => {
  const served = await files(1, { dev: true });
  served["/page.js"] += `
const originalApp = App;
App = (props) => {
  globalThis.disposeRuns = (globalThis.disposeRuns ?? 0) + 1;
  return originalApp(props);
};
App.ready = () => new Promise((resolve) => { globalThis.disposeRelease = resolve; });
`;
  await withPage(served, async (page) => {
    await page.goto("http://rivet.test/");
    await page.dispatchEvent("#inc", "pointerdown");
    await page.waitForFunction(() => typeof (globalThis as { disposeRelease?: unknown }).disposeRelease === "function");
    const runs = await page.evaluate(async () => {
      const runtime = (await import("/rt.js" as string)).default as { m(id: number): Promise<void>; dispose(): void };
      const pending = runtime.m(1);
      runtime.dispose();
      (globalThis as unknown as { disposeRelease(): void }).disposeRelease();
      await pending;
      return (globalThis as { disposeRuns?: number }).disposeRuns ?? 0;
    });
    assert.equal(runs, 0, "a disposed runtime must not create new component owners after ready settles");
    assert.equal(await handled(page, "#inc"), false);
  });
});

test("server: tail with chunk names, held keys, runtime URL and the derived loader", async () => {
  const html = await serverHtml(3);
  const match = /<script type="rivet\/boundaries" data-rt="\/rt.js" data-fo="\/rt.js \/page.js">(.*?)<\/script><script>\(function\(\)\{/s.exec(html);
  assert.ok(match, html.slice(-600));
  const tail = tailJson(JSON.parse(match[1]!));
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

test("boot from the tail: nothing runs before input (fetch-ahead only); a cold click adopts the boundary and updates in place", async () => {
  await withPage(await files(), async (page, requests) => {
    await page.goto("http://rivet.test/");
    // Fetch-ahead (DERIVED-C, tail `data-fo`): the runtime + the boundary chunks as low-priority modulepreloads after
    // `load`; the idle prime (LITE-BOOT) may evaluate them and their imports, but nothing is adopted before the click.
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map((l) => [l.getAttribute("href"), l.fetchPriority]),
      ),
      [
        ["/rt.js", "low"],
        ["/page.js", "low"],
      ],
    );
    assert.ok(
      requests.every((r) => ["/", "/rt.js", "/page.js", "/dom-derived.ts"].includes(r) || /\.m?[jt]s$/.test(r)),
      requests.join(" "),
    );
    assert.equal(await handled(page, "#inc"), false, "no module evaluated before an interaction");
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

test("lazy rows: adopted O(1) without running a row; a row event materialises it, a keyed write reruns its row writers", async () => {
  await withPage(await files(6), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["ul li:nth-child(3)", "ul li:nth-child(5)", "ul li:nth-child(3) button"]);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    const rows = () => page.evaluate(() => [...document.querySelectorAll(".pick")].map((b) => (b as unknown as Record<string, unknown>).$rclick !== undefined));
    assert.deepEqual(await rows(), [false, false, false, false, false, false], "rows adopted lazily");
    await page.click("ul li:nth-child(3) button");
    const sel = () => page.evaluate(() => [...document.querySelectorAll("li")].map((li) => li.getAttribute("data-sel")).join(""));
    assert.equal(await sel(), "nnynnn");
    // Rows read `selected` only through a hoisted binding whose captures every row supplies (element, `selected`, the
    // row's item): a write reruns that writer over the lazy rows (DERIVED-C) — only the clicked row materialised.
    assert.deepEqual(await rows(), [false, false, true, false, false, false]);
    await page.click("ul li:nth-child(5) button");
    assert.equal(await sel(), "nnnnyn");
    assert.deepEqual(await rows(), [false, false, true, false, true, false]);
    // A write from outside the list (a third pick through row 3's handler again) keeps every row right.
    await page.click("ul li:nth-child(3) button");
    assert.equal(await sel(), "nnynnn");
    assert.deepEqual(await tagged(page, ["ul li:nth-child(3)", "ul li:nth-child(5)", "ul li:nth-child(3) button"]), [true, true, true]);
  });
});

test("lazy rows on demand (DERIVED-C2): a deep row event builds that row, a keyed write writes only the rows it changes", async () => {
  await withPage(await files(200), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["ul li:nth-child(150)", "ul li:nth-child(3)"]);
    // Every `data-sel` write on the page from now on (a same-value write is a record too).
    await page.evaluate(() => {
      const w = window as unknown as { writes: string[] };
      w.writes = [];
      new MutationObserver((list) => {
        for (const r of list) if (r.attributeName === "data-sel") w.writes.push((r.target as Element).querySelector(".pick")!.textContent!);
      }).observe(document.body, { subtree: true, attributes: true });
    });
    // The rows written (a row's adopt run writes its own attribute once too, same value).
    const writes = async () => [...new Set(await page.evaluate(() => (window as unknown as { writes: string[] }).writes.splice(0)))].sort();
    const sel = () => page.evaluate(() => [...document.querySelectorAll("li")].flatMap((li, i) => (li.getAttribute("data-sel") === "y" ? [i + 1] : [])));
    // Row 150's opener is counted from the event path (149 groups before it): its own row, its own item.
    await page.click("ul li:nth-child(150) button");
    await page.waitForFunction(() => document.querySelector("ul li:nth-child(150)")!.getAttribute("data-sel") === "y");
    assert.deepEqual(await sel(), [150]);
    assert.deepEqual(await writes(), ["Pick 150"], "one row's output changed: no other row written");
    await page.click("ul li:nth-child(3) button");
    assert.deepEqual(await sel(), [3]);
    assert.deepEqual(await writes(), ["Pick 150", "Pick 3"]);
    assert.deepEqual(await tagged(page, ["ul li:nth-child(150)", "ul li:nth-child(3)"]), [true, true], "server nodes kept");
  });
});

test("lazy rows: a keyed read outside a row writer (a text binding) wakes the whole list on the first write", async () => {
  const mark = (source: string) => source.replace("Pick {row().id}", 'Pick {row().id}{selected() === row().id ? "*" : ""}');
  await withPage(await files(6, { edit: mark, server: mark }), async (page) => {
    await page.goto("http://rivet.test/");
    const rows = () => page.evaluate(() => [...document.querySelectorAll(".pick")].map((b) => (b as unknown as Record<string, unknown>).$rclick !== undefined));
    await page.click("ul li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("ul li:nth-child(2)")!.getAttribute("data-sel") === "y");
    assert.deepEqual(await rows(), [true, true, true, true, true, true]);
    const marks = () => page.evaluate(() => [...document.querySelectorAll(".pick")].map((b) => (b.textContent!.endsWith("*") ? "*" : "-")).join(""));
    assert.equal(await marks(), "-*----");
    await page.click("ul li:nth-child(6) button");
    assert.equal(await marks(), "-----*");
  });
});

test("triggers: a load / idle / visible boundary materialises without input (data-boot)", async () => {
  for (const flag of [32, 64, 128]) {
    const served = await files(4, { server: (s) => s.replace('_rB("Counter", 1,', '_rB("Counter", ' + (1 | flag) + ",") });
    // A `visible` trigger alone (ZERO ABI-SPLIT): `data-boot` names the boundary (the loader waits until it is on screen).
    const boot = flag === 128 ? 'data-boot="3"' : "data-boot";
    assert.ok(served["/"]!.includes('<script type="rivet/boundaries" data-rt="/rt.js" ' + boot + ' data-fo="/rt.js /page.js">'), served["/"]!.slice(-900));
    await withPage(served, async (page, requests) => {
      await page.goto("http://rivet.test/");
      await page.waitForFunction(() => (document.querySelector("#inc") as unknown as Record<string, unknown>).$rclick !== undefined);
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

test("visible-only boot (ZERO ABI-SPLIT): the runtime loads when the boundary scrolls into view, not before", async () => {
  const served = await files(4, { server: (s) => s.replace('_rB("Counter", 1,', '_rB("Counter", ' + (1 | 128) + ",") });
  // Below the fold: a spacer taller than the viewport before the page.
  served["/"] = served["/"]!.replace("<body>", '<body><div id="spacer" style="height:3000px"></div>');
  assert.ok(served["/"]!.includes('data-boot="3"'));
  await withPage(served, async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(300);
    // (`/rt.js` may be fetched ahead at idle — `data-fo` — but it does not start: nothing is adopted.)
    assert.equal(await handled(page, "#inc"), false, "the runtime started before the boundary was visible");
    assert.equal(await page.evaluate(() => typeof (document as unknown as { $rdp?: unknown }).$rdp), "undefined");
    await page.evaluate(() => document.querySelector("#inc")!.scrollIntoView());
    await page.waitForFunction(() => (document.querySelector("#inc") as unknown as Record<string, unknown>).$rclick !== undefined);
    assert.ok(requests.includes("/page.js"));
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
  });
  // An event before it is visible boots as on any page (the held click replays).
  await withPage(served, async (page) => {
    await page.goto("http://rivet.test/");
    await page.evaluate(() => (document.querySelector("#inc") as HTMLElement).click());
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
  });
});

test("visible trigger observer is disconnected when its boundary's markup leaves the page before it intersected (SMA-08)", async () => {
  // Counter: `visible` (below the fold); Header: `idle` — it adopts App at idle, whose hand-broken markup renders it in the
  // browser: Counter's server nodes leave the page before they ever intersected.
  const served = await files(3, {
    dev: true,
    edit: (s) => s.replace(/<h1 id="title">([\s\S]*?)<\/h1>/, '<h2 id="title">$1</h2>'),
    // (Counter's server root carries its `data-b`, `ATTR`: the hand-lowered fixture writes no opener for it.)
    server: (s) =>
      s
        .replace('_rB("Counter", 1,', '_rB("Counter", ' + (1 | 2 | 128) + ",")
        .replace('<div class="counter">', '<div class="counter" data-b="3">')
        .replace('_rB("Header", 0,', '_rB("Header", 64,'),
  });
  served["/"] = served["/"]!.replace("<body>", '<body><div id="spacer" style="height:3000px"></div>');
  await withPage(served, async (page) => {
    // Observers of Counter's element: observed / disconnected.
    await page.addInitScript(() => {
      const Native = window.IntersectionObserver,
        log = ((window as unknown as { ioLog: { observed: number; disconnected: number } }).ioLog = { observed: 0, disconnected: 0 });
      window.IntersectionObserver = class extends Native {
        mine = false;
        override observe(el: Element): void {
          if (el.classList.contains("counter")) ((this.mine = true), log.observed++);
          super.observe(el);
        }
        override disconnect(): void {
          if (this.mine) ((this.mine = false), log.disconnected++);
          super.disconnect();
        }
      };
    });
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => document.querySelector("#title")!.localName === "h2");
    const log = await page.evaluate(() => (window as unknown as { ioLog: { observed: number; disconnected: number } }).ioLog);
    assert.equal(log.observed, 1, "Counter's visible trigger was scheduled");
    assert.equal(log.disconnected, 1, "its observer was disconnected when its markup left the page");
    // Counter renders as a plain client component inside App's browser render.
    await page.evaluate(() => (document.querySelector("#inc") as HTMLElement).click());
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
  });
});

test("dev adopt verifier: a hand-broken fixture warns with the boundary name and renders it in the browser", async () => {
  const broken = await files(3, { dev: true, edit: (s) => s.replace(/<h1 id="title">([\s\S]*?)<\/h1>/, '<h2 id="title">$1</h2>') });
  await withPage(broken, async (page) => {
    const warnings: string[] = [];
    page.on("console", (message) => message.type() === "warning" && warnings.push(message.text()));
    await page.goto("http://rivet.test/");
    // The cold click materialises App: the verifier warns, App renders in the browser; the click's target left the page
    // with the server nodes, and the click replays on the node at its place in the browser's render (M6-PARITY task 5).
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#title")!.localName === "h2");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    const adopt = warnings.filter((w) => w.includes("did not adopt"));
    assert.equal(adopt.length, 1, warnings.join("\n"));
    assert.match(adopt[0]!, /boundary App \(b1\)/);
    assert.match(adopt[0]!, /<h1>|h2/);
    await page.click("#toggle");
    assert.equal(await text(page, "#closed"), "closed");
  });
});

test("retarget (M6-PARITY task 5): a live click whose unit renders in the browser runs on the browser's node", async () => {
  const broken = await files(3, { dev: true, edit: (s) => s.replace('<span id="count">{n()}</span>', '<em id="count">{n()}</em>') });
  await withPage(broken, async (page) => {
    await page.goto("http://rivet.test/");
    // The runtime is live (App adopted); Counter, independent, adopts on its own first click: a mismatch renders it in
    // the browser while that click is being dispatched — the click runs on the browser's `#inc`.
    await page.click("ul li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("ul li:nth-child(2)")!.getAttribute("data-sel") === "y");
    assert.equal(await page.evaluate(() => document.querySelector("#count")!.localName), "span", "Counter not adopted yet");
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#count")!.localName === "em");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
    await page.click("#inc");
    assert.equal(await text(page, "#count"), "7");
  });
});

test("retarget onto SVG (ZERO ONDEMAND): a press on an icon whose unit renders in the browser clicks the browser's icon", async () => {
  // The press starts on a server `<rect>` that the adopt run of the pointerdown removes (a mismatch renders Counter in
  // the browser): Chrome sends the mousedown to a connected ancestor and no click, so the release clicks the browser's
  // `<rect>` — SVG elements have no `click()`: a dispatched click (before: TypeError, the press was lost).
  const icon = (s: string) =>
    s
      .replace("          +\n", '          <svg id="ico" width="40" height="40"><rect width="40" height="40" /></svg>\n')
      .replace('id="inc" onClick', 'id="inc" onPointerDown={() => {}} onClick')
      .replace('"click keydown", "ArrowUp"', '"click keydown pointerdown", "ArrowUp"');
  const broken = await files(3, { dev: true, server: icon, edit: (s) => icon(s).replace('<span id="count">{n()}</span>', '<em id="count">{n()}</em>') });
  await withPage(broken, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.click("ul li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("ul li:nth-child(2)")!.getAttribute("data-sel") === "y");
    const box = (await page.locator("#ico rect").boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("#count")!.localName === "em");
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "6");
    assert.deepEqual(errors, []);
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
        const rows = [...document.querySelectorAll(".pick")].filter((b) => (b as unknown as Record<string, unknown>).$rclick !== undefined).length;
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

test("document click listeners (`_rListen`, M2-R5) + `ready`: a link outside every boundary adopts the root first", async () => {
  // Server: the router's generated entry registers its link clicks (`a[href]`) before the root boundary opens.
  const out = compile(await fixture("page.server.tsx"), { target: "server", filename: "page.server.tsx" });
  const { App } = await importServer<{ App: (props: { data: Data }) => ServerValue }>(out.code);
  const { _rListen } = await import("@rivetjs/runtime/server-derived");
  const html = (await derivedToString(() => (_rListen("a.nav"), App({ data: data(4) })), { manifest })) as string;
  const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  assert.deepEqual(tail.g, [[1, "a.nav"]]);
  assert.match(html, /<script type="rivet\/boundaries" data-rt="\/rt\.js" data-g="a\.nav" data-fo="\/rt\.js \/page\.js">/);
  // Browser: App's chunk exports `ready` (the router's `Root.ready`: page modules), awaited once before its adopt run.
  const page = await domModule();
  const ready = page + "\nApp.ready = () => new Promise((done) => setTimeout(() => ((window.__ready = (window.__ready || 0) + 1), done()), 30));\n";
  const body = html + '<p id="shell"><a class="nav" id="out" href="#moved"><span id="label">elsewhere</span></a></p>';
  await withPage(
    {
      ...DERIVED_BUILD,
      "/": "<!doctype html><html><body>" + body + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/page.js": ready,
    },
    async (page, requests) => {
      await page.goto("http://rivet.test/");
      await tag(page, ["main", "#toggle"]);
      // A click on the link's child, outside every boundary: held (default prevented), App adopted after `ready`, replayed.
      await page.click("#label");
      await page.waitForFunction(() => location.hash === "#moved");
      assert.ok(requests.includes("/rt.js") && requests.includes("/page.js"));
      assert.equal(await page.evaluate(() => (window as unknown as { __ready?: number }).__ready), 1);
      assert.equal(await handled(page, "#toggle"), true, "App adopted by the outside click");
      assert.deepEqual(await tagged(page, ["main", "#toggle"]), [true, true], "server nodes kept");
      // Outside every boundary and no `data-g` match: nothing (no hold).
      await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<button id="plain">plain</button>'));
      await page.click("#plain");
      await page.click("#toggle");
      await page.waitForFunction(() => document.querySelector("#open") !== null);
    },
  );
});

const compiled = hasDerivedModel() ? test : test.skip;
const RESUME = { module: "src/page.tsx", boundaries: ["App", "Header", "Counter"], independent: ["App", "Counter"] };
const qualified = { "src/page.tsx#App": "/page.js", "src/page.tsx#Header": "/page.js", "src/page.tsx#Counter": "/page.js" };
compiled("compiled derived server + DOM targets (C3: `_b` / `_sig` with the server's names and keys) adopt end to end", async () => {
  const source = await fixture("page.tsx");
  const server = compile(source, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  const dom = compile(source, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  // One plan for both targets: the same module-qualified boundary names and `<h5>-<n>` keys, in source order.
  const names = (code: string, callee: string) => [...code.matchAll(new RegExp(callee + '\\("([^"]+)"', "g"))].map((m) => m[1]!);
  assert.deepEqual(names(server.code, "__rivetR_b"), ["src/page.tsx#Header", "src/page.tsx#Counter", "src/page.tsx#App"]);
  assert.deepEqual(names(dom.code, "__rivetR_b"), names(server.code, "__rivetR_b"));
  assert.equal(names(server.code, "__rivetR_sig").length, 4);
  assert.deepEqual(names(dom.code, "__rivetR_sig"), names(server.code, "__rivetR_sig"));
  assert.deepEqual((dom as { boundaries?: string[] }).boundaries, names(dom.code, "__rivetR_b"));
  const { App } = await importServer<{ App: (props: { data: Data }) => ServerValue }>(server.code);
  const html = (await derivedToString(() => App({ data: data(5) }), { manifest: { ...manifest, symbols: qualified } })) as string;
  assert.match(html, /<header data-b="2">/);
  assert.match(html, /<div class="counter" data-b="3">/);
  assert.match(html, /<h1 id="title"><!--\[-->Records<!--\]--> \(<!--\[-->5<!--\]--> rows\)<\/h1>/);
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
  await withPage(served, async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(requests, ["/"], "no module before an interaction");
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

// M2-R5: a child boundary called for its side effects only (a cdk collection build pass: items register into a
// context and their output is discarded) runs inline in the probe and adopt runs — as a hole the registration was
// skipped, the browser rendered an empty list and the whole unit fell back to a browser render.
const BUILD_PASS = `import { createContext, provide, signal, useContext } from "@rivetjs/reactivity";
const Registry = createContext<string[] | null>(null);
export function Item(props: { label: string }) {
  const registry = useContext(Registry);
  if (registry) {
    registry.push(props.label);
    return null;
  }
  return <b>{props.label}</b>;
}
export function App() {
  const n = signal(0);
  const labels: string[] = [];
  provide(Registry, labels, () => [<Item label="a" />, <Item label="b" />]);
  return (
    <div>
      <button id="inc" onClick={() => n.set(n() + 1)}>{n()}</button>
      <ul>{labels.map((label) => <li>{label}</li>)}</ul>
    </div>
  );
}
`;
compiled("discarded child boundary (build pass): runs inline, the unit adopts instead of rendering in the browser", async () => {
  const resume = { module: "src/page.tsx", boundaries: ["App", "Item"], independent: ["App"] };
  const server = compile(BUILD_PASS, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(BUILD_PASS, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const symbols = { "src/page.tsx#App": "/page.js", "src/page.tsx#Item": "/page.js" };
  const html = (await derivedToString(() => App(), { manifest: { ...manifest, symbols } })) as string;
  assert.match(html, /<li>a<\/li><li>b<\/li>/);
  for (const build of [DERIVED_BUILD, { ...DERIVED_BUILD, ...DEV_BUILD }]) {
    const served = {
      ...build,
      "/": "<!doctype html><html><body>" + html + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/page.js": rewrite(dom.code),
    };
    await withPage(served, async (page) => {
      const warnings: string[] = [];
      page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
      await page.goto("http://rivet.test/");
      await tag(page, ["#inc", "ul li:nth-child(2)"]);
      await page.click("#inc");
      await page.waitForFunction(() => document.querySelector("#inc")!.textContent === "1");
      assert.deepEqual(await tagged(page, ["#inc", "ul li:nth-child(2)"]), [true, true]);
      assert.deepEqual(warnings, []);
    });
  }
});

// DERIVED-C: a boundary whose keyed state holds a non-data value (a selection `Set`: UNKEYED, left out of the record)
// adopts with that signal's browser init instead of rendering in the browser; a build pass (`_rUnrecorded`) run inside
// a unit runs outside it (its boundaries register, its signals are plain).
const UNKEYED_PAGE = `import { signal } from "@rivetjs/reactivity";
import { _rUnrecorded } from "@rivetjs/runtime/resume-format";
export function Item(props: { label: string }) {
  return <b>{props.label}</b>;
}
export function App() {
  const selected = signal(new Set(["b"]));
  const n = signal(0);
  const seen: string[] = [];
  _rUnrecorded(() => {
    const scratch = signal(1);
    seen.push(String(scratch()));
    return <Item label="x" />;
  });
  return (
    <div>
      <button id="inc" onClick={() => n.set(n() + 1)}>{n()}</button>
      <p id="sel">{[...selected()].join(",")}</p>
      <i id="seen">{seen.join("")}</i>
    </div>
  );
}
`;
compiled("UNKEYED boundary (non-data keyed state) adopts over the server nodes; a build pass runs outside the unit", async () => {
  const resume = { module: "src/page.tsx", boundaries: ["App", "Item"], independent: ["App"] };
  const server = compile(UNKEYED_PAGE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(UNKEYED_PAGE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const symbols = { "src/page.tsx#App": "/page.js", "src/page.tsx#Item": "/page.js" };
  const html = (await derivedToString(() => App(), { manifest: { ...manifest, symbols } })) as string;
  const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  assert.ok(tail.b[0][2] & 4, "App is UNKEYED");
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
  await withPage(served, async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["#inc", "#sel", "#seen"]);
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector("#inc")!.textContent === "1");
    assert.deepEqual(await tagged(page, ["#inc", "#sel", "#seen"]), [true, true, true], "adopted, not rendered in the browser");
    assert.equal(await text(page, "#sel"), "b");
    assert.equal(await text(page, "#seen"), "1");
  });
});

// DERIVED-S writes list-plan rows without ids (`<!--r[-->…<!--]-->`, the tape): rows are claimed by balance, never by id.
test("lazy rows: id-less row markers (DERIVED-S list tape) adopt and materialise the same", async () => {
  const served = await files(6);
  served["/"] = served["/"]!.replace(/<!--r\d+\[-->/g, "<!--r[-->");
  assert.ok(!/<!--r\d+\[-->/.test(served["/"]!) && served["/"]!.includes("<!--r[-->"));
  await withPage(served, async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["ul li:nth-child(3)", "ul li:nth-child(5)"]);
    await page.click("ul li:nth-child(3) button");
    const sel = () => page.evaluate(() => [...document.querySelectorAll("li")].map((li) => li.getAttribute("data-sel")).join(""));
    await page.waitForFunction(() => document.querySelector("ul li:nth-child(3)")!.getAttribute("data-sel") === "y");
    assert.equal(await sel(), "nnynnn");
    await page.click("ul li:nth-child(5) button");
    assert.equal(await sel(), "nnnnyn");
    assert.deepEqual(await tagged(page, ["ul li:nth-child(3)", "ul li:nth-child(5)"]), [true, true]);
  });
});
