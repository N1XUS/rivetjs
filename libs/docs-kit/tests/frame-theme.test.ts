// Docs page ↔ example frames (`frame-theme.ts`): a docs page embeds an example frame page. The docs serve frames
// from their own origin; the bridges are origin-agnostic, so this runs them across two origins (two local ports), the
// stricter case. Theme: the frame starts from the system preference / its last answer, takes the parent's theme,
// follows every `data-theme` change live and keeps it across a re-render of its `<html>` attributes. Height: an
// auto-height iframe follows its page's in-flow content height (grow / shrink, clamped, overlays not counted); static
// iframes, other senders and malformed messages are ignored. JS meter: a metered frame (`data-src`) loads after the
// page's load event and reports the JS files it fetched; the page shows them and keeps them across a text reset.
// Run: `npx vitest run --project docs-kit libs/docs-kit/tests/frame-theme.test.ts`.
import { strict as assert } from "node:assert";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type Frame, type Page } from "playwright";
import {
  FRAME_HEIGHT,
  FRAME_HEIGHT_MAX,
  FRAME_HEIGHT_MIN,
  FRAME_JS_METER,
  FRAME_THEME,
  frameIdOf,
  framePath,
  frameUpdate,
  pagePreload,
  PARENT_FRAME_HEIGHT,
  PARENT_FRAME_JS_METER,
  PARENT_THEME_BRIDGE,
  pathIn,
} from "../frame-theme.ts";
import { frameDevEntry } from "../vite.ts";
import { generate } from "../../router/build/codegen.ts";
import { routeTable } from "../../router/build/routes.ts";

let browser: Browser;
let docs: Server;
let examples: Server;
let examplesOrigin = "";
let docsOrigin = "";

const listen = (html: (url: URL) => string) =>
  new Promise<Server>((done) => {
    const server = createServer((request, response) => {
      if (request.url?.endsWith(".js"))
        return void response.writeHead(200, { "content-type": "text/javascript" }).end(`window.loaded = (window.loaded || 0) + 1; // ${"x".repeat(2000)}`);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html(new URL(request.url ?? "/", "http://localhost")));
    });
    server.listen(0, "127.0.0.1", () => done(server));
  });
const origin = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  const frameScript = `<script>${FRAME_THEME};${FRAME_HEIGHT}</script>`;
  examples = await listen((url) =>
    url.pathname === "/h/"
      ? // An example page as the docs render it: the in-flow root, body padding, and overlays outside the root.
        `<!doctype html><html lang="en"><head>${frameScript}</head><body style="margin:0;padding:0 0 10px">` +
        `<div data-rivet-frame=""><div id="content" style="height:100px"></div></div>` +
        `<div style="position:absolute;top:0;left:0;width:10px;height:3000px"></div><div id="layer"></div></body></html>`
      : url.pathname === "/m/"
        ? // A metered example: its button loads two modules (as a resumed page's first press does).
          `<!doctype html><html lang="en"><head><script>${FRAME_THEME};${FRAME_HEIGHT};${FRAME_JS_METER}</script></head><body>` +
          `<button id="go" onclick="for(const f of ['a','b'])document.head.append(Object.assign(document.createElement('script'),{type:'module',src:'/m/'+f+'.js'}))">go</button></body></html>`
        : url.pathname === "/v/"
          ? // A viewport-tall layout wrapper (`min-h-dvh flex items-center p-3`), as the ui-docs examples have.
            `<!doctype html><html lang="en"><head>${frameScript}</head><body style="margin:0"><div data-rivet-frame="">` +
            `<div style="min-height:100dvh;display:flex;align-items:center;padding:12px;box-sizing:border-box"><div id="content" style="height:100px;width:10px"></div></div></div></body></html>`
          : `<!doctype html><html lang="en"><head>${frameScript}</head><body><p>example</p></body></html>`,
  );
  examplesOrigin = origin(examples);
  docs = await listen((url) =>
    url.pathname === "/meter/"
      ? `<!doctype html><html lang="en" data-theme="light"><head><script>${PARENT_THEME_BRIDGE};${PARENT_FRAME_HEIGHT};${PARENT_FRAME_JS_METER}</script></head><body>` +
        `<iframe id="metered" data-js-meter="out" data-src="${examplesOrigin}/m/"></iframe><iframe id="other" src="${examplesOrigin}/m/?other"></iframe>` +
        `<p id="out">JS loaded: 0 B · 0 files</p><p id="out2">untouched</p></body></html>`
      : url.pathname === "/auto/"
        ? `<!doctype html><html lang="en" data-theme="light"><head><script>${PARENT_THEME_BRIDGE};${PARENT_FRAME_HEIGHT}</script></head><body>` +
          `<iframe id="auto" data-auto-height="" height="180" style="border:0" src="${examplesOrigin}/${url.searchParams.get("page") ?? "h"}/"></iframe><iframe id="static" height="180" style="border:0" src="${examplesOrigin}/h/?static"></iframe></body></html>`
        : `<!doctype html><html lang="en" data-theme="${url.searchParams.get("theme") ?? "light"}"><head><script>${PARENT_THEME_BRIDGE};${PARENT_FRAME_HEIGHT}</script></head>` +
          `<body><iframe src="${examplesOrigin}/x/"></iframe></body></html>`,
  );
  docsOrigin = origin(docs);
});
afterAll(async () => {
  await browser?.close();
  docs?.close();
  examples?.close();
});

const frameTheme = (frame: Frame) => frame.evaluate(() => `${document.documentElement.dataset.theme ?? ""} ${document.documentElement.className}`.trim());
async function open(page: Page, theme: string): Promise<Frame> {
  await page.goto(`${docsOrigin}/?theme=${theme}`);
  const frame = page.frames().find((f) => f.url().startsWith(examplesOrigin))!;
  await frame.waitForLoadState();
  return frame;
}
const waitTheme = async (frame: Frame, expected: string) => {
  for (let i = 0; i < 50 && (await frameTheme(frame)) !== expected; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(await frameTheme(frame), expected);
};

test("a framed example takes the docs theme and follows changes", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await open(page, "dark");
  await waitTheme(frame, "dark dark");
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await waitTheme(frame, "light light");
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await waitTheme(frame, "dark dark");
  await context.close();
});

test("every theme change reaches the frame, and a re-render of its <html> attributes keeps the parent's word", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await open(page, "light");
  await waitTheme(frame, "light light");
  for (const theme of ["dark", "light", "dark", "light", "dark"]) {
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    await waitTheme(frame, `${theme} ${theme}`);
  }
  // A dev client render / an example head resetting the frame's <html> attributes: the word is re-applied.
  await frame.evaluate(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });
  await waitTheme(frame, "dark dark");
  await frame.evaluate(() => (document.documentElement.className = "light other"));
  await waitTheme(frame, "dark other dark");
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await waitTheme(frame, "light other light");
  await context.close();
});

test("the frame starts from the last theme its origin saw, else the system preference", async () => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  // Before any answer: system preference (dark here).
  await page.goto(`${examplesOrigin}/x/`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme ?? null), null, "not framed: no-op");
  const frame = await open(page, "light");
  await waitTheme(frame, "light light");
  // A new frame of the same origin paints with the remembered answer before asking.
  const remembered = await frame.evaluate(() => localStorage.getItem("rivet-docs-theme"));
  assert.equal(remembered, "light");
  await context.close();
});

test("only the parent's message is taken, and only light / dark", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await open(page, "light");
  await waitTheme(frame, "light light");
  // A message from the frame itself (not its parent) and an unknown value are ignored.
  await frame.evaluate(() => {
    window.postMessage({ rivetDocsTheme: "dark" }, "*");
    parent.postMessage("noise", "*");
  });
  await page.evaluate(() => {
    for (const f of document.querySelectorAll("iframe")) f.contentWindow!.postMessage({ rivetDocsTheme: "ocean" }, "*");
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(await frameTheme(frame), "light light");
  await context.close();
});

async function openAuto(page: Page, path = "h"): Promise<Frame> {
  await page.goto(`${docsOrigin}/auto/?page=${path}`);
  const frame = page.frames().find((f) => f.url() === `${examplesOrigin}/${path}/`)!;
  await frame.waitForLoadState();
  return frame;
}
const heights = (page: Page) => page.evaluate(() => ["auto", "static"].map((id) => document.getElementById(id)!.getBoundingClientRect().height));
const waitHeight = async (page: Page, expected: number) => {
  for (let i = 0; i < 50 && (await heights(page))[0] !== expected; i++) await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(await heights(page), [expected, 180]);
};
const setContent = (frame: Frame, px: number) => frame.evaluate((px) => (document.getElementById("content")!.style.height = px + "px"), px);

test("an auto-height frame follows its content (grow, shrink, clamp); a static one keeps its height", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await openAuto(page);
  // 100px root + 10px body padding; the absolutely positioned 3000px block outside the root is not counted.
  await waitHeight(page, 110);
  await setContent(frame, 300);
  await waitHeight(page, 310);
  await setContent(frame, 150);
  await waitHeight(page, 160);
  await setContent(frame, 5);
  await waitHeight(page, FRAME_HEIGHT_MIN);
  await setContent(frame, 5000);
  await waitHeight(page, FRAME_HEIGHT_MAX);
  // Content added to the root (DOM change, no style change on an observed element) is measured too.
  await setContent(frame, 100);
  await frame.evaluate(() => document.querySelector("[data-rivet-frame]")!.append(Object.assign(document.createElement("div"), { style: "height:50px" })));
  await waitHeight(page, 160);
  await context.close();
});

test("a viewport-tall layout wrapper (min-h-dvh) grows and shrinks with its content", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await openAuto(page, "v");
  await waitHeight(page, 124);
  await setContent(frame, 300);
  await waitHeight(page, 324);
  await setContent(frame, 50);
  await waitHeight(page, 74);
  // The wrapper keeps its own min-height (restored after each measure).
  assert.equal(await frame.evaluate(() => (document.querySelector("[data-rivet-frame] > div") as HTMLElement).style.minHeight), "100dvh");
  await context.close();
});

test("overlays (outside the root, fixed / absolute) never grow an auto-height frame", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await openAuto(page);
  await waitHeight(page, 110);
  await frame.evaluate(() => {
    const layer = document.getElementById("layer")!;
    layer.innerHTML =
      '<div style="position:fixed;inset:0"><div style="height:2000px">modal</div></div><div style="position:absolute;top:90px;height:800px">popover</div>';
    document.querySelector("[data-rivet-frame]")!.append(Object.assign(document.createElement("div"), { style: "position:absolute;top:0;height:900px" }));
  });
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(await heights(page), [110, 180]);
  await context.close();
});

test("heights from other senders and malformed messages are ignored", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const frame = await openAuto(page);
  await waitHeight(page, 110);
  // The docs page itself (not a frame), the static frame, and malformed values.
  await page.evaluate(() => postMessage({ rivetDocsFrameHeight: 500 }, "*"));
  const other = page.frames().find((f) => f.url() === `${examplesOrigin}/h/?static`)!;
  await other.evaluate(() => parent.postMessage({ rivetDocsFrameHeight: 700 }, "*"));
  await frame.evaluate(() => {
    for (const value of ["500", -1, NaN, null]) parent.postMessage({ rivetDocsFrameHeight: value }, "*");
    parent.postMessage(null, "*");
    parent.postMessage("noise", "*");
  });
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(await heights(page), [110, 180]);
  await context.close();
});

test("framePath / frameIdOf: frame pages of the docs app", () => {
  assert.equal(framePath("counter"), "/examples/counter/frame/");
  assert.equal(frameIdOf("/examples/counter/frame/"), "counter");
  assert.equal(frameIdOf("/examples/menu-links/frame/help/"), "menu-links");
  assert.equal(frameIdOf("/examples/counter/frame"), "counter");
  for (const path of ["/examples/counter/", "/examples/", "/components/frame/", "/examples/counter/framed/"]) assert.equal(frameIdOf(path), undefined, path);
});

test("pagePreload: lean pages load nothing before interaction, others keep the default", () => {
  const preload = pagePreload(["/"]);
  assert.equal(preload.lean(new URL("http://docs.test/")), true);
  for (const path of ["/themes/", "/examples/counter/frame/"]) assert.equal(preload.lean(new URL("http://docs.test" + path)), undefined, path);
});

test("frameUpdate: dev hot updates a frame takes (its example graph), not the docs app's", () => {
  for (const path of [
    "/apps/cdk-docs/examples/listbox-sections/src/routes/index.tsx",
    "/apps/cdk-docs/src/generated/example-frames/listbox-sections.tsx",
    "/apps/cdk-docs/src/generated/example-css/0123456789.css",
    "/libs/cdk/listbox/index.tsx",
    "/libs/docs-kit/components/frame.tsx",
    "/libs/docs-kit/components/frame-dev-mount.tsx",
    "/libs/docs-kit/frame-theme.ts",
    "/node_modules/.vite/deps/lucide.js",
  ])
    assert.equal(frameUpdate(path), true, path);
  for (const path of [
    "/apps/cdk-docs/src/generated/nav.ts",
    "/apps/cdk-docs/src/routes/(docs)/components/listbox.tsx",
    "/apps/cdk-docs/.rivet/app.tsx",
    "/libs/docs-kit/components/site-frame.tsx",
    "/libs/docs-kit/components/side-nav.tsx",
  ])
    assert.equal(frameUpdate(path), false, path);
});

test("frameDevEntry: the router's generated dev entry gets the frame mounter + update filter", () => {
  const code = generate(routeTable(["_layout.tsx", "index.tsx"]), { routesDir: "src/routes" }).files["entry.dev.tsx"]!;
  const out = frameDevEntry(code, (message) => {
    throw new Error(message);
  });
  assert.match(out, /import\("@rivetjs\/docs-kit\/components\/frame-dev-mount\.tsx"\)/);
  assert.match(out, /\(!_frame \|\| _frameUpdate\(update\.path\)\) && /);
  assert.match(out, /resumed && !_frame && location\.reload\(\)/);
  assert.throws(
    () =>
      frameDevEntry("export {};", (message) => {
        throw new Error(message);
      }),
    /unexpected \.rivet\/entry\.dev\.tsx shape/,
  );
});

test("JS meter: a metered frame loads after the page's load event, reports 0 files, then the files its first press fetched", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${docsOrigin}/meter/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#metered")?.getAttribute("src"));
  assert.equal(await page.locator("#metered").getAttribute("data-src"), null);
  const order = await page.evaluate(() => {
    const load = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).loadEventEnd;
    const frame = performance.getEntriesByType("resource").find((e) => e.name.endsWith("/m/"))!;
    const paint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    return { load, paint, start: frame.startTime };
  });
  assert.ok(order.start >= order.load && order.start >= order.paint, `frame requested after load and first paint (${JSON.stringify(order)})`);
  const frame = page.frames().find((f) => f.url() === `${examplesOrigin}/m/`)!;
  await frame.waitForLoadState();
  assert.equal(await page.locator("#out").textContent(), "JS loaded: 0 B · 0 files");
  await frame.click("#go");
  await frame.waitForFunction(() => (window as unknown as { loaded?: number }).loaded === 2);
  const bytes = await frame.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.name.endsWith(".js"))
      .reduce((sum, e) => sum + (e as PerformanceResourceTiming).transferSize, 0),
  );
  assert.ok(bytes > 4000, "two ~2 KB modules + headers");
  const expected = `JS loaded: ${(bytes / 1024).toFixed(1)} KB · 2 files`;
  await page.waitForFunction((text) => document.querySelector("#out")?.textContent === text, expected);
  // A resume adopt run restoring the server text: the numbers come back.
  await page.evaluate(() => (document.querySelector("#out")!.textContent = "JS loaded: 0 B · 0 files"));
  await page.waitForFunction((text) => document.querySelector("#out")?.textContent === text, expected);
  // An iframe without data-js-meter and a message from the page itself change nothing.
  const other = page.frames().find((f) => f.url().endsWith("/m/?other"))!;
  await other.click("#go");
  await page.evaluate(() => postMessage({ rivetDocsFrameJs: { files: 9, bytes: 9, cached: 0 } }, "*"));
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#out").textContent(), expected);
  assert.equal(await page.locator("#out2").textContent(), "untouched");
  await context.close();
});

test("pathIn / pagePreload: trailing slashes ignored (prerender renders /a/b, the server /a/b/)", () => {
  assert.ok(pathIn("/examples/x/frame", ["/examples/x/frame/"]));
  assert.ok(pathIn("/examples/x/frame/", ["/examples/x/frame"]));
  assert.ok(pathIn("/", ["/"]));
  assert.ok(!pathIn("/a", ["/"]));
  assert.ok(!pathIn("/examples/x", ["/examples/x/frame/"]));
  const lean = pagePreload(["/", "/examples/x/frame/"]).lean;
  assert.equal(lean(new URL("http://h/examples/x/frame")), true);
  assert.equal(lean(new URL("http://h/other/")), undefined);
});
