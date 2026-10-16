// `.rivet/editor.json`: what editors (language service, `rivet check`) cannot read from source —
// which modules compile in resume mode and the file routes. Written by the Vite plugins; never
// executed, never needed by builds. Every Vite config resolution writes it (`rivet sync` too), so its
// mtime is when the config was last evaluated: `rivet-check` reports it stale when the Vite config
// or a routes directory changed after that.
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Root-relative manifest path. */
export const EDITOR_MANIFEST = ".rivet/editor.json";

export interface EditorRoute {
  id: string;
  /** Router pattern (`/items/:id`, `/docs/*rest`). */
  pattern: string;
  /** Root-relative page module. */
  file: string;
}

export interface EditorManifest {
  version: 1;
  /** Root-relative modules compiled in resume mode (sorted). */
  resumeModules?: string[];
  /** `resume.preload.rules` (RegExp as `{ regex, flags }`). */
  preloadRules?: { match: string | { regex: string; flags: string }; strategy: string }[];
  /** Root-relative routes directory. */
  routesDir?: string;
  routes?: EditorRoute[];
}

/** Merge `patch` into `<root>/.rivet/editor.json`; rewrites only when the contents change (else only
 * bumps its mtime). Returns whether the contents changed. */
export function updateEditorManifest(root: string, patch: Omit<EditorManifest, "version">): boolean {
  const path = resolve(root, EDITOR_MANIFEST);
  let current = "";
  let manifest: Omit<EditorManifest, "version"> = {};
  try {
    current = readFileSync(path, "utf8");
    const { version, ...rest } = JSON.parse(current) as EditorManifest;
    if (version === 1) manifest = rest;
  } catch {}
  const next = JSON.stringify({ version: 1, ...manifest, ...patch }, null, 2) + "\n";
  if (next === current) {
    const now = new Date();
    utimesSync(path, now, now);
    return false;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  return true;
}
