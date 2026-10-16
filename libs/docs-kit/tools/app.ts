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
   * Lean pages (URL paths, e.g. `["/"]`): no code runs before the first interaction — no idle code highlighter
   * (their code is coloured at build time: fragments), no `/` / Ctrl+K search shortcut listener (the search button
   * still works), no idle background prefetch (`preload.background: 0`). Only the resume loader ships up front.
   */
  leanPages?: readonly string[];
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
