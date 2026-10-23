// Story app harness: production build (client + server), node adapter, one Chromium for a test file.
import { readFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { inject } from "vitest";
import { buildApp, dist } from "./app/serve.ts";
import type {} from "./global-setup.ts";

let built: Promise<void> | null = null;

export interface Stories {
  origin: string;
  browser: Browser;
  close(): Promise<void>;
}

/**
 * Build (once per run via `global-setup.ts`, else once per process), start the server and a browser. `preload`: the
 * server's preload option; default `{ lean: true }` (no fetch-ahead `data-fo`: its `modulepreload` requests after `load`
 * broke the request-based "only runtime entry chunks before interaction" checks, M6-CUT); fetch-ahead stories pass `{}`.
 */
export async function stories(options: { preload?: NonNullable<Parameters<typeof start>[0]>["preload"] } = {}): Promise<Stories> {
  // `ui-components` builds once in `global-setup.ts`; other callers (fuzz, own `STORIES_DIST`) build here.
  await (built ??= inject("uiStoriesDist") === dist ? Promise.resolve() : buildApp());
  const app = await start({ dist, port: 0, host: "127.0.0.1", onError: () => {}, preload: options.preload ?? { lean: true } });
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  return {
    origin: app.url,
    browser,
    async close() {
      await browser.close();
      await app.close();
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

interface ResumeManifest {
  runtime: string;
  loader?: string;
  symbols: Record<string, string>;
  deps?: Record<string, string[]>;
}
let manifest: ResumeManifest | undefined;
const path = (url: string) => new URL(url, "http://x").pathname;
const resumeManifest = (): ResumeManifest => (manifest ??= JSON.parse(readFileSync(dist + "/client/.vite/rivet-resume.json", "utf8")) as ResumeManifest);

/**
 * Paths of the chunks holding the resume symbols whose id (`<module>#<Component>$<hash>`, library modules as
 * `@rivetjs/ui/<path>` / `@rivetjs/cdk/<path>`) matches, read from the build's `.vite/rivet-resume.json`. Chunk file
 * names depend on `resume.chunks` (route chunks by default: `resume-<route file>-…`, placed shared code in
 * `rivet-merge-…`), the symbol → chunk map does not.
 */
export const chunksOf = (match: RegExp): Set<string> =>
  new Set(Object.entries(resumeManifest().symbols).flatMap(([id, url]) => (match.test(id) ? [path(url)] : [])));

/** The chunks plus their static import closure (manifest `deps`). */
const closureOf = (chunks: Iterable<string>): Set<string> => {
  const deps = resumeManifest().deps ?? {};
  const out = new Set<string>();
  for (const chunk of chunks) {
    out.add(chunk);
    for (const dependency of deps[chunk] ?? []) out.add(path(dependency));
  }
  return out;
};

/** The script paths among `scripts` that are in `chunks` (a `.deps.js` list counts as its chunk). */
export const among = (scripts: readonly string[], chunks: ReadonlySet<string>): string[] =>
  scripts.filter((url) => chunks.has(url.replace(/\.deps\.js$/, ".js")));

/** The script paths among `scripts` that are a chunk holding a matching symbol (or its `.deps.js` list). */
export const scriptsOf = (scripts: readonly string[], match: RegExp): string[] => among(scripts, chunksOf(match));

/**
 * The chunks holding matching symbols plus the shared chunks they import that neither the runtime nor the router App
 * (loaded on every page) imports: the code a page downloads only for those symbols.
 */
export const codeOf = (match: RegExp): Set<string> => {
  const own = chunksOf(match);
  const always = runtimeChunks();
  return new Set([...own, ...[...closureOf(own)].filter((chunk) => !always.has(chunk))]);
};

/**
 * Runtime chunks every resumed page may load before an interaction: the resume runtime entry, the router App (its
 * symbols: link handling; `resume-route_main` in route mode, `resume-App` in component mode) and the layouts sharing
 * its chunk, their static import closures (DOM runtime, reactivity, Vite's preload helper, merged shared chunks), and
 * the resume loader module (LOADER-DIET's deferred half of the inline loader; it evaluates no component code). Read
 * from the build manifest, so it follows `resume.chunks` / `resume.merge`.
 */
const runtimeChunks = (): Set<string> => {
  const m = resumeManifest();
  const out = closureOf([path(m.runtime), ...chunksOf(/^\.rivet\/app\.tsx#/)]);
  if (m.loader) out.add(path(m.loader));
  return out;
};

/** Library chunks requested so far: chunks holding ui / cdk symbols (in route mode, the story route's own chunk too). */
export const libraryScripts = (seen: Watch): string[] => scriptsOf(seen.scripts, /^@rivetjs\/(ui|cdk)\//);

/** Focused element: id, role, data-key. */
export const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { id: el?.id ?? "", role: el?.getAttribute("role") ?? "", key: el?.getAttribute("data-key") ?? "" };
  });

/** Scripts requested so far other than the runtime chunks: ui components, `dom.*` symbols, route modules. */
export const nonRuntimeScripts = (seen: Watch): string[] => {
  const runtime = runtimeChunks();
  return seen.scripts.filter((url) => !runtime.has(url.replace(/\.deps\.js$/, ".js")));
};

/** One animation frame of {@link traceFade}: the element's computed opacity + backdrop blur, state attributes, running animation count. */
export interface FadeSample {
  t: number;
  /** Element absent (not mounted). */
  gone: boolean;
  opacity: number;
  entering: boolean;
  exiting: boolean;
  running: number;
  /** Computed `backdrop-filter` blur radius in px (0 for `none`). */
  blur: number;
}

/**
 * Samples the first `selector` match every animation frame for `ms` (start before opening); `samples()` reads the trace,
 * `now()` is the current trace time (call it right before closing).
 */
export async function traceFade(page: Page, selector: string, ms = 3000): Promise<{ samples: () => Promise<FadeSample[]>; now: () => Promise<number> }> {
  const key = "__fade" + Math.random().toString(36).slice(2);
  await page.evaluate(
    ([selector, key, ms]) => {
      const log: unknown[] = ((window as unknown as Record<string, unknown[]>)[key as string] = []);
      const t0 = performance.now();
      (window as unknown as Record<string, number>)[key + "t0"] = t0;
      const sample = () => {
        const el = document.querySelector(selector as string);
        log.push(
          el
            ? {
                t: performance.now() - t0,
                gone: false,
                opacity: Number(getComputedStyle(el).opacity),
                entering: el.getAttribute("data-entering") === "true",
                exiting: el.getAttribute("data-exiting") === "true",
                running: el.getAnimations().filter((a) => a.playState === "running").length,
                blur: Number(/blur\(([\d.]+)px\)/.exec(getComputedStyle(el).backdropFilter)?.[1] ?? 0),
              }
            : { t: performance.now() - t0, gone: true, opacity: 0, entering: false, exiting: false, running: 0, blur: 0 },
        );
        if (performance.now() - t0 < (ms as number)) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    [selector, key, ms] as const,
  );
  return {
    samples: () => page.evaluate((key) => (window as unknown as Record<string, FadeSample[]>)[key], key),
    now: () => page.evaluate((key) => performance.now() - (window as unknown as Record<string, number>)[key + "t0"], key),
  };
}

/**
 * Asserts a trace shows a fade in after opening (a frame with a running animation and 0 < opacity < 1 before opacity 1)
 * and, from `closedAt` (trace ms), a fade out while still mounted (`data-exiting`, running, 0 < opacity < 1) before the
 * element is gone.
 */
export function assertFades(samples: FadeSample[], closedAt: number, label: string): void {
  const opened = samples.filter((s) => !s.gone && s.t < closedAt);
  const midIn = opened.find((s) => s.running > 0 && s.opacity > 0.02 && s.opacity < 0.98);
  if (!midIn) throw new Error(`${label}: no fade in (${JSON.stringify(opened.slice(0, 6))})`);
  const settled = opened.find((s) => s.t > midIn.t && s.opacity === 1 && s.running === 0 && !s.entering);
  if (!settled) throw new Error(`${label}: the fade in never settled at opacity 1`);
  const closing = samples.filter((s) => s.t >= closedAt);
  const midOut = closing.find((s) => !s.gone && s.exiting && s.running > 0 && s.opacity > 0.02 && s.opacity < 0.98);
  if (!midOut) throw new Error(`${label}: no fade out while mounted (${JSON.stringify(closing.slice(0, 6))})`);
  if (!closing.some((s) => s.t > midOut.t && s.gone)) throw new Error(`${label}: not unmounted after the fade out`);
}
