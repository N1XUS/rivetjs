// Example checks of a docs build: every live example's frame page (`/examples/<id>/frame/`, prerendered with the
// site) is loaded in Chromium from the built client dir over HTTP, its `test` steps run, and what it loaded is
// measured (scripts before and after the first interaction, brotli bytes). The measures are written into the
// "What loaded" paragraph of every page that shows the example (`writeMeasures`).
// A check is reused while its page is the same: the HTML (minus asset URLs the page never requested) and the
// steps hash to the last check's key, and every file it requested (content-hashed names) is still there.
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve, sep } from "node:path";
import { brotliCompressSync } from "node:zlib";
import type { Step } from "../define.ts";
import type { ExampleData, ExampleMeasure } from "../components/types.ts";
import { framePath } from "../frame-theme.ts";
import { writeAtomic } from "./lock.ts";

/** Chromium launch flags (no keychain prompts on macOS). */
export const CHROMIUM_ARGS = ["--use-mock-keychain", "--password-store=basic"];
/** Steps that act on the page (the first one starts the "after the first interaction" window); the rest only wait. */
const INPUT_STEPS = ["click", "fill", "press", "key", "dblclick", "rightclick", "longpress", "hover", "wheel", "drag", "tap"] as const;
/**
 * Strict mode (env `DOCS_KIT_CHECK_STRICT=1`, for measure audits): the pre-2026-10-09 waits (Playwright `networkidle`
 * = 500 ms without any request + a 300 ms settle, before and after the steps) and one page at a time.
 */
export const CHECK_STRICT = process.env.DOCS_KIT_CHECK_STRICT === "1";
/**
 * Pages checked at once (env `DOCS_KIT_CHECK_CONCURRENCY`, default 6; strict mode: 1), one browser. Each page is
 * ≈ 60 MB of Chromium. With the quiet detector (`quiet`) a measure does not depend on how many pages run at once
 * (250 ui-docs examples, 2026-10-09: two 6-page runs identical, 248 equal to the strict mode, whose post-step
 * `networkidle` undercounts the other 2 and varies run to run; 29 s vs 97 s with the old waits at 3 pages).
 */
export const CHECK_CONCURRENCY = Math.max(1, Number(process.env.DOCS_KIT_CHECK_CONCURRENCY) || (CHECK_STRICT ? 1 : 6));
/**
 * Quiet detector: never quiet before the page's clock (`performance.now()`, from navigation start) reads this. The
 * resume loader defers preloads requested in its first 150 ms by 150 ms (`calm`), so its timers are due before 300 ms;
 * a round's own timer due later runs after them. A floor in Node time (200 ms after `load`) missed them on a loaded
 * host: a 100 ms round checked the page at 175 ms, its preloads came at 181 ms (0 scripts measured instead of 131).
 */
const QUIET_FLOOR_MS = 320;
/** Quiet detector: consecutive quiet rounds needed (conditions: `quiet`). */
const QUIET_ROUNDS = 3;
/**
 * Quiet detector: a round is a frame (so `visible` preloads' IntersectionObservers have reported), then an idle callback
 * (the loader's own idle preloads have no timeout and run first), then 16 ms. Busy pages (animations) still get a round
 * after this long.
 */
const IDLE_TIMEOUT_MS = 1000;
/** Quiet detector: give up waiting after this long (a page that keeps requesting, e.g. polling). */
const QUIET_MAX_MS = 5000;
/** Check cache (relative to the app root). Bump `FORMAT` when a check measures differently. */
/**
 * Quarantined checks (app-relative, optional): `{ "<example id>": { "step": "<failing step>", "reason": "<one line>" } }`.
 * A quarantined example's failure is reported as quarantined, not hidden, and does not fail the build (its "What
 * loaded" stays empty); a quarantined example that passes is reported so its entry gets removed.
 */
export const QUARANTINE = "examples/_quarantine.json";
export const CHECK_CACHE = ".artifacts/example-checks.json";
const FORMAT = CHECK_STRICT ? "2-strict" : "2";

interface CacheEntry {
  /** Hash of the frame page's HTML with the asset URLs it did not request blanked, and its steps. */
  key: string;
  /** Same-origin paths the page requested (scripts, styles, images, fonts). */
  requested: string[];
  measure: ExampleMeasure;
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const ASSET_URL = /\/assets\/[^"'\s)<>,]+/g;
/** The cache key of a frame page: its HTML with every asset URL outside `requested` blanked (the App chunk of the docs router changes with every docs page; a frame never loads it), plus its steps. */
export function checkKey(html: string, requested: ReadonlySet<string>, steps: readonly Step[] | undefined): string {
  return sha(FORMAT + "\n" + JSON.stringify(steps ?? []) + "\n" + html.replace(ASSET_URL, (url) => (requested.has(url) ? url : "/assets/*")));
}

/** Serve the built client dir (folders → index.html) on a local port for the checks (and `scripts/lazy-rows/probe.ts`). */
export async function serveClient(client: string): Promise<{ url: string; close(): Promise<void> }> {
  const { serve } = await import("@rivetjs/router/node");
  return serve({
    client,
    static: "fs",
    port: 0,
    // A check closing its page while a prefetch is in flight: the file stream finds the response gone.
    onError: (error) => {
      if ((error as { code?: string } | null)?.code !== "ERR_STREAM_UNABLE_TO_PIPE") console.error(error);
    },
    compress: true,
    immutable: (path) => path.includes("/assets/"),
    handler: async (request) => {
      const { pathname } = new URL(request.url);
      const file = resolve(client, "." + decodeURIComponent(pathname).replace(/\/?$/, "/") + "index.html");
      if (file.startsWith(client + sep) && existsSync(file))
        return new Response(await readFile(file), { headers: { "content-type": "text/html; charset=utf-8" } });
      return new Response("Not found", { status: 404 });
    },
  });
}

/** Same-origin requests of a page seen by Playwright: in flight now, started so far, and how many were not main-frame navigations. */
interface Traffic {
  inflight: number;
  total: number;
  resources: number;
}

/**
 * Wait until the page is quiet: its clock passed `QUIET_FLOOR_MS` and `QUIET_ROUNDS` consecutive rounds saw
 * - no same-origin request started and none is in flight (Playwright request events),
 * - the page's same-origin resource timing entries did not change, and Playwright has seen at least that many
 *   requests (its request events arrive over CDP, independently of the page's evaluate results),
 * - no `<link rel=modulepreload|preload>` / `<script src>` is pending (no resource timing entry yet: the loader's
 *   low-priority preloads start after they are appended).
 * The resume loader chains idle → preload → onload → idle; cross-origin requests (embeds, players) are not counted.
 * Replaces `networkidle` + 300 ms.
 */
async function quiet(page: import("playwright").Page, traffic: Traffic): Promise<void> {
  const start = Date.now();
  let calm = 0;
  let entries = -1;
  let clock = 0;
  while ((calm < QUIET_ROUNDS || clock < QUIET_FLOOR_MS) && Date.now() - start < QUIET_MAX_MS) {
    const seen = traffic.total;
    const state = await page
      .evaluate(
        (timeout) =>
          new Promise<[entries: number, pending: number, clock: number]>((done) =>
            requestAnimationFrame(() =>
              requestIdleCallback(
                () =>
                  setTimeout(() => {
                    const same = (url: string) => new URL(url).origin === location.origin;
                    let pending = 0;
                    for (const el of document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>(
                      "link[rel=modulepreload][href], link[rel=preload][href], script[src]",
                    )) {
                      const url = "href" in el ? el.href : el.src;
                      if (same(url) && performance.getEntriesByName(url).length === 0) pending++;
                    }
                    done([performance.getEntriesByType("resource").filter((entry) => same(entry.name)).length, pending, performance.now()]);
                  }, 16),
                { timeout },
              ),
            ),
          ),
        IDLE_TIMEOUT_MS,
      )
      // A step that navigates destroys the context mid-round: not quiet yet.
      .catch((): [number, number, number] => [-1, -1, 0]);
    const settled = state[1] === 0 && state[0] === entries && traffic.resources >= state[0];
    calm = settled && traffic.inflight === 0 && traffic.total === seen ? calm + 1 : 0;
    entries = state[0];
    clock = state[2];
  }
}

/** Load the frame page, run `steps`, measure requests before and after the first interaction. */
async function check(
  browser: import("playwright").Browser,
  origin: string,
  id: string,
  steps: readonly Step[],
  sizes: (path: string) => number,
): Promise<{ measure: ExampleMeasure; requested: string[] }> {
  const page = await browser.newPage();
  // The quiet detector reads resource timing entries: never let the buffer (250 by default) fill up.
  await page.addInitScript(() => performance.setResourceTimingBufferSize(100_000));
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));
  const scripts: string[] = [];
  const requested = new Set<string>();
  const traffic: Traffic = { inflight: 0, total: 0, resources: 0 };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) return;
    traffic.inflight++;
    traffic.total++;
    if (!(request.isNavigationRequest() && request.frame() === page.mainFrame())) traffic.resources++;
    requested.add(url.pathname);
    if (request.resourceType() === "script") scripts.push(url.pathname);
  });
  const settled = (request: import("playwright").Request) => {
    if (new URL(request.url()).origin === origin) traffic.inflight--;
  };
  page.on("requestfinished", settled);
  page.on("requestfailed", settled);
  const url = origin + framePath(id);
  try {
    const response = await page.goto(url, { waitUntil: "load" });
    if (response?.status() !== 200) throw new Error(`example ${id}: ${framePath(id)} returned ${response?.status()}`);
    // Let idle-time prefetches happen: they count as "before the first interaction".
    if (CHECK_STRICT) {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
    } else await quiet(page, traffic);
    const before = scripts.length;
    let interacted = false;
    let afterStart = before;
    // A step that loads another page ends the "first interaction" window.
    let afterEnd: number | undefined;
    page.on("request", (request) => {
      if (interacted && afterEnd === undefined && request.isNavigationRequest() && request.frame() === page.mainFrame()) afterEnd = scripts.length;
    });
    for (const step of steps) {
      const interaction = INPUT_STEPS.some((kind) => kind in step);
      if (interaction && !interacted) {
        interacted = true;
        afterStart = scripts.length;
      }
      await run(page, step, id);
    }
    if (interacted) {
      if (CHECK_STRICT) await page.waitForLoadState("networkidle");
      else await quiet(page, traffic);
    }
    const html = await (await fetch(url)).text();
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].reduce((sum, m) => sum + Buffer.byteLength(m[1]!), 0);
    const after = scripts.slice(afterStart, afterEnd);
    if (errors.length) throw new Error(`example ${id}: console errors:\n  ${errors.join("\n  ")}`);
    return {
      measure: {
        inlineBytes: inline,
        htmlBrotli: brotliCompressSync(Buffer.from(html)).length,
        requestsBefore: before,
        bytesBefore: scripts.slice(0, before).reduce((sum, path) => sum + sizes(path), 0),
        requestsAfter: interacted ? after.length : 0,
        bytesAfter: after.reduce((sum, path) => sum + sizes(path), 0),
      },
      requested: [...requested].sort(),
    };
  } finally {
    await page.close();
  }
}

/** Touch the centre of `selector` and lift (CDP touch events; the page needs no `hasTouch` context). */
async function tap(page: import("playwright").Page, selector: string): Promise<void> {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await target.boundingBox({ timeout: 5000 });
  if (!box) throw new Error(`${selector} is not visible`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

/** Mouse down on the element's centre, hold `ms` (default 700), mouse up. */
async function longPress(page: import("playwright").Page, target: string | [string, number]): Promise<void> {
  const [selector, ms] = typeof target === "string" ? [target, 700] : target;
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await el.boundingBox({ timeout: 5000 });
  if (!box) throw new Error(`${selector} has no box`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Run one test step (exported for tests/steps.test.ts). */
export async function run(page: import("playwright").Page, step: Step, id: string): Promise<void> {
  const where = `example ${id}: step ${JSON.stringify(step)}`;
  try {
    if ("click" in step) await page.click(step.click, { timeout: 5000 });
    else if ("dblclick" in step) await page.dblclick(step.dblclick, { timeout: 5000 });
    else if ("rightclick" in step) await page.click(step.rightclick, { button: "right", timeout: 5000 });
    else if ("longpress" in step) await longPress(page, step.longpress);
    else if ("hover" in step) await page.hover(step.hover, { timeout: 5000 });
    else if ("wheel" in step) {
      await page.hover(step.wheel[0], { timeout: 5000 });
      await page.mouse.wheel(0, step.wheel[1]);
    } else if ("drag" in step) await page.dragAndDrop(step.drag[0], step.drag[1], { timeout: 5000 });
    else if ("tap" in step) await tap(page, step.tap);
    else if ("fill" in step) await page.fill(step.fill[0], step.fill[1], { timeout: 5000 });
    else if ("press" in step) await page.press(step.press[0], step.press[1], { timeout: 5000 });
    else if ("key" in step) await page.keyboard.press(step.key);
    else if ("expect" in step)
      await page.waitForFunction(([selector, text]) => document.querySelector(selector!)?.textContent?.includes(text!) ?? false, step.expect, {
        timeout: 5000,
      });
    else if ("attr" in step)
      await page.waitForFunction(([selector, name, value]) => (document.querySelector(selector!)?.getAttribute(name!) ?? null) === value, step.attr, {
        timeout: 5000,
      });
    else if ("name" in step || "described" in step)
      await page.waitForFunction(
        ([kind, selector, text]) => {
          const el = document.querySelector(selector!);
          if (!el) return false;
          const byIds = (attr: string) => {
            const ids = el.getAttribute(attr);
            return ids === null
              ? null
              : ids
                  .split(/\s+/)
                  .map((id) => document.getElementById(id)?.textContent ?? "")
                  .join(" ");
          };
          const value =
            kind === "described"
              ? byIds("aria-describedby")
              : (byIds("aria-labelledby") ??
                el.getAttribute("aria-label") ??
                ([...((el as HTMLInputElement).labels ?? [])].map((label) => label.textContent).join(" ") || el.textContent));
          return value?.includes(text!) ?? false;
        },
        "name" in step ? ["name", ...step.name] : ["described", ...step.described],
        { timeout: 5000 },
      );
    else if ("focused" in step) await page.waitForFunction((selector) => document.activeElement?.matches(selector) ?? false, step.focused, { timeout: 5000 });
    else if ("matches" in step) await page.waitForFunction((selector) => document.querySelector(selector) !== null, step.matches, { timeout: 5000 });
    else await page.waitForFunction((selector) => document.querySelector(selector) === null, step.absent, { timeout: 5000 });
  } catch (error) {
    throw new Error(`${where} failed${await found(page, step)}: ${(error as Error).message.split("\n")[0]}`);
  }
}

/** What the page held when an assertion step timed out (text, attribute or the focused element). */
async function found(page: import("playwright").Page, step: Step): Promise<string> {
  const state = await page
    .evaluate((step) => {
      const describe = (el: Element | null) => (el ? el.outerHTML.replace(/>[\s\S]*$/, ">") : "none");
      if ("expect" in step) return `text: ${JSON.stringify(document.querySelector(step.expect[0])?.textContent ?? null)}`;
      if ("attr" in step) return `${step.attr[1]}: ${JSON.stringify(document.querySelector(step.attr[0])?.getAttribute(step.attr[1]) ?? null)}`;
      if ("name" in step || "described" in step) {
        const [selector] = "name" in step ? step.name : step.described;
        return describe(document.querySelector(selector));
      }
      if ("focused" in step) return `focused: ${describe(document.activeElement)}`;
      return "";
    }, step)
    .catch(() => "");
  return state ? ` (${state})` : "";
}

export interface CheckExamplesOptions {
  /** Reuse checks of unchanged frame pages (default true; `false` = `--no-cache`: check every example again). */
  cache?: boolean;
  /** Check only these example ids (`check-examples`); the quarantine is still validated against every example. */
  only?: readonly string[];
  /** Write the check cache (default true; `check-examples` = false: its partial build must not touch the site's cache). */
  persist?: boolean;
  log?: (message: string) => void;
}

/**
 * Check every live example of `examples` against the built client dir `client`; returns the measures by id. The first
 * failing check stops the rest and throws. The cache (`CHECK_CACHE` under `root`) is rewritten with this run's checks.
 */
export async function checkExamples(
  root: string,
  client: string,
  examples: Readonly<Record<string, ExampleData>>,
  options: CheckExamplesOptions = {},
): Promise<Record<string, ExampleMeasure>> {
  const log = options.log ?? ((message: string) => console.log(message));
  client = resolve(client);
  const cacheFile = resolve(root, CHECK_CACHE);
  const previous: Record<string, CacheEntry> =
    options.cache === false
      ? {}
      : await readFile(cacheFile, "utf8").then(
          (text) => (JSON.parse(text) as { entries: Record<string, CacheEntry> }).entries,
          () => ({}),
        );
  const next: Record<string, CacheEntry> = {};
  const measures: Record<string, ExampleMeasure> = {};
  const todo: ExampleData[] = [];
  const quarantine: Record<string, { step: string; reason: string }> = await readFile(resolve(root, QUARANTINE), "utf8").then(
    (text) => JSON.parse(text) as Record<string, { step: string; reason: string }>,
    () => ({}),
  );
  for (const id of Object.keys(quarantine)) if (!examples[id]) throw new Error(`${QUARANTINE}: unknown example ${id}`);
  const only = options.only && new Set(options.only);
  const persist = options.persist !== false;
  for (const example of Object.values(examples)) {
    if (example.codeOnly || (only && !only.has(example.id))) continue;
    const html = await readFile(resolve(client, "." + framePath(example.id), "index.html"), "utf8").catch(() => null);
    if (html === null) throw new Error(`example ${example.id}: no frame page in the build (${framePath(example.id)})`);
    const entry = previous[example.id];
    if (
      entry &&
      entry.key === checkKey(html, new Set(entry.requested), example.test) &&
      entry.requested.every((path) => existsSync(resolve(client, "." + path)))
    ) {
      next[example.id] = entry;
      measures[example.id] = entry.measure;
    } else todo.push(example);
  }
  log(`checks: ${todo.length} example(s) to check in Chromium, ${Object.keys(measures).length} unchanged`);
  if (todo.length) {
    const sizeCache = new Map<string, number>();
    const sizes = (path: string) => {
      let size = sizeCache.get(path);
      if (size === undefined) {
        const file = resolve(client, "." + path);
        size = file.startsWith(client + sep) && existsSync(file) ? brotliCompressSync(readFileSync(file)).length : 0;
        sizeCache.set(path, size);
      }
      return size;
    };
    const { chromium } = await import("playwright");
    const [server, browser] = await Promise.all([
      serveClient(client),
      chromium.launch({
        headless: true,
        args: CHROMIUM_ARGS,
        ...(process.env.DOCS_KIT_CHROMIUM_PATH ? { executablePath: process.env.DOCS_KIT_CHROMIUM_PATH } : {}),
      }),
    ]);
    // Every failing example is checked to the end and reported together (one build shows all of them).
    const failed: Error[] = [];
    let done = 0;
    try {
      // One example: record its measure, or report it (quarantined / failed) when `final`; false = failed, retry.
      const one = async (example: ExampleData, final: boolean): Promise<boolean> => {
        try {
          const { measure, requested } = await check(browser, server.url, example.id, example.test ?? [], sizes);
          const html = await readFile(resolve(client, "." + framePath(example.id), "index.html"), "utf8");
          next[example.id] = { key: checkKey(html, new Set(requested), example.test), requested, measure };
          measures[example.id] = measure;
          if (quarantine[example.id]) log(`checks: quarantined example ${example.id} passed: remove it from ${QUARANTINE}`);
          return true;
        } catch (error) {
          if (!final) return false;
          const held = quarantine[example.id];
          if (held) log(`checks: quarantined ${example.id} (${held.reason}; step ${held.step}): ${(error as Error).message.split("\n")[0]}`);
          else {
            failed.push(error as Error);
            log(`checks: FAILED ${(error as Error).message.split("\n")[0]}`);
          }
          return false;
        }
      };
      let at = 0;
      const retry: ExampleData[] = [];
      const lane = async () => {
        while (at < todo.length) {
          const example = todo[at++]!;
          if (!(await one(example, CHECK_CONCURRENCY === 1))) if (CHECK_CONCURRENCY > 1) retry.push(example);
          if (++done % 50 === 0 || done === todo.length) log(`checks: ${done}/${todo.length}`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CHECK_CONCURRENCY, todo.length) }, lane));
      // Concurrent pages shift timing (held first clicks, idle prefetches): a failure is re-checked once alone, and
      // reported with its result (a pass is logged, not hidden).
      for (const example of retry) if (await one(example, true)) log(`checks: ${example.id} failed with ${CHECK_CONCURRENCY} pages at once, passed alone`);
    } finally {
      await browser.close();
      await server.close();
      // Keep what passed (the next build re-checks only the rest).
      if (persist) await writeAtomic(cacheFile, JSON.stringify({ format: FORMAT, entries: { ...previous, ...next } }) + "\n");
    }
    if (failed.length === 1) throw failed[0];
    if (failed.length) throw new Error(`${failed.length} example checks failed:\n${failed.map((error) => "  " + error.message.split("\n")[0]).join("\n")}`);
  }
  if (persist) await writeAtomic(cacheFile, JSON.stringify({ format: FORMAT, entries: next }) + "\n");
  return measures;
}

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The "What loaded" sentence of a measure (HTML; numbers only). */
export function measureHTML(m: ExampleMeasure): string {
  return (
    `<strong>What loaded</strong> (measured at build in Chromium, cold cache, brotli): HTML ${kb(m.htmlBrotli)} with ${kb(m.inlineBytes)} of inline script and state. ` +
    `Before the first interaction: ${plural(m.requestsBefore, "script", "scripts")} (${kb(m.bytesBefore)}).` +
    (m.requestsAfter ? ` On the first interaction: ${plural(m.requestsAfter, "script", "scripts")} (${kb(m.bytesAfter)}).` : "") +
    " Your browser may already have some of these cached."
  );
}

const MEASURE_SLOT = /<p class="what-loaded" data-measure="([\w-]+)"><\/p>/g;

/** Fill the "What loaded" paragraphs (`<Example>`) of every page in `client`; returns the number of pages written. */
export async function writeMeasures(client: string, measures: Readonly<Record<string, ExampleMeasure>>): Promise<number> {
  let written = 0;
  for (const entry of await readdir(client, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const file = join(entry.parentPath, entry.name);
    const html = await readFile(file, "utf8");
    if (!html.includes('data-measure="')) continue;
    const filled = html.replace(MEASURE_SLOT, (slot, id: string) => {
      const measure = measures[id];
      return measure ? `<p class="what-loaded">${measureHTML(measure)}</p>` : slot;
    });
    if (filled !== html) {
      await writeFile(file, filled);
      written++;
    }
  }
  return written;
}
