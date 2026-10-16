// Search on the Vite dev server: the same Pagefind index as the build (`search.ts`), built in memory
// from the pages the dev server renders and served at `/pagefind/*` (the URL the search dialog loads).
// Built on the first `/pagefind/` request (dev startup stays fast); a source change only marks it stale,
// and the next `/pagefind/` request starts a rebuild while the stale index answers (no CPU spent on
// edits nobody searches after). Nothing is written to disk.
import type { IncomingMessage, ServerResponse } from "node:http";
import { relative, resolve, sep } from "node:path";
import * as pagefind from "pagefind";
import type { Plugin, ViteDevServer } from "vite";
import { fillPattern } from "@rivetjs/router/static";
import { SEARCH_INDEX } from "./search.ts";

/** One page to index: its URL (trailing-slash form, as the build's index has it) and its HTML. */
export interface DevSearchPage {
  url: string;
  html: string;
}

/**
 * Feeds pages to the index: call `add` per page (awaiting it keeps memory flat). `changed` = files changed
 * since the source's previous successful run (absolute paths), or `"all"` (first run, unknown change, or
 * the previous run failed): a source may reuse what it rendered before for pages those files cannot affect.
 */
export type DevSearchSource = (add: (page: DevSearchPage) => Promise<void>, changed: ReadonlySet<string> | "all") => Promise<void>;

export interface DevSearchIndex {
  /** Connect middleware for `/pagefind/*` (mount it at `/pagefind`, or pass full URLs). */
  handle(req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void;
  /** `file` (absolute; none = anything) changed: mark the index stale; the next request starts a rebuild (and is served the stale index). */
  invalidate(file?: string): void;
  /** Build now (or join the running build); resolves with the indexed page count and duration. */
  build(): Promise<{ pages: number; ms: number }>;
  /** No rebuilds after this (a running one finishes). */
  close(): void;
}

const TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
};

// One Pagefind backend per process (`pagefind.close()` ends it for every index): builds run one at a time.
let builds: Promise<unknown> = Promise.resolve();

/** In-memory Pagefind index over `source`, served by `handle`. */
export function devSearchIndex(source: DevSearchSource, options: { log?: (message: string) => void } = {}): DevSearchIndex {
  const log = options.log ?? (() => {});
  /** Served files: the latest build plus the one before (a page that loaded the old `pagefind-entry.json` still finds its chunks). */
  let files = new Map<string, Uint8Array>();
  let latest = new Map<string, Uint8Array>();
  let built = false;
  /** Sources changed since the served index's build started. */
  let stale = false;
  /** Files changed since the last build snapshot (what the next build's source may re-render). */
  let changes: Set<string> | "all" = "all";
  let closed = false;
  let running: Promise<{ pages: number; ms: number }> | undefined;

  const run = async (): Promise<{ pages: number; ms: number }> => {
    // Changes from here on land after this build's snapshot: they mark the index stale again.
    stale = false;
    const changed = changes;
    changes = new Set();
    const started = performance.now();
    try {
      return await indexPages(changed, started);
    } catch (error) {
      // The source may have half-updated what it reuses: the next build renders everything.
      changes = "all";
      throw error;
    }
  };
  const indexPages = async (changed: ReadonlySet<string> | "all", started: number): Promise<{ pages: number; ms: number }> => {
    const { index, errors } = await pagefind.createIndex(SEARCH_INDEX);
    if (!index) throw new Error(`pagefind: ${errors.join("; ")}`);
    try {
      let pages = 0;
      await source(async (page) => {
        const added = await index.addHTMLFile({ url: page.url, content: page.html });
        if (added.errors.length) throw new Error(`pagefind ${page.url}: ${added.errors.join("; ")}`);
        pages++;
      }, changed);
      if (!pages) throw new Error("no pages rendered to index");
      const got = await index.getFiles();
      if (got.errors.length) throw new Error(`pagefind: ${got.errors.join("; ")}`);
      const fresh = new Map(got.files.map((file) => [file.path.replaceAll("\\", "/"), file.content] as const));
      files = new Map([...latest, ...fresh]);
      latest = fresh;
      return { pages, ms: Math.round(performance.now() - started) };
    } finally {
      await pagefind.close();
    }
  };
  const build = (): Promise<{ pages: number; ms: number }> => {
    if (running) return running;
    const current = (running = (builds = builds.then(run, run)) as Promise<{ pages: number; ms: number }>);
    current.then(
      (result) => {
        built = true;
        log(`search: ${result.pages} pages indexed in ${(result.ms / 1000).toFixed(1)} s (dev, in memory)`);
      },
      (error: unknown) => {
        // A failed rebuild keeps the previous index; the next change marks it stale again (no retry per request).
        log(`search: dev index failed: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
    void current
      .catch(() => {})
      .finally(() => {
        running = undefined;
      });
    return current;
  };
  // Never built nor building: nothing to mark (the first request builds the current state).
  const invalidate = (file?: string) => {
    if (!built && !running) return;
    stale = true;
    if (file === undefined) changes = "all";
    else if (changes !== "all") changes.add(resolve(file));
  };
  const handle = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!).replace(/^\/(?:pagefind\/)?/, "");
    // Stale: rebuild in the background (one at a time) and answer from the current index meanwhile.
    if (built && stale && !running && !closed) void build().catch(() => {});
    // The first request (or one after a failed first build) waits for the index.
    const ready = built ? Promise.resolve() : build().then(() => undefined);
    ready.then(
      () => {
        const file = files.get(path);
        if (!file) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
          res.end(`No dev search file ${path}`);
          return;
        }
        res.writeHead(200, {
          "content-type": TYPES[path.slice(path.lastIndexOf(".") + 1)] ?? "application/octet-stream",
          "content-length": file.byteLength,
          "cache-control": "no-cache",
        });
        res.end(req.method === "HEAD" ? undefined : file);
      },
      (error: unknown) => {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache" });
        res.end(`Dev search index failed: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
  };
  return {
    handle,
    invalidate,
    build,
    close: () => {
      closed = true;
    },
  };
}

/** Route shape of the generated `.rivet/entry.server.tsx` the pages are enumerated from. */
interface DevRoute {
  /** Route file below the routes dir without extension (`(docs)/learn/signals`, `api/[...symbol]`, `index`). */
  id?: string;
  pattern: string;
  page?: boolean;
  server?: () => Promise<{ entries?: () => unknown; prerender?: boolean } | undefined>;
}

/**
 * Route ids whose pages `changed` files can alter, or `"all"`. Only route modules (`<routesDir>/<id>.tsx`)
 * and content Markdown are narrow: a page Markdown file alters pages only through its generated route
 * module (its own change) and shared generated files (`src/generated/*`, which count as "all").
 */
export function changedRoutes(changed: ReadonlySet<string> | "all", root: string, ids: ReadonlySet<string>, routesDir = "src/routes"): Set<string> | "all" {
  if (changed === "all") return "all";
  const routes = new Set<string>();
  for (const file of changed) {
    const at = relative(root, file).split(sep).join("/");
    if (/^content\/(?:.*\/)?[^_/][^/]*\.md$/.test(at)) continue;
    const id = at.startsWith(routesDir + "/") ? at.slice(routesDir.length + 1).replace(/\.[cm]?[jt]sx?$/, "") : undefined;
    if (id === undefined || !ids.has(id)) return "all";
    routes.add(id);
  }
  return routes;
}

/**
 * The pages the static build prerenders (static routes + `serverEntries()`, as `@rivetjs/router/static`
 * `prerender` enumerates them), rendered by the running dev server over HTTP. Rendered HTML is kept per
 * page: a rebuild re-renders only the pages of changed route modules (`changedRoutes`) and new pages,
 * the rest come from the previous run (apps/docs ≈ 35 MB, cdk-docs ≈ 150 MB of HTML held).
 */
export function devServerPages(server: ViteDevServer, options: { concurrency?: number; outDir?: string; routesDir?: string } = {}): DevSearchSource {
  /** Path → HTML of the last successful render. */
  let rendered = new Map<string, string>();
  return async (add, changed) => {
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("docs search: the dev server is not listening");
    const host =
      address.family === "IPv6" ? `[${address.address === "::" ? "::1" : address.address}]` : address.address === "0.0.0.0" ? "127.0.0.1" : address.address;
    const origin = `${server.config.server.https ? "https" : "http"}://${host}:${address.port}`;
    const entry = (await server.ssrLoadModule("/" + (options.outDir ?? ".rivet") + "/entry.server.tsx")) as { routes: readonly DevRoute[] };
    const paths: string[] = [];
    /** Paths to render again (the rest reuse `rendered`). */
    const render = new Set<string>();
    const scope = changedRoutes(
      changed,
      resolve(server.config.root),
      new Set(entry.routes.flatMap((route) => (route.id ? [route.id] : []))),
      options.routesDir,
    );
    for (const route of entry.routes) {
      if (!route.page) continue;
      const module = await route.server?.();
      const dynamic = /[:*]/.test(route.pattern);
      if (!(module?.prerender ?? (!dynamic || module?.entries !== undefined))) continue;
      const sets = dynamic ? [...(((await module?.entries?.()) as Iterable<Record<string, string>> | undefined) ?? [])] : [{}];
      for (const params of sets) {
        const path = fillPattern(route.pattern, params);
        if (paths.includes(path)) continue;
        paths.push(path);
        if (scope === "all" || (route.id !== undefined && scope.has(route.id)) || !rendered.has(path)) render.add(path);
      }
    }
    const failed: string[] = [];
    const next = new Map<string, string>();
    let at = 0;
    const worker = async () => {
      while (at < paths.length) {
        const path = paths[at++]!;
        let html = render.has(path) ? undefined : rendered.get(path);
        if (html === undefined) {
          const response = await fetch(origin + path, { headers: { accept: "text/html" } });
          html = await response.text();
          if (response.status !== 200) {
            failed.push(`${path} (${response.status})`);
            continue;
          }
        }
        next.set(path, html);
        // The build's index URLs: `/a/` (prerendered to `a/index.html`).
        await add({ url: path.endsWith("/") ? path : path + "/", html });
      }
    };
    await Promise.all(Array.from({ length: options.concurrency ?? 8 }, worker));
    // Only now: a failed run leaves the previous renders (and the index asks for "all" next time anyway).
    rendered = next;
    if (changed !== "all") server.config.logger.info(`search: re-rendered ${render.size} of ${paths.length} pages`, { timestamp: true });
    if (failed.length)
      server.config.logger.warn(`docs search: ${failed.length} page(s) not indexed: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ", …" : ""}`);
  };
}

/** Dirs whose changes never alter rendered pages. */
const IGNORED = /(?:^|[\\/])(?:node_modules|dist|\.artifacts|\.rivet)(?:[\\/]|$)/;

/** Vite plugin (dev only): `/pagefind/*` from an in-memory index of the dev-rendered pages. */
export function docsDevSearch(): Plugin {
  return {
    name: "rivet-docs-dev-search",
    apply: "serve",
    configureServer(server) {
      const root = resolve(server.config.root);
      const index = devSearchIndex(devServerPages(server), { log: (message) => server.config.logger.info(message, { timestamp: true }) });
      // Before Vite's own middlewares: `/pagefind/pagefind.js` is not a module for Vite to transform.
      server.middlewares.use("/pagefind", index.handle);
      // App sources (content, generated routes, components, config) change the rendered pages.
      const changed = (file: string) => {
        const at = relative(root, resolve(file));
        if (!at.startsWith("..") && !at.startsWith(sep) && !IGNORED.test(at)) index.invalidate(file);
      };
      server.watcher.on("change", changed);
      server.watcher.on("add", changed);
      server.watcher.on("unlink", changed);
      server.httpServer?.once("close", index.close);
    },
  };
}
