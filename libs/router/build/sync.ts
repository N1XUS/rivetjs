// `rivet sync`: write an app's generated `.rivet/` files (route types, generated app, editor
// manifest) without starting Vite. Resolves the app's own Vite config, so every plugin option
// (routes dir, resume modules, base, i18n…) applies exactly as in `vite` / `vite build`: the router
// plugin's `config` hook regenerates `.rivet/`, the compiler plugin's `configResolved` hook writes
// `.rivet/editor.json`. Run it before `tsc` / `rivet-check` on a fresh clone (`.rivet/` is gitignored).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface SyncOptions {
  /** App root (default the current directory). */
  root?: string;
  /** Vite config file (default: Vite's lookup in `root`). */
  configFile?: string;
  /** Vite mode (default `production`). */
  mode?: string;
}

export interface SyncResult {
  root: string;
  /** Vite config file used (undefined: none found, nothing generated). */
  configFile: string | undefined;
  /** The written editor manifest, or null when no Rivet plugin ran. */
  manifest: { resumeModules?: string[]; routesDir?: string; routes?: unknown[] } | null;
}

export async function sync({ root = process.cwd(), configFile, mode = "production" }: SyncOptions = {}): Promise<SyncResult> {
  const { resolveConfig } = await import("vite");
  const appRoot = resolve(root);
  // Resolved as the server build: it carries every locale (an `i18n()` client build needs RIVET_LOCALE, one per locale)
  // and generates the same `.rivet/` files.
  const config = await resolveConfig(
    { root: appRoot, mode, logLevel: "warn", build: { ssr: true }, ...(configFile ? { configFile: resolve(appRoot, configFile) } : {}) },
    "build",
    mode,
  );
  const manifest = await readFile(resolve(config.root, ".rivet/editor.json"), "utf8")
    .then((text) => JSON.parse(text) as SyncResult["manifest"])
    .catch(() => null);
  return { root: config.root, configFile: config.configFile, manifest };
}
