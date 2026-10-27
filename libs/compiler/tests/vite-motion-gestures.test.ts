// MOTION gestures on a cold resumed production page (CTX-SOUND lane, 2026-10-27): `<Motion.div whileHover>` /
// `whilePress` / `whileFocus` bind their handlers in the tag component's spread (`tags/<tag>.tsx` `m.bind`). The first hover /
// press / focus of a page that never ran must animate: Chromium + WebKit, mouse + touch (a held touch press; a real tap runs `onPress` once). A page without
// gestures stays at 0 JS before and after input.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHttp } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { chromium, webkit, type Browser } from "playwright";
import { hasDerivedModel } from "../index.ts";
import { rivet } from "../vite.ts";

const PAGES: Record<string, string> = {
  // Gestures only: the page has no state of its own.
  hover: `import { Motion } from "@rivetjs/motion";
export default function Page() {
  return <main><Motion.div id="box" class="box" whileHover={{ scale: 1.5 }} transition={{ duration: 0.05 }}>hover</Motion.div></main>;
}`,
  press: `import { Motion } from "@rivetjs/motion";
export default function Page() {
  return <main><Motion.button id="box" type="button" whilePress={{ scale: 0.5 }} transition={{ duration: 0.05 }}>press</Motion.button></main>;
}`,
  focus: `import { Motion } from "@rivetjs/motion";
export default function Page() {
  return <main><Motion.button id="box" type="button" whileFocus={{ scale: 1.5 }} transition={{ duration: 0.05 }}>focus</Motion.button></main>;
}`,
  // A press with a callback (a function prop: the element adopts with the page's record).
  tap: `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
export default function Page() {
  const n = signal(0);
  return <main><Motion.button id="box" type="button" whilePress={{ scale: 0.5 }} transition={{ duration: 0.3 }} onPress={() => n.set(n() + 1)}>tap</Motion.button><span id="n">{n()}</span></main>;
}`,
  // A gesture element inside a page with its own state (an interactive boundary around it).
  mixed: `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
export default function Page() {
  const n = signal(0);
  return <main><button id="inc" onClick={() => n.set(n() + 1)}>{n()}</button><Motion.div id="box" whileHover={{ scale: 1.5 }} transition={{ duration: 0.05 }}>hover</Motion.div></main>;
}`,
  // No gesture: plain markup, nothing to load.
  none: `import { Motion } from "@rivetjs/motion";
export default function Page() {
  return <main><Motion.div id="box" class="box" style={{ color: "red" }}>static</Motion.div></main>;
}`,
};
const SERVER = (page: string) => `import { createApp } from "@rivetjs/router/server";
import Page from "./${page}.tsx";
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {},
  page: () => () => Page({}),
  document: () => ({ start: "<!doctype html><html><body>", end: "</body></html>" }),
};
export const render = async (manifest) => (await createApp({ entry, manifest, csp: false })(new Request("http://x/"))).text();
`;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

async function buildPage(name: string, roots: string[]) {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-motion-gestures-" + name + "-"));
  roots.push(root);
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/" + name + ".tsx"), PAGES[name]!);
  await writeFile(resolve(root, "src/server.tsx"), SERVER(name));
  await writeFile(resolve(root, "src/app.tsx"), "export default function Root(props) {\n  return <div>{props.children}</div>;\n}\n");
  await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
  const page = "src/" + name + ".tsx";
  const plugin = () => rivet({ serverExports: { modules: [page] }, resume: { modules: [page, "src/app.tsx"], roots: ["src/app.tsx"] } });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "client-dist", manifest: true } });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
  const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8"));
  const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
  return { root, html: (await render(manifest)) as string };
}

type Input = "mouse" | "touch" | "keyboard";
/** Serve the page, run `act` cold, return [scale while acting, JS requests before the first input, JS requests total]. */
async function run(browser: Browser, built: { root: string; html: string }, input: Input, act: (page: import("playwright").Page) => Promise<string>) {
  const js: string[] = [];
  const http = createHttp(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    try {
      const body = path === "/" ? Buffer.from(built.html) : await readFile(resolve(built.root, "client-dist", "." + path));
      if (path.endsWith(".js")) js.push(path);
      res.setHeader("Content-Type", TYPES[extname(path)] ?? (path === "/" ? "text/html" : "application/octet-stream"));
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const context = await browser.newContext(input === "touch" ? { hasTouch: true, viewport: { width: 390, height: 700 } } : {});
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  try {
    await page.goto(`http://127.0.0.1:${(http.address() as { port: number }).port}/`, { waitUntil: "networkidle" });
    const before = js.length;
    const scale = await act(page);
    assert.deepEqual(errors, []);
    return [scale, before, js.length] as const;
  } finally {
    await context.close();
    http.close();
  }
}
const scaleOf = (page: import("playwright").Page) => page.evaluate(() => getComputedStyle(document.querySelector("#box")!).scale);
const settle = async (page: import("playwright").Page, want: string) => {
  await page.waitForFunction((w) => getComputedStyle(document.querySelector("#box")!).scale === w, want, { timeout: 4000 }).catch(() => {});
  return scaleOf(page);
};

(hasDerivedModel() ? test : test.skip)(
  "Motion gestures animate on the first hover / press / focus of a cold resumed page; no gestures, no JS",
  async () => {
    const roots: string[] = [];
    const engines: [string, Browser][] = [["chromium", await chromium.launch({ headless: true })]];
    if (existsSync(webkit.executablePath())) engines.push(["webkit", await webkit.launch({ headless: true })]);
    try {
      const built: Record<string, { root: string; html: string }> = {};
      for (const name of Object.keys(PAGES)) built[name] = await buildPage(name, roots);
      const results: Record<string, unknown> = {};
      for (const [engine, browser] of engines) {
        const hover = async (page: import("playwright").Page) => {
          const box = (await page.locator("#box").boundingBox())!;
          await page.mouse.move(box.x + 4, box.y + 4);
          await page.mouse.move(box.x + 8, box.y + 6);
          return settle(page, "1.5");
        };
        results[engine + " hover"] = await run(browser, built.hover!, "mouse", hover);
        results[engine + " mixed hover"] = await run(browser, built.mixed!, "mouse", hover);
        results[engine + " press mouse"] = await run(browser, built.press!, "mouse", async (page) => {
          const box = (await page.locator("#box").boundingBox())!;
          await page.mouse.move(box.x + 4, box.y + 4);
          await page.mouse.down();
          const held = await settle(page, "0.5");
          await page.mouse.up();
          return held;
        });
        results[engine + " press touch"] = await run(browser, built.press!, "touch", async (page) => {
          // A held touch press (a real tap's down and up land in one frame: no scale to sample).
          const at = async (type: string) =>
            page.locator("#box").evaluate((el, t) => {
              const r = el.getBoundingClientRect();
              const init = {
                bubbles: true,
                composed: true,
                pointerId: 7,
                pointerType: "touch",
                isPrimary: true,
                button: 0,
                buttons: t === "pointerdown" ? 1 : 0,
                clientX: r.x + 4,
                clientY: r.y + 4,
              };
              el.dispatchEvent(new PointerEvent(t, init));
            }, type);
          await at("pointerdown");
          const held = await settle(page, "0.5");
          await at("pointerup");
          return held;
        });
        results[engine + " tap touch"] = await run(browser, built.tap!, "touch", async (page) => {
          // A real tap: the press callback runs once.
          await page.locator("#box").tap();
          await page.waitForFunction(() => document.querySelector("#n")!.textContent === "1", undefined, { timeout: 4000 }).catch(() => {});
          return (await page.evaluate(() => document.querySelector("#n")!.textContent))!;
        });
        results[engine + " focus"] = await run(browser, built.focus!, "keyboard", async (page) => {
          await page.keyboard.press("Tab");
          return settle(page, "1.5");
        });
        results[engine + " none"] = await run(browser, built.none!, "mouse", async (page) => {
          const box = (await page.locator("#box").boundingBox())!;
          await page.mouse.move(box.x + 4, box.y + 4);
          await page.mouse.down();
          await page.mouse.up();
          await page.waitForTimeout(300);
          return scaleOf(page);
        });
      }
      const want: Record<string, unknown> = {};
      for (const [engine] of engines) {
        // Before input the loader only fetches ahead (modulepreload, nothing evaluates): the counts are reported.
        for (const [k, scale] of [
          ["hover", "1.5"],
          ["mixed hover", "1.5"],
          ["press mouse", "0.5"],
          ["press touch", "0.5"],
          ["tap touch", "1"],
          ["focus", "1.5"],
        ] as const)
          want[engine + " " + k] = [scale, ...(results[engine + " " + k] as number[]).slice(1)];
        want[engine + " none"] = ["none", 0, 0];
      }
      if (process.env.RIVET_GESTURE_LOG) process.stderr.write(JSON.stringify(results) + "\n");
      assert.deepEqual(results, want);
    } finally {
      for (const [, browser] of engines) await browser.close();
      if (!process.env.KEEP) for (const root of roots) await rm(root, { recursive: true, force: true });
    }
  },
  300_000,
);
