// Wire a server entry to its client build's manifests (shared by `loadBuild` and the fetch adapter;
// web-standard only: the fetch bundle inlines these manifests at build time).
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { InlineStyleManifest } from "../server/inline-styles.ts";
import type { AppConfig, GeneratedEntry } from "../server/app.ts";
import type { AppHandler } from "../server/handler.ts";

export interface ViteManifestRecord {
  file: string;
  src?: string;
  isEntry?: boolean;
  css?: string[];
}
/** One client build: URL base, resume manifest and Vite manifest. */
export interface ClientBuild {
  readonly base: string;
  readonly manifest: ResumeManifest;
  readonly vite: Readonly<Record<string, ViteManifestRecord>>;
}
/** A client build's manifests (one per locale with i18n), as `loadBuild` reads and `fetch.js` inlines them. */
export interface BuildManifests {
  readonly clients: readonly ClientBuild[];
  /** i18n locales in compiler variant order, one client build each. */
  readonly locales?: readonly string[];
  /** `.vite/rivet-route-css.json` of the first client build, when written. */
  readonly routeStyles?: Readonly<Record<string, string[]>>;
  /** `.vite/rivet-inline-css.json` of the first client build (the sheets pages may write inline), when written. */
  readonly inlineStyles?: InlineStyleManifest;
}
export type BuildConfig = Pick<AppConfig, "stream" | "onError" | "maxBody" | "csp" | "preload" | "routeRules" | "routeCache" | "renderCache" | "earlyHints"> & {
  /** i18n: error-page locale when the request has none settled (`createApp` `i18n.resolve`). */
  readonly resolveLocale?: (request: Request) => string | undefined | Promise<string | undefined>;
};

/** Create the app handler from the server bundle's own `createApp` (one runtime instance). */
export function assemble(entry: GeneratedEntry, build: BuildManifests, config: BuildConfig = {}, where = "server entry"): AppHandler {
  const { clients, locales, routeStyles, inlineStyles } = build;
  const { resolveLocale, ...app } = config;
  const first = clients[0]!;
  // App entries only (router `styles`, CSR app): the compiler's chunks are entries too (derived boundary modules, a
  // route page among them, the runtime, the builtins), their CSS is linked per route.
  const resume = resumeChunks(first.manifest);
  const styles = Object.values(first.vite)
    .filter((record) => record.isEntry && !resume.has(first.base + record.file))
    .flatMap((record) => (record.file.endsWith(".css") ? [record.file] : (record.css ?? [])))
    .map((file) => first.base + file);
  const createApp = entry.createApp;
  if (!createApp) throw new TypeError(`${where} does not export createApp`);
  const i18n = locales?.length
    ? {
        i18n: {
          locales,
          manifests: Object.fromEntries(locales.map((locale, i) => [locale, clients[i]!.manifest])),
          ...(resolveLocale ? { resolve: resolveLocale } : {}),
        },
      }
    : {};
  return createApp({
    ...app,
    entry,
    manifest: first.manifest,
    styles: [...new Set(styles)],
    ...(routeStyles ? { routeStyles } : {}),
    ...(inlineStyles ? { inlineStyles } : {}),
    ...i18n,
  });
}

/** URLs of the compiler's entry chunks in a client build (boundary chunks, runtime, builtins, island facades, lite entries + runtime). */
export function resumeChunks(manifest: ResumeManifest): Set<string> {
  const urls = new Set<string>([
    ...Object.values(manifest.symbols ?? {}),
    ...Object.values(manifest.islands ?? {}),
    ...Object.values(manifest.lite?.symbols ?? {}),
  ]);
  if (manifest.runtime) urls.add(manifest.runtime);
  if (manifest.lite) urls.add(manifest.lite.runtime);
  if (manifest.builtins) urls.add(manifest.builtins);
  return urls;
}
