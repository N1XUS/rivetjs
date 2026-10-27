// One docs site = one app root holding `site.config.ts` (site-wide values, also bundled into pages)
// and, for the API reference, `api.config.ts` (documented entry points and package groups; build and
// server only). Tools load the app once (`loadApp(root)`) and read it through `app()`.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Values every page, tool and example of one site share (`site.config.ts` → `export const site`). */
export interface DocsSite {
  /** Project name shown in the title bar, headings and page titles. */
  name: string;
  /** One-line pitch (home hero, default meta description). */
  tagline: string;
  /** Public origin of the docs (canonical URLs). */
  origin: string;
  /** Sibling docs sites for `site:<name>/<path>` links in content (name → origin; env-overridable like `origin`). */
  sites?: Readonly<Record<string, string>>;
  /** Source repository (edit links, issues, API source links). */
  repo: string;
  /** Branch or tag the source links point at. */
  repoRef: string;
  /** npm version or dist-tag that starters install. */
  packageVersion: string;
  /** Version label in the top bar. */
  version: string;
  /**
   * Lean pages (URL paths, e.g. `["/"]`, trailing slash ignored): no generic idle code highlighter (colour code at
   * build time), no `/` / Ctrl+K search shortcut listener (the search button still works), and no runtime fetch-ahead
   * (`preload.lean`). Page-owned visible effects and client triggers still load and run normally. An example frame page
   * (`/examples/<id>/frame/`) may be listed too: only the fetch-ahead part applies (nothing loads before its first intent).
   */
  leanPages?: readonly string[];
  /**
   * JS meters (`frame-theme.ts` `FRAME_JS_METER` / `PARENT_FRAME_JS_METER`): page path → example ids whose frame page
   * reports the JavaScript files it fetched (its own resource timing) to that page, e.g. `{ "/": ["ui-counter"] }`. Only
   * those frame pages carry the reporter and only those pages the receiver (inline, nothing fetched); the page shows the
   * numbers in the element named by the iframe's `data-js-meter` attribute.
   */
  frameMeters?: Readonly<Record<string, readonly string[]>>;
  /**
   * Diagnostic code reference (`tools/errors.ts`): `content/errors/index.md` + one page per code of
   * `libs/compiler/codes.json` (prose from `libs/language-core/explain.json`), committed, refreshed by every
   * prepare / build; `docs-kit errors <app> --check` fails on stale pages. The framework site only.
   */
  errorPages?: boolean;
  /** Critical CSS (tools/critical-css.ts) of the built pages. */
  criticalCss?: {
    /**
     * Selectors of DOM this site's pages add in the browser before their full stylesheets may have loaded (client-only
     * components, overlays of the site's own components): their names count as present on every page, so their rules
     * are inlined. docs-kit's own (`CLIENT_SELECTORS`: shell overlays, cdk overlay layer, kit Transition, highlighter…)
     * always apply.
     */
    extraSelectors?: readonly string[];
  };
}

export type RunsOn = "server" | "browser" | "both" | "build";

/** One documented entry point: import specifier → source file (relative to libs/) and where it runs. */
export interface ApiEntryConfig {
  entry: string;
  file: string;
  runsOn: RunsOn;
  summary: string;
}

/** Package group on the API index page. */
export interface ApiPackage {
  name: string;
  title: string;
  summary: string;
}

/** `api.config.ts` of a site. */
export interface DocsApiConfig {
  entries: ApiEntryConfig[];
  packages: ApiPackage[];
}

export interface DocsApp {
  /** App root (the directory with `site.config.ts`, `content/`, `examples/`, `src/`). */
  root: string;
  /** Repository root. */
  repo: string;
  site: DocsSite;
  api: DocsApiConfig;
  /** Starter templates (StackBlitz starters, example bases). */
  templates: string;
}

let current: DocsApp | undefined;

/** Load the site at `root` (cached per root) and make it the current app. */
export async function loadApp(root: string): Promise<DocsApp> {
  root = resolve(root);
  if (current?.root === root) return current;
  const { site } = (await import(pathToFileURL(resolve(root, "site.config.ts")).href)) as { site: DocsSite };
  const apiFile = resolve(root, "api.config.ts");
  const api: DocsApiConfig = existsSync(apiFile) ? ((await import(pathToFileURL(apiFile).href)) as DocsApiConfig) : { entries: [], packages: [] };
  const repo = resolve(root, "../..");
  current = { root, repo, site, api: { entries: api.entries, packages: api.packages }, templates: resolve(repo, "templates") };
  return current;
}

/** The current app (after `loadApp`). */
export function app(): DocsApp {
  if (!current) throw new Error("docs-kit: no app loaded (call loadApp(root) first)");
  return current;
}
