// Persistent memo of the per-page build passes (INCR-BUILD): `highlight-pages.ts` tokens per code block and
// `critical-css.ts` per page. Both are pure functions of their input text + the tool version, so a hit is the same
// bytes a fresh run writes; keys are sha256 digests the caller builds from everything the result depends on
// (`digest`), entries carry what they read besides the key (critical CSS: the stylesheets' content hashes) and the
// caller re-checks it. One gzip file per entry under `<rivetCacheDir()>/docs/<app hash>/<stage>/` (outside the
// app: Tailwind source detection scans the app dir, so cache files inside it would become utilities); hits touch the file,
// `prune` drops least recently used entries beyond the size cap. Off: `docs-kit build --no-cache` or env
// `DOCS_KIT_BUILD_CACHE=0`.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { rivetCacheDir } from "@rivetjs/compiler";

/** Bump when an entry's layout changes. */
const FORMAT = 1;
/** Cache root of the app at `root`: `<rivetCacheDir()>/docs/<sha of the app path>`. */
export const buildCacheRoot = (root: string) => join(rivetCacheDir(), "docs", digest(resolve(root)).slice(0, 16));
/** Size cap per stage (MB; env `DOCS_KIT_BUILD_CACHE_MB`). */
export const BUILD_CACHE_MB = 256;

export interface BuildCache {
  /** The entry stored under `key` (a `digest`), or undefined. */
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  /** Drop least recently used entries while the stage is over its cap; returns how many went. */
  prune(): number;
  readonly hits: number;
  readonly misses: number;
}

/** sha256 hex of the parts (NUL-separated). */
export function digest(...parts: (string | number | undefined)[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(String(part ?? "\u0001")).update("\0");
  return hash.digest("hex");
}

/** sha256 hex of source files (tool versions: a changed pass never reads an old entry). */
export function sourceDigest(...files: (string | URL)[]): string {
  const hash = createHash("sha256").update(String(FORMAT));
  for (const file of files) hash.update(readFileSync(file)).update("\0");
  return hash.digest("hex");
}

/** Whether page caches are on (env `DOCS_KIT_BUILD_CACHE=0` turns them off). */
export const buildCacheOn = () => process.env.DOCS_KIT_BUILD_CACHE !== "0";

/** The `stage` store of the app at `root`, entries scoped to `version` (a `sourceDigest` of the pass). */
export function buildCache(root: string, stage: string, version: string, maxMB = Number(process.env.DOCS_KIT_BUILD_CACHE_MB) || BUILD_CACHE_MB): BuildCache {
  const dir = join(buildCacheRoot(root), stage);
  const fileOf = (key: string) => {
    const k = digest(version, key);
    return join(dir, k.slice(0, 2), k.slice(2) + ".gz");
  };
  let hits = 0,
    misses = 0;
  return {
    get hits() {
      return hits;
    },
    get misses() {
      return misses;
    },
    get(key) {
      const file = fileOf(key);
      try {
        const value = gunzipSync(readFileSync(file)).toString("utf8");
        hits++;
        try {
          const now = new Date();
          utimesSync(file, now, now);
        } catch {}
        return value;
      } catch {
        misses++;
        return undefined;
      }
    },
    set(key, value) {
      const file = fileOf(key);
      try {
        mkdirSync(join(file, ".."), { recursive: true });
        const temp = file + "." + process.pid + ".tmp";
        writeFileSync(temp, gzipSync(value, { level: 1 }));
        renameSync(temp, file);
      } catch {}
    },
    prune() {
      const max = maxMB * 1024 * 1024;
      const files: { path: string; size: number; time: number }[] = [];
      let total = 0;
      let subs: string[];
      try {
        subs = readdirSync(dir);
      } catch {
        return 0;
      }
      for (const sub of subs)
        for (const name of (() => {
          try {
            return readdirSync(join(dir, sub));
          } catch {
            return [];
          }
        })()) {
          const path = join(dir, sub, name);
          try {
            const stat = statSync(path);
            files.push({ path, size: stat.size, time: stat.mtimeMs });
            total += stat.size;
          } catch {}
        }
      if (total <= max) return 0;
      files.sort((a, b) => a.time - b.time);
      let removed = 0;
      for (const file of files) {
        if (total <= max * 0.8) break;
        try {
          unlinkSync(file.path);
          total -= file.size;
          removed++;
        } catch {}
      }
      return removed;
    },
  };
}
