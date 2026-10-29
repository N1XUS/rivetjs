// cdk story app harness: production build (client + server), node adapter, one Chromium for a test file.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { buildApp } from "./app/serve.ts";

const root = new URL("./app/", import.meta.url).pathname;
let built: Promise<void> | null = null;

export interface Stories {
  origin: string;
  browser: Browser;
  close(): Promise<void>;
}

const lock = root + ".stories-lock";
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** Cross-process lock around build + serve: test files (and parallel runs) share `dist/`. */
async function acquire(): Promise<void> {
  for (;;) {
    try {
      await mkdir(lock);
      await writeFile(lock + "/pid", String(process.pid));
      return;
    } catch {
      const pid = Number(await readFile(lock + "/pid", "utf8").catch(() => "0"));
      if (pid && pid !== process.pid && !alive(pid)) await rm(lock, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 200));
    }
  }
}
const release = () => rm(lock, { recursive: true, force: true });

/** Build once per process, start the server and a browser (holds the stories lock until `close`). */
export async function stories(): Promise<Stories> {
  await acquire();
  await (built ??= buildApp());
  const app = await start({ dist: root + "dist", port: 0, host: "127.0.0.1", onError: () => {} });
  const browser = await chromium.launch({ headless: true });
  return {
    origin: app.url,
    browser,
    async close() {
      await browser.close();
      await app.close();
      await release();
    },
  };
}

export interface Watch {
  scripts: string[];
  errors: string[];
}

/** Record script requests and page errors. */
export function watch(page: Page): Watch {
  const seen: Watch = { scripts: [], errors: [] };
  page.on("request", (request) => {
    if (request.resourceType() === "script" || /\.m?js$/.test(new URL(request.url()).pathname)) seen.scripts.push(new URL(request.url()).pathname);
  });
  page.on("pageerror", (error) => seen.errors.push(error.message));
  return seen;
}

const LIBRARY = /scrolling|virtualizer|drag-drop|dnd|behaviour/;
/** Library chunks requested so far: cdk module chunks (`/cdk/<module>/` paths or names) plus `extra`. */
export const libraryScripts = (seen: Watch, extra?: RegExp): string[] => seen.scripts.filter((url) => LIBRARY.test(url) || (extra?.test(url) ?? false));
/** Library chunks the page imported (not the derived loader's low-priority fetch-ahead `modulepreload`s, which are
 *  fetched and compiled, never evaluated — Chromium reports them with initiator `script`, so they are told apart by the
 *  `<link rel="modulepreload">` hrefs): resource entries matching the library pattern that no preload link names. A started
 *  derived runtime (it installs `document.$rdp`) counts too: it evaluates the boundary chunks it adopts — and the default
 *  idle prime (LITE-BOOT) starts it with the listening chunks, so callers asserting zero library JS turn the background
 *  fetch off (Save-Data). */
export const libraryImports = (page: Page): Promise<string[]> =>
  page.evaluate((source) => {
    const preloaded = new Set([...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map((l) => l.href));
    const out = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((e) => e.initiatorType !== "link" && !preloaded.has(e.name) && new RegExp(source).test(new URL(e.name).pathname))
      .map((e) => new URL(e.name).pathname);
    if ("$rdp" in document) out.push("(derived runtime started)");
    return out;
  }, LIBRARY.source);

/** Focused element: id, role, data-key. */
export const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { id: el?.id ?? "", role: el?.getAttribute("role") ?? "", key: el?.getAttribute("data-key") ?? "" };
  });

/** Page errors collected for a page. */
export function errors(page: Page): string[] {
  const seen: string[] = [];
  page.on("pageerror", (error) => seen.push(error.message));
  page.on("console", (message) => message.type() === "error" && seen.push(message.text()));
  return seen;
}

/** Whether any component ran in the browser (resumability: must stay false). */
export const componentRan = (page: Page) => page.evaluate(() => "__componentRuns" in window);

export const text = (page: Page, selector: string) => page.evaluate((s) => document.querySelector(s)?.textContent ?? "", selector);
export const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
