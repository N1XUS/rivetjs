import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { compile } from "@rivetjs/compiler";
import { createRouter } from "@rivetjs/runtime/router/server";
import type { ServerRouter } from "@rivetjs/runtime/router/server";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { withPage, rewrite } from "./resume/harness.ts";
import loaderModule from "../resume-loader-module.ts";
import type { Served } from "./resume/harness.ts";

/** What a resumable factory returns (as declared by server-resume). */
type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  App(): ServerValue;
  Counter(): ServerValue;
  Equality(): ServerValue;
  Intercept(): ServerValue;
  Shared(): ServerValue;
  Bubbling(): ServerValue;
  Regions(props: { items: string[]; router: ServerRouter }): ServerValue;
}
/** Browser globals the tests set or read. */
interface TestWindow {
  __kept?: boolean;
  __componentRuns?: unknown;
  report(entry: unknown): void;
}
/** Test module served at /unit.mjs (the specifier is a browser URL, not resolvable by tsc). */
interface UnitModule {
  run(): unknown;
}
/** Server-rendered list items get tagged with their original index. */
type TaggedItem = HTMLLIElement & { __server?: number };

const source = await readFile(new URL("./resume/fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom");
const server = await importServer<Fixture>(compileResume(source, "server").code);
// Component strategy: one chunk per component, importing module scope from the DOM module.
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js":
    'import { createResume } from "/dom-resume.ts"; import { Store } from "/fixture.mjs";' +
    ' export default createResume({ contexts: [[Store, { name: "client" }]] });',
  "/widget.mjs": rewrite(compile('export default function W() { return <i id="widget">ready</i>; }', { target: "dom", filename: "w.tsx" }).code),
  "/next": "<!doctype html><p id=next>next</p>",
  "/submitted": "<!doctype html><p id=submitted>submitted</p>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = {
  hash: "test",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const page = async (component: "App" | "Counter" | "Equality" | "Intercept" | "Shared" | "Bubbling"): Promise<string> =>
  "<!doctype html><html><head></head><body>" + (await resumableToString(() => server[component](), { manifest })) + "</body></html>";
files["/"] = await page("App");
files["/counter"] = await page("Counter");
files["/equality"] = await page("Equality");
files["/intercept"] = await page("Intercept");
files["/shared"] = await page("Shared");
files["/bubbling"] = await page("Bubbling");
files["/regions"] =
  "<!doctype html><html><head></head><body>" +
  (await resumableToString(() => server.Regions({ items: ["alpha", "beta", "gamma"], router: createRouter("http://rivet.test/regions") }), { manifest })) +
  "</body></html>";
const modules = (requests: string[]): string[] => requests.filter((path) => /\.(m?js)$/.test(path));

test("counter page: only the loader runs before interaction; intent prefetches; clicks resume", async () => {
  await withPage(files, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/counter");
    await page.waitForTimeout(300);
    assert.deepEqual(modules(requests), []);
    await page.hover("#inc");
    // Intent starts the runtime (Z1: so a lazy router's listeners attach before the click) and prefetches the
    // handler chunk; the chunk itself evaluates on pointerdown. The runtime is hinted like a chunk (its deps module, when
    // the build wrote them, brings its import closure).
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    assert.deepEqual(
      await page.$$eval('link[rel="modulepreload"]', (links) => links.map((link) => new URL((link as HTMLLinkElement).href).pathname)),
      ["/rt.js", "/c/Counter.js"],
    );
    await page.waitForFunction(() => !!(document as unknown as { $r?: { r(): unknown } }).$r?.r());
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#count")!.textContent === "1");
    assert.equal(await page.getAttribute("#inc", "class"), "on");
    // Loaded: the next click runs synchronously inside dispatch.
    assert.equal(await page.evaluate(() => (document.querySelector<HTMLElement>("#inc")!.click(), document.querySelector<HTMLElement>("#count")!.textContent)), "2");
    assert.equal(await page.evaluate(() => (globalThis as unknown as TestWindow).__componentRuns), undefined);
    // Loaded submit handler runs, then the native submit proceeds.
    await Promise.all([page.waitForURL(/\/submitted/), page.click("#send")]);
    assert.deepEqual(errors, []);
  });
});

test("route chunks fetch-ahead (manifest fetchAhead + preload.ahead): own chunks fetched at idle, 0 modules evaluated before the first event; the click resumes", async () => {
  // Each served module counts its evaluation; `data-fo` hints must fetch them without running any.
  const count = (body: Served | undefined): string => "globalThis.__ev = (globalThis.__ev ?? 0) + 1;" + (body as string);
  const ahead = await resumableToString(() => server.Counter(), { manifest: { ...manifest, loader: "/ld.js", fetchAhead: true } as ResumeManifest, preload: { ahead: true } });
  assert.match(ahead, /data-fo="\/rt\.js \/c\/Counter\.js"/);
  const served: Record<string, Served> = {
    ...files,
    "/ld.js": "export default " + loaderModule,
    "/rt.js": count(files["/rt.js"]),
    "/c/Counter.js": count(files["/c/Counter.js"]),
    "/fixture.mjs": count(files["/fixture.mjs"]),
    "/ahead": "<!doctype html><html><head></head><body>" + ahead + "</body></html>",
  };
  await withPage(served, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/ahead");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 2);
    await page.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/c/Counter.js") && (entry as PerformanceResourceTiming).responseEnd > 0));
    await page.waitForTimeout(300);
    assert.ok(requests.includes("/rt.js") && requests.includes("/c/Counter.js"), requests.join());
    assert.equal(await page.evaluate(() => (globalThis as { __ev?: number }).__ev), undefined);
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#count")!.textContent === "1");
    assert.deepEqual(errors, []);
  });
});

test("resumed signals and computeds keep their equals comparators", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/equality");
    // A failed resume reloads the page; the marker proves this document stayed.
    await page.evaluate(() => ((window as unknown as TestWindow).__kept = true));
    const read = () => page.evaluate(() => ["#n", "#bucket", "#ticks"].map((s) => document.querySelector(s)!.textContent));
    // Same id: the comparator says equal, nothing re-renders.
    await page.click("#same");
    await page.waitForTimeout(100);
    assert.deepEqual(await read(), ["0", "0", "0"]);
    await page.click("#next");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#n")!.textContent === "25");
    assert.deepEqual(await read(), ["25", "2", "0"]);
    // equals: false — an identical write still notifies.
    await page.click("#tick");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#ticks")!.textContent === "1");
    assert.equal(await page.evaluate(() => (window as unknown as TestWindow).__kept), true);
    assert.deepEqual(errors, []);
  });
});

test("a const derived through a function shares its signals between handlers and bindings", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/shared");
    await page.click("#shared");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#shared-n")!.textContent === "6");
    await page.click("#shared");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#shared-n")!.textContent === "7");
    assert.equal(await page.textContent("#shared-changes"), "2");
    assert.equal(await page.evaluate(() => (globalThis as unknown as TestWindow).__componentRuns), undefined);
    assert.deepEqual(errors, []);
  });
});

test("resumed handlers bubble: nested handlers of one type run innermost first; stopPropagation stops; non-bubbling events stay on their target", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/bubbling");
    await page.hover("#bubble-inner b");
    await page.click("#bubble-inner b");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#bubble-log")!.textContent!.endsWith("main"));
    await page.click("#bubble-stop");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#bubble-log")!.textContent!.endsWith("stop"));
    await page.click("#bubble-inner");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#bubble-log")!.textContent!.split(" ").length === 8);
    assert.equal(await page.textContent("#bubble-log"), "main-enter button div main stop button div main");
    assert.deepEqual(errors, []);
  });
});

test("cold submit is cancelled, handled, then replayed", async () => {
  await withPage(files, async (page) => {
    const seen: unknown[] = [];
    await page.exposeFunction("report", (entry: unknown) => seen.push(entry));
    await page.goto("http://rivet.test/counter");
    await page.evaluate(() => {
      window.addEventListener("submit", (event) =>
        (window as unknown as TestWindow).report([event.defaultPrevented, document.querySelector<HTMLElement>("#count")!.textContent]),
      );
    });
    await Promise.all([page.waitForURL(/\/submitted/), page.evaluate(() => document.querySelector<HTMLFormElement>("#form")!.requestSubmit())]);
    // First submit: cancelled by the loader before the handler loaded. Replay: handler already ran.
    assert.deepEqual(seen, [[true, "0"], [false, "100"]]);
  });
});

test("app page: model, computed text, client effect, client events, window: JSX, link replay", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    // Effects/client events boot the runtime at idle; the ref-bound effect waits for visibility.
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#canvas")!.dataset.drawn === "0");
    await page.fill("#filter", "al");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#matches")!.textContent === "1");
    await page.fill("#filter", "a");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#matches")!.textContent === "3");
    await page.setViewportSize({ width: 500, height: 400 });
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#size")!.textContent === "1");
    await page.keyboard.press("k");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#keys")!.textContent === "k");
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#canvas")!.dataset.drawn === "1");
    await page.click("#stay");
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).pathname, "/");
    await Promise.all([page.waitForURL("**/next"), page.click("#link")]);
    assert.deepEqual(errors, []);
  });
});

test("cold link click: default cancelled, handler runs, navigation replayed", async () => {
  await withPage(files, async (page) => {
    const seen: unknown[] = [];
    await page.exposeFunction("report", (entry: unknown) => seen.push(entry));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => {
      document.addEventListener("click", (event) => (window as unknown as TestWindow).report(["click", event.defaultPrevented]));
      window.addEventListener("pagehide", () => sessionStorage.setItem("leave", document.querySelector<HTMLElement>("#count")!.textContent));
    });
    await Promise.all([page.waitForURL("**/next"), page.evaluate(() => document.querySelector<HTMLElement>("#link")!.click())]);
    // The held click is replayed as a click (Z1: a listener loaded meanwhile, e.g. the router, may route it);
    // nothing cancels the replay, so the link navigates.
    assert.deepEqual(seen, [
      ["click", true],
      ["click", false],
    ]);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("leave")), "10");
  });
});

test("resumed document click listener, handler chunk still loading: link default held, handler decides", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [], documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
    // The handler chunk answers only when released: the runtime is up, its listener attached, the code not yet in.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route("http://rivet.test/c/Intercept.js", async (route) => {
      await released;
      await route.fallback();
    });
    await page.goto("http://rivet.test/intercept");
    await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
    await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    await page.click("#routed-link");
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).pathname, "/intercept");
    release();
    // The handler cancels the link: no document load.
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#routed")!.textContent === "/never");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#clicks")!.textContent === "1");
    await page.waitForTimeout(50);
    assert.equal(new URL(page.url()).pathname, "/intercept");
    // A link the handler leaves alone still navigates.
    await Promise.all([page.waitForURL("**/next"), page.click("#plain-link")]);
    assert.deepEqual(documents, ["/intercept", "/next"]);
    assert.deepEqual(errors, []);
  });
});

test("resumed document submit listener, handler chunk still loading: submit held, handler decides, native resubmit keeps the submitter", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [], documents: string[] = [], seen: unknown[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
    await page.exposeFunction("report", (entry: unknown) => seen.push(entry));
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route("http://rivet.test/c/Intercept.js", async (route) => {
      await released;
      await route.fallback();
    });
    await page.goto("http://rivet.test/intercept");
    await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
    await page.evaluate(() => new Promise((done) => requestIdleCallback(() => setTimeout(done, 50))));
    // A form targeting another browsing context is not held: the frame loads while the chunk is still out.
    await Promise.all([page.waitForRequest((request) => new URL(request.url()).pathname === "/next"), page.click("#side-send")]);
    // Both cold submits are held until the chunk is in.
    await page.click("#routed-send");
    await page.click("#plain-send");
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).pathname, "/intercept");
    assert.deepEqual(documents, ["/intercept", "/next"]);
    const posted = page.waitForRequest((request) => new URL(request.url()).pathname === "/submitted");
    release();
    // The handler cancels #routed-form; #plain-form, left alone, resubmits natively with its submitter.
    const request = await posted;
    await page.waitForURL("**/submitted");
    assert.equal(request.method(), "POST");
    assert.equal(request.postData(), "q=x&b=v");
    assert.deepEqual(documents, ["/intercept", "/next", "/submitted"]);
    assert.deepEqual(seen.map((entry) => (entry as string[])[1]).sort(), ["plain-form", "routed-form", "side-form"]);
    assert.deepEqual(errors, []);
  });
});

test("failed chunk load reloads the page", async () => {
  await withPage(
    files,
    async (page) => {
      await page.goto("http://rivet.test/counter");
      await page.evaluate(() => sessionStorage.setItem("loaded", "1"));
      await Promise.all([page.waitForEvent("load"), page.click("#inc")]);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("loaded")), "1");
      assert.equal(await page.textContent("#count"), "0");
    },
    { offline: new Set(["/c/Counter.js"]) },
  );
});

// Counts loads, resume errors and dynamic chunk requests (full URLs) across reloads.
const counting = () => {
  const n = Number(sessionStorage.getItem("loads") ?? 0) + 1;
  sessionStorage.setItem("loads", String(n));
  document.addEventListener("rivet:resume-error", () => sessionStorage.setItem("errors", String(Number(sessionStorage.getItem("errors") ?? 0) + 1)));
};
const counts = (page: import("playwright").Page) =>
  page.evaluate(() => [Number(sessionStorage.getItem("loads")), Number(sessionStorage.getItem("errors") ?? 0)]);

test("chunk that 404s: one cache-busted retry per page, at most one reload, no loop", async () => {
  const broken = { ...files };
  delete broken["/c/Counter.js"];
  await withPage(broken, async (page) => {
    const chunk: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/c/Counter.js") chunk.push(url.search);
    });
    await page.addInitScript(counting);
    await page.goto("http://rivet.test/counter");
    await Promise.all([page.waitForEvent("load"), page.click("#inc")]);
    // pointerdown (evaluate) and click both report the failure; the first one reloads.
    const [loads, errors] = await counts(page);
    assert.equal(loads, 2);
    // The retry bypasses the failed module record (and any cached failure) with a query.
    assert.deepEqual(chunk.filter((search) => search).map((search) => /^\?r=\d+$/.test(search)), [true]);
    // Within 10 s of the reload: the event fires, the page stays.
    await page.click("#inc");
    await page.waitForFunction((before) => Number(sessionStorage.getItem("errors")) > before, errors);
    await page.waitForTimeout(500);
    assert.equal((await counts(page))[0], 2);
    assert.equal(chunk.filter((search) => search).length, 2);
    assert.equal(await page.textContent("#count"), "0");
  });
});

test("without sessionStorage a failed chunk reloads only a page that was not itself reloaded", async () => {
  const broken = { ...files };
  delete broken["/c/Counter.js"];
  await withPage(broken, async (page) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "sessionStorage", { get: () => { throw new DOMException("blocked", "SecurityError"); } });
      document.addEventListener("rivet:resume-error", () => document.documentElement.setAttribute("data-errors", String(Number(document.documentElement.dataset.errors ?? 0) + 1)));
    });
    let loads = 0;
    page.on("load", () => loads++);
    await page.goto("http://rivet.test/counter");
    await Promise.all([page.waitForEvent("load"), page.click("#inc")]);
    assert.equal(await page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type), "reload");
    await page.click("#inc");
    await page.waitForFunction(() => Number(document.documentElement.dataset.errors) > 0);
    await page.waitForTimeout(500);
    assert.equal(loads, 2);
  });
});

test("transient chunk failure: the cache-busted retry loads it, the handler runs, no reload", async () => {
  await withPage(files, async (page) => {
    let failed = 0;
    await page.route("http://rivet.test/c/Counter.js", (route) => (failed++ ? route.fallback() : route.abort("connectionreset")));
    await page.addInitScript(counting);
    await page.goto("http://rivet.test/counter");
    await page.click("#inc");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#count")!.textContent === "1");
    assert.ok(failed >= 1);
    assert.deepEqual(await counts(page), [1, 0]);
  });
});

test("regions: structural child, For, client-only mount and router navigation resume", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/regions");
    // Client-only mount boots the runtime at its trigger and swaps the fallback.
    await page.waitForFunction(() => document.querySelector("#widget")?.textContent === "ready");
    assert.equal(await page.evaluate(() => (globalThis as unknown as TestWindow).__componentRuns), undefined);
    assert.equal(await page.textContent("#route"), "home");
    // A server-rendered For row handler resumes with its constant item capture; the row's own
    // attribute binding resumes inside its row region.
    await page.evaluate(() => document.querySelectorAll<TaggedItem>("#list li").forEach((li, i) => (li.__server = i)));
    await page.click(".pick >> nth=0");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#picked")!.textContent === "alpha");
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".pick")!.className === "pick on");
    // Structural region: re-created in the browser on first change, then CSR.
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#panel b")?.textContent === "opened");
    await page.click("#close");
    await page.waitForFunction(() => document.querySelector("#closed"));
    // For region filters after the model writes the shared signal; the browser For adopts the server
    // rows (same nodes, resumed bindings intact) instead of re-creating them.
    await page.fill("#q", "a");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#q")!.value === "a");
    await page.fill("#q", "be");
    await page.waitForFunction(() => document.querySelectorAll("#list li").length === 1);
    assert.equal(await page.evaluate(() => document.querySelector<TaggedItem>("#list li")!.__server), 1);
    await page.click(".pick");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#picked")!.textContent === "beta");
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".pick")!.className === "pick on");
    // Rows the list brings back are created by the browser For.
    await page.fill("#q", "");
    await page.waitForFunction(() => document.querySelectorAll("#list li").length === 3);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll<TaggedItem>("#list li")].map((li) => li.__server ?? null)), [null, 1, null]);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".pick")].map((b) => b.className)), ["pick", "pick on", "pick"]);
    // Router: the location signal is shared; navigation re-creates the route region with client context.
    await page.click("#go");
    await page.waitForFunction(() => document.querySelector("#route")?.textContent === "client:7");
    assert.equal(new URL(page.url()).pathname, "/regions/7");
    await page.goBack();
    await page.waitForFunction(() => document.querySelector("#route")?.textContent === "home");
    assert.deepEqual(errors, []);
  });
});

test("speculative resume: at idle the keyed list adopts its server rows in place before any interaction", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/regions");
    await page.evaluate(() => document.querySelectorAll<TaggedItem>("#list li").forEach((li, i) => (li.__server = i)));
    // The runtime boots for the client-only mount; at idle it activates the list region (its query
    // signal is captured by the #q model): its DOM v2 list adopts the same server rows (their markers stay as row anchors).
    await page.waitForFunction(() => document.querySelector("#widget")?.textContent === "ready");
    for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise((done) => requestIdleCallback(() => done(null))));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll<TaggedItem>("#list li")].map((li) => li.__server)), [0, 1, 2]);
    // No binding re-created the panel region (not adoptable): its server node is still there.
    assert.equal(await page.evaluate(() => !!document.querySelector("#closed")), true);
    await page.fill("#q", "be");
    await page.waitForFunction(() => document.querySelectorAll("#list li").length === 1);
    assert.equal(await page.evaluate(() => document.querySelector<TaggedItem>("#list li")!.__server), 1);
    await page.click(".pick");
    await page.waitForFunction(() => document.querySelector<HTMLElement>("#picked")!.textContent === "beta");
    assert.deepEqual(errors, []);
  });
});

test("lazyComponent renders synchronously once warmed", async () => {
  const unit = `
    import { createRoot } from "/reactivity.mjs";
    import { lazyComponent, mount, _warmLazy } from "/dom.ts";
    const early = lazyComponent(() => import("/lazy-a.mjs"), undefined, { fallback: () => "wait" });
    export async function run() {
      const queued = [];
      _warmLazy((fn) => queued.push(fn));
      const late = lazyComponent(() => import("/lazy-a.mjs"), undefined, { fallback: () => "wait" });
      const before = document.createElement("div");
      mount(() => early({}), before);
      const cold = before.textContent;
      await Promise.all(queued.map((fn) => fn()));
      await new Promise((r) => setTimeout(r, 0));
      const host = document.createElement("div");
      mount(() => [early({}), late({})], host);
      return { cold, warmed: queued.length, sync: host.textContent };
    }`;
  await withPage({ "/unit.mjs": unit, "/lazy-a.mjs": "export default () => 'A';", "/": "<!doctype html><body></body>" }, async (page) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(await page.evaluate(async () => ((await import("/unit.mjs" as string)) as UnitModule).run()), { cold: "wait", warmed: 2, sync: "AA" });
  });
});
