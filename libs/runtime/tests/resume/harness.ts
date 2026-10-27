// Serve runtime sources plus test modules to Chromium under http://rivet.test/ without a bundler.
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createServer } from "node:http";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { DERIVED_SWITCHES, switchContent } from "../../../compiler/switches.ts";

const runtime = new URL("../../", import.meta.url);
const sources: Record<string, string> = {
  "/dom.ts": "dom.ts",
  "/dom-v2.ts": "dom-v2.ts",
  "/dom-v2-spread.ts": "dom-v2-spread.ts",
  "/dom-v2-controls.ts": "dom-v2-controls.ts",
  "/dom-svg.ts": "dom-svg.ts",
  "/dom-adopt.ts": "dom-adopt.ts",
  "/dom-adopt-run.ts": "dom-adopt-run.ts",
  "/lazy.ts": "lazy.ts",
  "/url.ts": "url.ts",
  "/dom-base.ts": "dom-base.ts",
  "/dom-attr.ts": "dom-attr.ts",
  "/dom-events.ts": "dom-events.ts",
  "/style.ts": "style.ts",
  "/slot.ts": "slot.ts",
  "/props.ts": "props.ts",
  "/dom-router.ts": "dom-router.ts",
  "/dom-suspense.ts": "dom-suspense.ts",
  "/async-coordinator.ts": "async-coordinator.ts",
  "/dom-resource.ts": "dom-resource.ts",
  "/resource.ts": "resource.ts",
  "/router.ts": "router.ts",
  "/resume-format.ts": "resume-format.ts",
  "/resume-kinds.ts": "resume-kinds.ts",
  "/resume-tail.ts": "resume-tail.ts",
  "/resume-builtins.ts": "resume-builtins.ts",
  "/id.ts": "id.ts",
  "/id-dom.ts": "id-dom.ts",
  // Build-time switches (served as written: `false`; `DERIVED_BUILD` / `DOM_DATA_BUILD` serve the opted-in content).
  "/lazy-rows.ts": "lazy-rows.ts",
  "/dom-data.ts": "dom-data.ts",
  "/derived.ts": "derived.ts",
  "/dom-derived.ts": "dom-derived.ts",
  "/dom-derived-abi.ts": "dom-derived-abi.ts",
  "/dom-lite.ts": "dom-lite.ts",
  "/dom-lite-core.ts": "dom-lite-core.ts",
  "/dom-lite-attr.ts": "dom-lite-attr.ts",
  "/dom-lite-write.ts": "dom-lite-write.ts",
  "/dom-lite-list.ts": "dom-lite-list.ts",
  "/dom-lite-model.ts": "dom-lite-model.ts",
  "/dom-lite-full.ts": "dom-lite-full.ts",
  // DERIVED-C4: the derived build's `@rivetjs/reactivity` alias (fixtures import it by path).
  "/derived-reactivity.ts": "derived-reactivity.ts",
  // The production build of `#dev` (browsers have no package `imports` resolution).
  "/dev/off.ts": "dev/off.ts",
};
// The switch modules' opted-in content, served at their paths (the compiler plugin's table: `libs/compiler/switches.ts`).
function switchBuild(names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) out["/" + name + ".ts"] = switchContent(name, (module) => "/" + module + ".ts")!;
  return out;
}
/** Served in place of the production `#dev` (`/dev/off.ts`): the development toolkit (`dev/on.ts`; its imports are in `sources`). */
export const DEV_BUILD: Record<string, string> = {
  "/dev/off.ts": stripTypeScriptTypes(await readFile(new URL("../../dev/on.ts", import.meta.url), "utf8")),
};
/** Served in place of the switches: a resumed page's browser build (the adopt run's `DERIVED` + `LAZY_ROWS` switches). */
export const DERIVED_BUILD: Record<string, string> = switchBuild(DERIVED_SWITCHES);
/** Rewrite package specifiers to served paths. */
export const rewrite = (code: string): string =>
  code
    .replaceAll("@rivetjs/runtime/dom-derived-runtime", "/dom-derived.ts")
    // The component ABI only (ZERO ABI-SPLIT): the runtime is the page's `data-rt` module, as built.
    .replaceAll("@rivetjs/runtime/dom-derived", "/dom-derived-abi.ts")
    .replaceAll("@rivetjs/runtime/dom-lite", "/dom-lite.ts")
    .replaceAll("@rivetjs/runtime/resume-format", "/resume-format.ts")
    .replaceAll("@rivetjs/runtime/dom", "/dom.ts")
    .replaceAll("@rivetjs/runtime/style", "/style.ts")
    .replaceAll("@rivetjs/runtime/slot", "/slot.ts")
    .replaceAll("@rivetjs/runtime/props", "/props.ts")
    // The browser build of `@rivetjs/runtime/id` (`browser` export condition).
    .replaceAll('"@rivetjs/runtime/id"', '"/id-dom.ts"')
    .replaceAll("@rivetjs/reactivity/store", "/store.mjs")
    .replaceAll("@rivetjs/reactivity/track", "/track.mjs")
    .replaceAll("@rivetjs/reactivity", "/reactivity.mjs")
    .replaceAll('"#dev"', '"/dev/off.ts"');

/** Launch Chromium, route files (path → body or { body, type }), run fn(page, browser).
 * `streams` (path → (request, response) => void): served over real HTTP so responses stream. */
export type Served = string | { body: string; type?: string };
export type StreamHandler = (request: IncomingMessage, response: ServerResponse) => void;
export interface PageOptions {
  offline?: Set<string>;
  streams?: Record<string, StreamHandler>;
  /** Path → ms to hold its response, or a promise it waits for (chunk load order tests; a promise = cold for as long
   * as the test needs, whatever the host's speed). */
  delays?: Record<string, number | Promise<unknown>>;
}
export async function withPage<T>(
  files: Record<string, Served>,
  fn: (page: Page, requests: string[], browser: Browser) => Promise<T>,
  { offline = new Set<string>(), streams = {}, delays = {} }: PageOptions = {},
): Promise<T> {
  let http: Server | null = null,
    origin: string | null = null;
  if (Object.keys(streams).length) {
    http = createServer((request, response) => streams[new URL(request.url ?? "/", "http://x").pathname]!(request, response));
    const server = http;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  }
  const source = async (url: URL): Promise<string> => stripTypeScriptTypes(await readFile(url, "utf8"));
  const served: Record<string, string> = {
    "/reactivity.mjs": await source(new URL("../reactivity/index.ts", runtime)),
    "/store.mjs": (await source(new URL("../reactivity/store.ts", runtime))).replaceAll('"./index.ts"', '"/reactivity.mjs"'),
    "/track.mjs": (await source(new URL("../reactivity/track.ts", runtime))).replaceAll('"./index.ts"', '"/reactivity.mjs"'),
  };
  for (const [path, file] of Object.entries(sources)) {
    try {
      served[path] = rewrite(await source(new URL(file, runtime)));
    } catch {
      /* Optional during incremental development. */
    }
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.route("http://rivet.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (streams[path]) return route.continue({ url: origin + path });
      if (offline.has(path)) return route.abort("internetdisconnected");
      const entry = files[path] ?? served[path];
      if (entry === undefined) return route.fulfill({ status: 404, body: "missing " + path });
      const body = typeof entry === "string" ? entry : entry.body;
      const type = typeof entry === "object" && entry.type ? entry.type : /\.(m?js|ts)$/.test(path) ? "text/javascript" : "text/html";
      const delay = delays[path];
      if (typeof delay === "number" && delay) await new Promise((resolve) => setTimeout(resolve, delay));
      else if (delay) await delay;
      await route.fulfill({ body, contentType: type });
    });
    return await fn(page, requests, browser);
  } finally {
    await browser.close();
    http?.closeAllConnections();
    http?.close();
  }
}
