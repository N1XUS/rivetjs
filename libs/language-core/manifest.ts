// `.rivet/editor.json` lookup: the nearest one above a file (the Vite root), re-read when it changes.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { EditorManifest, EditorRoute } from "@rivetjs/compiler/editor";

export type { EditorManifest, EditorRoute };

export interface ProjectManifest {
  /** Directory holding `.rivet/` (Vite root); module ids are relative to it. */
  root: string;
  manifest: EditorManifest;
}

const MANIFEST = join(".rivet", "editor.json");

export class ManifestCache {
  #files = new Map<string, { mtime: number; value: ProjectManifest | null }>();

  /** Nearest manifest at or above `file`'s directory (null: none). Stats each level (cheap; picks up
   * a manifest written after the editor started). */
  find(file: string): ProjectManifest | null {
    for (let dir = dirname(file); ; dir = dirname(dir)) {
      const value = this.#read(join(dir, MANIFEST), dir);
      if (value) return value;
      if (dirname(dir) === dir) return null;
    }
  }

  #read(path: string, root: string): ProjectManifest | null {
    let mtime: number;
    try {
      mtime = statSync(path).mtimeMs;
    } catch {
      this.#files.delete(path);
      return null;
    }
    const cached = this.#files.get(path);
    if (cached && cached.mtime === mtime) return cached.value;
    let value: ProjectManifest | null = null;
    try {
      const manifest = JSON.parse(readFileSync(path, "utf8")) as EditorManifest;
      if (manifest && manifest.version === 1) value = { root, manifest };
    } catch {}
    this.#files.set(path, { mtime, value });
    return value;
  }
}

/** Root-relative posix module id (what `rivet()` uses for resume symbol ids). */
export const moduleId = (root: string, file: string): string => relative(root, file).split(sep).join("/");

const VITE_CONFIGS = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"];

/** Nearest directory with a Vite config at or above `file`'s directory (an app root), else null. */
export function viteRoot(file: string): string | null {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (VITE_CONFIGS.some((name) => existsSync(join(dir, name)))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

export interface ManifestStatus {
  /** `missing`: no (readable) `.rivet/editor.json`; `stale`: the Vite config or the routes changed after it was written. */
  status: "ok" | "missing" | "stale";
  /** Why it is stale (root-relative path that changed). */
  reason?: string;
}

/** Whether an app root's `.rivet/editor.json` reflects its current Vite config and routes. Every Vite
 * config resolution (`vite`, `vite build`, `rivet sync`) rewrites or touches the manifest, so it is
 * stale when the config file, or a directory under the routes directory (a route added, removed or
 * renamed: the directory's mtime changes), is newer. */
export function manifestStatus(root: string): ManifestStatus {
  const path = join(root, MANIFEST);
  let written: number, manifest: EditorManifest;
  try {
    written = statSync(path).mtimeMs;
    manifest = JSON.parse(readFileSync(path, "utf8")) as EditorManifest;
    if (manifest?.version !== 1) return { status: "missing" };
  } catch {
    return { status: "missing" };
  }
  const newer = (file: string): boolean => {
    try {
      return statSync(file).mtimeMs > written;
    } catch {
      return false;
    }
  };
  const config = VITE_CONFIGS.map((name) => join(root, name)).find(newer);
  if (config) return { status: "stale", reason: relative(root, config) };
  if (manifest.routesDir) {
    const dirs = [join(root, manifest.routesDir)];
    for (let dir; (dir = dirs.pop());) {
      if (newer(dir)) return { status: "stale", reason: relative(root, dir).split(sep).join("/") + "/" };
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) dirs.push(join(dir, entry.name));
      } catch {}
    }
  }
  return { status: "ok" };
}
