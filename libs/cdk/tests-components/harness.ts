// Story app harness: production build (client + server), node adapter, one Chromium for a test file.
import { readFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { inject } from "vitest";
import { buildAppInChild, dist } from "./app/serve.ts";
import type {} from "./global-setup.ts";

let built: Promise<void> | null = null;

export interface Stories {
  origin: string;
  browser: Browser;
  close(): Promise<void>;
}

/**
 * Build (once per run via `global-setup.ts`, else once per process), start the server and a browser. `preload`: the server's preload option;
 * default `{ lean: true }` (no fetch-ahead `data-fo`): a fetched-ahead chunk is requested after `load` and evaluated later from the
 * module map without a request, so the request-based "no library code before interaction" / "chunk loads on press" checks
 * need lean pages (M6-CUT: derived is the only model; fetch-ahead has its own tests in `libs/runtime`).
 */
export async function stories(options: { preload?: NonNullable<Parameters<typeof start>[0]>["preload"] } = {}): Promise<Stories> {
  // `cdk-components` builds once in `global-setup.ts`; other callers (fuzz, own `STORIES_DIST`) build here, in child
  // processes (the build's memory is not kept by this fork while Chromium runs).
  await (built ??= inject("cdkStoriesDist") === dist ? Promise.resolve() : buildAppInChild());
  const app = await start({ dist, port: 0, host: "127.0.0.1", onError: () => {}, preload: options.preload ?? { lean: true } });
  const browser = await chromium.launch({ headless: true });
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

/**
 * Arm before `goto`: stamps the page clock (`performance.now()`) when deferred loading may start — the first
 * `requestIdleCallback` callback (the resume loader's idle boot / preloads, speculative activation after boot) or the
 * first `modulepreload` link appended after parsing (the loader's deferred preload queue, lazy-import preloads),
 * whichever comes first. Chunks requested before it are what the page loads by itself.
 */
export async function markDeferred(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __rvDeferredAt?: number };
    const stamp = () => (w.__rvDeferredAt ??= performance.now());
    const ric = window.requestIdleCallback;
    if (ric) window.requestIdleCallback = (callback, options) => ric.call(window, (deadline) => (stamp(), callback(deadline)), options);
    const observer = new MutationObserver((records) => {
      if (document.readyState === "loading") return;
      for (const record of records)
        for (const node of record.addedNodes)
          if ((node as Element).localName === "link" && (node as HTMLLinkElement).rel === "modulepreload") return void (stamp(), observer.disconnect());
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

/** Script paths requested before the `markDeferred` stamp (all so far when it has not fired yet). */
export const scriptsBeforeDeferred = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const at = (window as unknown as { __rvDeferredAt?: number }).__rvDeferredAt ?? Infinity;
    return performance
      .getEntriesByType("resource")
      .filter((entry) => entry.startTime < at && /\.m?js$/.test(new URL(entry.name).pathname))
      .map((entry) => new URL(entry.name).pathname);
  });

interface ResumeManifest {
  runtime: string;
  symbols: Record<string, string>;
  deps?: Record<string, string[]>;
}
let manifest: ResumeManifest | undefined;
const path = (url: string) => new URL(url, "http://x").pathname;
const resumeManifest = (): ResumeManifest => (manifest ??= JSON.parse(readFileSync(dist + "/client/.vite/rivet-resume.json", "utf8")) as ResumeManifest);

/**
 * Paths of the chunks holding the boundaries whose name (`<module>#<Component>`, cdk modules as `@rivetjs/cdk/<path>`;
 * match the end with `$`) matches, read from the build's `.vite/rivet-resume.json` `symbols` (one chunk per module
 * holding boundaries). Chunk file names are not matched.
 */
export const chunksOf = (match: RegExp): Set<string> =>
  new Set(Object.entries(resumeManifest().symbols).flatMap(([id, url]) => (match.test(id) ? [path(url)] : [])));

/** The chunks plus their static import closure (manifest `deps`). */
export const closureOf = (chunks: Iterable<string>): Set<string> => {
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
 * (loaded on every page) imports: the code a page downloads only for those symbols. A matching chunk the App imports
 * itself (the announcer regions) is App code, fetched with the App chunk on every page.
 */
export const codeOf = (match: RegExp): Set<string> => {
  const own = chunksOf(match);
  const always = closureOf([path(resumeManifest().runtime), ...chunksOf(/^\.rivet\/app\.tsx#/)]);
  return new Set([...closureOf(own)].filter((chunk) => !always.has(chunk)));
};

/**
 * Chunk paths the page itself hints before any input: the preload plan (`data-preload`: scheduled fetch + evaluate) and
 * the fetch-ahead list (`data-fo`: low priority after `load`, fetched, then loaded by the idle prime). Under route chunks one chunk holds
 * every component of the page, so a hint for one component brings the others' code along — a "no X code before
 * interaction" check compares against these, not against an empty list. Includes the hinted chunks' static import
 * closure (manifest `deps`: a preloaded route chunk pulls its shared `rivet-merge-…` imports). A `.deps.js` list counts
 * as its chunk. A `data-boot` page adds the runtime and the chunks of its client-trigger boundaries (derived boot).
 */
export const hinted = async (page: Page): Promise<Set<string>> => {
  const urls = await page.evaluate(() => {
    const plan = document.querySelector<HTMLElement>("script[data-preload]")?.dataset.preload;
    const planned = plan ? (JSON.parse(plan) as unknown[]).slice(1).map((entry) => (entry as [string])[0]) : [];
    const ahead = (document.querySelector<HTMLElement>("script[data-fo]")?.dataset.fo ?? "").split(" ").filter(Boolean);
    // A `data-boot` page starts the derived runtime at load: the boundaries with a client trigger (`clientEffect` /
    // `clientOnly` / an island: flags LOAD | IDLE | VISIBLE = 224) load their module chunks without any interaction.
    const tail = document.querySelector<HTMLElement>('script[type="rivet/boundaries"]');
    const booted: string[] = [];
    if (tail?.hasAttribute("data-boot")) {
      // Tail v2 (ZERO S2): names table `n` ([name, url index]), URLs `u`, records `[id, parent, flags, name index, …]`
      // and runs `[id, 0, 0, -1, count, [[parent, flags, name index], …]]`.
      const t = JSON.parse(tail.textContent!) as { n: [string, number][]; u?: string[]; b: number[][] };
      booted.push(tail.dataset.rt!);
      for (const e of t.b)
        for (const [, flags, name] of e[3] === -1 ? (e[5] as unknown as number[][]) : [[0, e[2]!, e[3]!]])
          if (flags! & 224 && t.n[name!]![1] >= 0) booted.push(t.u![t.n[name!]![1]]!);
    }
    return [...planned, ...ahead, ...booted];
  });
  return closureOf(urls.map((url) => path(url).replace(/\.deps\.js$/, ".js")));
};

/** Library chunks requested so far: aria / cdk code (in route mode the story route's own chunk holds it too). */
export const libraryScripts = (seen: Watch): string[] => among(seen.scripts, codeOf(/^@rivetjs\/cdk\//));

/** Focused element: id, role, data-key. */
export const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { id: el?.id ?? "", role: el?.getAttribute("role") ?? "", key: el?.getAttribute("data-key") ?? "" };
  });
