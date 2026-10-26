// Load a production build (`vite build` + `vite build --ssr`) into an app handler.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { InlineStyleManifest } from "../server/inline-styles.ts";
import type { AppConfig, GeneratedEntry } from "../server/app.ts";
import type { AppHandler } from "../server/handler.ts";
import { assemble, type BuildManifests, type ViteManifestRecord } from "./assemble.ts";

export interface LoadedBuild {
  readonly entry: GeneratedEntry;
  readonly handler: AppHandler;
  /** Built client directory (`<dist>/client`). */
  readonly client: string;
}

export interface LoadBuildOptions {
  /**
   * i18n: one client build per locale in `client/<locale>/` (base `/<locale>/`), in compiler variant
   * order. Pages use their locale's resume manifest; stylesheets come from the first locale's build.
   */
  readonly locales?: readonly string[];
  /** i18n: error-page locale when the request has none settled (e.g. `errorLocale(config)` from `@rivetjs/i18n/router`). */
  readonly resolveLocale?: (request: Request) => string | undefined | Promise<string | undefined>;
  /** URL base path of the client build (`/app`); `loadBuild` takes it from the server entry. */
  readonly base?: string;
}

/** Read the client build manifests of `<dist>/client` (per locale with i18n). */
export async function readManifests(dist: string, options: LoadBuildOptions = {}): Promise<BuildManifests> {
  const { locales, base = "" } = options;
  const root = resolve(dist);
  const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
  const dirs = locales?.length
    ? locales.map((locale) => ({ dir: "client/" + locale + "/", base: base + "/" + locale + "/" }))
    : [{ dir: "client/", base: base + "/" }];
  const clients = await Promise.all(
    dirs.map(async ({ dir, base }) => {
      const [manifest, vite] = await Promise.all([
        read<ResumeManifest>(dir + ".vite/rivet-resume.json"),
        read<Record<string, ViteManifestRecord>>(dir + ".vite/manifest.json"),
      ]);
      return { base, manifest, vite };
    }),
  );
  // Per-route CSS (route modules' stylesheets), when the client build wrote any.
  const routeStyles = await read<Record<string, string[]>>(dirs[0]!.dir + ".vite/rivet-route-css.json").catch(() => undefined);
  // Small stylesheets written inline (`rivetRouter({ inlineStylesheets })`), when the client build wrote any.
  const inlineStyles = await read<InlineStyleManifest>(dirs[0]!.dir + ".vite/rivet-inline-css.json").catch(() => undefined);
  return { clients, ...(locales?.length ? { locales } : {}), ...(routeStyles ? { routeStyles } : {}), ...(inlineStyles ? { inlineStyles } : {}) };
}

/** Import `<dist>/server/entry.server.js` and wire it to the client build's resume manifest and stylesheets. */
export async function loadBuild(
  dist: string,
  config: Pick<
    AppConfig,
    "stream" | "onError" | "maxBody" | "csp" | "preload" | "routeRules" | "routeCache" | "renderCache" | "incr" | "incrPartition" | "earlyHints"
  > = {},
  options: LoadBuildOptions = {},
): Promise<LoadedBuild> {
  const root = resolve(dist);
  const path = resolve(root, "server/entry.server.js");
  const entry = (await import(pathToFileURL(path).href)) as GeneratedEntry;
  const manifests = await readManifests(root, { ...options, base: options.base ?? entry.base ?? "" });
  // The server bundle carries its own `createApp`: the handler must share the app's runtime instance.
  const handler = assemble(entry, manifests, { ...config, ...(options.resolveLocale ? { resolveLocale: options.resolveLocale } : {}) }, path);
  return { entry, handler, client: resolve(root, "client") };
}
