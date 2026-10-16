import { test } from "vitest";
import assert from "node:assert/strict";
import { loader } from "../resume-loader.ts";
import loaderModule from "../resume-loader-module.ts";
import { withPage } from "./resume/harness.ts";
import type { Page } from "playwright";

/** Counter each served chunk module increments when evaluated. */
type RanGlobal = typeof globalThis & { __ran?: number };

// Loader-only pages: a hand-written state and preload schedule; chunks are empty modules. The loader module
// (`data-ld`: scheduled prefetch, low-priority queue, idle evaluation) is served as `/ld.js`.
const pageWith = (schedule: unknown): string => {
  const preload = JSON.stringify(schedule).replace(/"/g, "&quot;");
  const state = JSON.stringify({ v: 1, rt: "/rt.js", c: [], s: {}, t: [], e: {}, m: {}, b: [], fx: [], ce: [] });
  return (
    '<!doctype html><html><head></head><body><p style="height:5000px">top</p><button data-r="5" id="far">far</button>' +
    `<script type="rivet/state" data-region="0" data-events="click" data-ld="/ld.js" data-preload="${preload}">${state}</script>` +
    "<script>(" + loader + ")()</script></body></html>"
  );
};
const schedule = ["/rt.js", ["/c/eager.js", "e"], ["/c/idle.js", "i"], ["/c/rows.js", "v", [5]], ["/c/more.js", "i"]];
const files: Record<string, string> = { "/": pageWith(schedule), "/ld.js": "export default " + loaderModule };
for (const name of ["rt", "c/eager", "c/idle", "c/rows", "c/more"]) files["/" + name + ".js"] = "globalThis.__ran = (globalThis.__ran ?? 0) + 1; export default {};";
// A background visible chunk (`P`, inside the planner's budget) last in plan order: its queue position shows whether
// visibility moved it forward.
const late = ["/rt.js", ["/c/eager.js", "e"], ["/c/idle.js", "i"], ["/c/more.js", "i"], ["/c/rows.js", "P", [5]]];
/** Holds every chunk response until the returned release is called. */
const gate = async (page: Page): Promise<() => void> => {
  let release!: () => void;
  const open = new Promise<void>((resolve) => (release = resolve));
  for (const url of ["http://rivet.test/c/**", "http://rivet.test/rt.js"])
    await page.route(url, async (route) => {
      await open;
      await route.fulfill({ body: "export default {};", contentType: "text/javascript" });
    });
  return release;
};
const hinted = (page: Page): Promise<string[]> =>
  page.$$eval('link[rel="modulepreload"]', (links) => (links as HTMLLinkElement[]).map((link) => new URL(link.href).pathname));

test("schedule: eager and idle prefetch after load, runtime first; visible waits for the viewport", async () => {
  await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 4);
    const first = await hinted(page);
    assert.equal(first[0], "/rt.js");
    assert.deepEqual([...first].sort(), ["/c/eager.js", "/c/idle.js", "/c/more.js", "/rt.js"]);
    assert.ok(!first.includes("/c/rows.js"));
    await page.evaluate(() => document.querySelector("#far")!.scrollIntoView());
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].some((l) => l.href.endsWith("/c/rows.js")));
    // Scheduled prefetches are low priority; each is then evaluated once in an idle slice.
    assert.ok(await page.$$eval('link[rel="modulepreload"]', (links) => (links as HTMLLinkElement[]).every((l) => l.fetchPriority === "low")));
    await page.waitForFunction(() => (globalThis as RanGlobal).__ran === 5);
  });
});

test("schedule: a clipped visually-hidden control does not count as visible", async () => {
  // RA's hidden select / date input: a 1px clipped wrapper fixed at the viewport's top-left. It intersects with zero
  // area wherever its widget is, so only the far element may trigger the widget's chunk.
  const hidden =
    '<div style="border:0;clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;margin:-1px;overflow:hidden;padding:0;position:fixed;width:1px;white-space:nowrap;top:0;left:0">' +
    '<input data-r="6" id="hidden"></div>';
  const page = pageWith(["/rt.js", ["/c/rows.js", "v", [6, 5]]]).replace("<p ", hidden + "<p ");
  await withPage({ ...files, "/": page }, async (page) => {
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(600);
    assert.deepEqual(await hinted(page), []);
    await page.evaluate(() => document.querySelector("#far")!.scrollIntoView());
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].some((l) => l.href.endsWith("/c/rows.js")));
  });
});

test("schedule: a background visible chunk follows the idle ones off screen", async () => {
  await withPage({ ...files, "/": pageWith(late) }, async (page) => {
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 5);
    assert.equal((await hinted(page))[4], "/c/rows.js");
    await page.waitForFunction(() => (globalThis as RanGlobal).__ran === 5);
  });
});

test("schedule: a visible chunk moves to the front of the queue", async () => {
  await withPage({ ...files, "/": pageWith(late) }, async (page) => {
    const release = await gate(page);
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    await page.evaluate(() => document.querySelector("#far")!.scrollIntoView());
    await page.waitForTimeout(400);
    release();
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 5);
    assert.equal((await hinted(page))[2], "/c/rows.js");
  });
});

test("schedule: at most two scheduled prefetches in flight", async () => {
  await withPage(files, async (page) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("http://rivet.test/c/**", async (route) => {
      await gate;
      await route.fulfill({ body: "export default {};", contentType: "text/javascript" });
    });
    await page.route("http://rivet.test/rt.js", async (route) => {
      await gate;
      await route.fulfill({ body: "export default {};", contentType: "text/javascript" });
    });
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    await page.waitForTimeout(300);
    assert.equal((await hinted(page)).length, 2);
    release();
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 4);
  });
});

test("schedule: nothing starts while the page scrolls", async () => {
  await withPage(files, async (page) => {
    await page.addInitScript(() => {
      const until = performance.now() + 700;
      const tick = () => {
        if (performance.now() > until) return;
        window.dispatchEvent(new Event("scroll"));
        document.dispatchEvent(new Event("scroll"));
        setTimeout(tick, 40);
      };
      tick();
    });
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(450);
    assert.deepEqual(await hinted(page), []);
    assert.equal(await page.evaluate(() => (globalThis as RanGlobal).__ran), undefined);
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 4);
    await page.waitForFunction(() => (globalThis as RanGlobal).__ran === 4);
  });
});

test("schedule: Save-Data skips scheduled prefetches", async () => {
  await withPage(files, async (page) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true, effectiveType: "4g" } }));
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(400);
    assert.deepEqual(await hinted(page), []);
  });
});

// Deps modules (`data-deps` builds: `<chunk>.deps.js` = the chunk's static import closure): a chunk hinted for an
// interaction (here on intent) brings its closure in one round trip; the imports are fetched, never evaluated alone,
// and nothing is requested before intent (scheduled chunks keep their own import order).
const depsPage = (deps: boolean): string => {
  const state = JSON.stringify({
    v: 1,
    rt: "/rt.js",
    c: ["/c/click.js", "/c/other.js"],
    s: {},
    t: [],
    e: { "7": { click: [0, [], [0]] }, "8": { click: [0, [], [1]] } },
    m: {},
    b: [],
    fx: [],
    ce: [],
  });
  return (
    '<!doctype html><html><head></head><body><button data-r="7" id="go">go</button><button data-r="8" id="other">other</button>' +
    `<script type="rivet/state" data-region="0" data-events="click"${deps ? " data-deps" : ""}>${state}</script>` +
    "<script>(" + loader + ")()</script></body></html>"
  );
};
const depsFiles = (deps: boolean): Record<string, string> => {
  const dep = "globalThis.__dep = (globalThis.__dep ?? 0) + 1; export default {};";
  return {
    ...files,
    "/": depsPage(deps),
    "/rt.js": "export default { start() {} };",
    "/rt.deps.js": 'export default ["/c/rtdep.js"];',
    "/c/rtdep.js": dep,
    "/c/click.js": "export default {};",
    "/c/click.deps.js": 'export default ["/c/dep.js", "/c/deep.js"];',
    "/c/dep.js": dep,
    "/c/deep.js": dep,
    "/c/other.js": "export default {};",
    "/c/other.deps.js": 'export default ["/c/dep.js"];',
  };
};

test("deps modules: an intent-hinted chunk and the runtime bring their static import closures; imports are not evaluated alone", async () => {
  await withPage(depsFiles(true), async (page) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(400);
    assert.ok(!requested.some((path) => path.includes(".deps.js")), requested.join());
    await page.hover("#go");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 5);
    assert.deepEqual((await hinted(page)).sort(), ["/c/click.js", "/c/deep.js", "/c/dep.js", "/c/rtdep.js", "/rt.js"]);
    // Interaction hints are urgent, and so are their imports.
    assert.ok(await page.$$eval('link[rel="modulepreload"]', (links) => (links as HTMLLinkElement[]).every((l) => l.fetchPriority !== "low")));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => (globalThis as { __dep?: number }).__dep), undefined);
  });
});

test("deps modules: once the runtime started, a hinted chunk requests none (the cold window only)", async () => {
  await withPage(depsFiles(true), async (page) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("http://rivet.test/");
    await page.hover("#go");
    await page.waitForFunction(() => !!(document as unknown as { $r?: { r(): unknown } }).$r?.r());
    await page.hover("#other");
    await page.waitForFunction(() => !!document.querySelector('link[rel="modulepreload"][href="/c/other.js"]'));
    await page.waitForTimeout(300);
    assert.ok(!requested.includes("/c/other.deps.js"), requested.join());
  });
});

test("deps modules: without data-deps (dev, older builds) none is requested", async () => {
  await withPage(depsFiles(false), async (page) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));
    await page.goto("http://rivet.test/");
    await page.hover("#go");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    await page.waitForTimeout(300);
    assert.deepEqual((await hinted(page)).sort(), ["/c/click.js", "/rt.js"]);
    assert.ok(!requested.some((path) => path.includes(".deps.js")), requested.join());
  });
});

test("fetch-only hints (`data-fo`, lazy router): the loader module adds them at low priority after load and the fonts, never evaluated", async () => {
  const state = JSON.stringify({ v: 1, rt: "/rt.js", c: ["/c/nav.js"], s: {}, t: [], e: {}, m: {}, b: [], fx: [], ce: [], n: [0] });
  const page =
    '<!doctype html><html><head></head><body><a href="/next">next</a>' +
    `<script type="rivet/state" data-region="0" data-events="click" data-ld="/ld.js" data-fo="/rt.js /c/nav.js">${state}</script>` +
    "<script>(" + loader + ")()</script><img src=\"/slow.png\"></body></html>";
  const ran = "globalThis.__ran = (globalThis.__ran ?? 0) + 1; export default {};";
  await withPage({ ...files, "/": page, "/rt.js": ran, "/c/nav.js": ran, "/slow.png": "" }, async (p) => {
    let loaded = false;
    p.on("load", () => (loaded = true));
    const early: string[] = [];
    p.on("request", (request) => !loaded && early.push(new URL(request.url()).pathname));
    await p.goto("http://rivet.test/");
    await p.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    assert.ok(!early.includes("/rt.js") && !early.includes("/c/nav.js"), early.join());
    assert.deepEqual((await hinted(p)).sort(), ["/c/nav.js", "/rt.js"]);
    assert.ok(await p.$$eval('link[rel="modulepreload"]', (links) => (links as HTMLLinkElement[]).every((l) => l.fetchPriority === "low")));
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => (globalThis as RanGlobal).__ran), undefined);
  }, { delays: { "/slow.png": 300 } });
});

test("fetch-only hints (`data-fo`): none under Save-Data or 2G", async () => {
  const state = JSON.stringify({ v: 1, rt: "/rt.js", c: ["/c/nav.js"], s: {}, t: [], e: {}, m: {}, b: [], fx: [], ce: [], n: [0] });
  const page =
    '<!doctype html><html><head></head><body><a href="/next">next</a>' +
    `<script type="rivet/state" data-region="0" data-events="click" data-ld="/ld.js" data-fo="/rt.js /c/nav.js">${state}</script>` +
    "<script>(" +
    loader +
    ")()</script></body></html>";
  for (const connection of [
    { saveData: true, effectiveType: "4g" },
    { saveData: false, effectiveType: "2g" },
  ])
    await withPage({ ...files, "/": page }, async (p) => {
      await p.addInitScript((value) => Object.defineProperty(navigator, "connection", { value }), connection);
      const requested: string[] = [];
      p.on("request", (request) => requested.push(new URL(request.url()).pathname));
      // The stub still loads the loader module at `load` (it schedules the hints); the module hints none.
      const ld = p.waitForResponse((response) => response.url().endsWith("/ld.js"));
      await p.goto("http://rivet.test/");
      await ld;
      await p.waitForTimeout(500);
      assert.deepEqual(await hinted(p), []);
      assert.ok(!requested.includes("/rt.js") && !requested.includes("/c/nav.js"), requested.join());
    });
});

test("fetch-only runtime (`data-fo`) hinted before a visible plan: the plan still evaluates it (first press after the preload runs synchronously)", async () => {
  // LOADER-DIET regression (cdk drag-drop "first drag after the visible preload"): the lazy router's fetch-only hints
  // mark the runtime URL hinted after `load`; a visible plan reaching the queue later skipped it (hinted), so the runtime
  // was fetched but never started.
  const preload = JSON.stringify(["/rt.js", ["/c/rows.js", "v", [5]]]).replace(/"/g, "&quot;");
  const state = JSON.stringify({ v: 1, rt: "/rt.js", c: ["/c/rows.js"], s: {}, t: [], e: {}, m: {}, b: [], fx: [], ce: [] });
  const page =
    '<!doctype html><html><head></head><body><p style="height:5000px">top</p><button data-r="5" id="far">far</button>' +
    `<script type="rivet/state" data-region="0" data-events="click" data-ld="/ld.js" data-fo="/rt.js" data-preload="${preload}">${state}</script>` +
    "<script>(" + loader + ")()</script></body></html>";
  await withPage(
    { ...files, "/": page, "/rt.js": "globalThis.__rt = (globalThis.__rt ?? 0) + 1; export default {};" },
    async (p) => {
      await p.goto("http://rivet.test/");
      // Fetch-only hint first (after load + fonts), not evaluated.
      await p.waitForFunction(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].some((l) => l.href.endsWith("/rt.js")));
      await p.waitForTimeout(200);
      assert.equal(await p.evaluate(() => (globalThis as { __rt?: number }).__rt), undefined);
      await p.evaluate(() => document.querySelector("#far")!.scrollIntoView());
      await p.waitForFunction(() => (globalThis as { __rt?: number }).__rt === 1, null, { timeout: 3000 });
    },
  );
});
