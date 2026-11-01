// Where Rivet's persistent build caches live (INCR-BUILD): one root outside every project. Dependency-free so any build
// module (compiler, images, router, docs-kit) can import it without loading the compiler.
import { mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const verified = new Set<string>();

/**
 * Root of Rivet's persistent build caches (compiler answers `compile/`, comptime results `comptime/`, `?image` / `?svg`
 * outputs `images/`, router brotli sizes `css-brotli.json`, docs-kit page passes + example checks `docs/`):
 * env `RIVET_CACHE_DIR`, else `<os tmpdir>/rivet-cache-<uid>` (`rivet-cache` where there are no uids). Deliberately
 * OUTSIDE the project: Tailwind's automatic source detection scans the app directory (its `node_modules/.vite`
 * included), so cache files there turned compiled code / class strings into extra utilities (INCR-BUILD-01 regression:
 * starter-ui `.ring`, `[rivet:cdk]`). Entries are keyed by everything they depend on, so projects sharing the root never
 * see each other's results. Cached entries are spliced into compiled output, so the default root is per user, created
 * `0700`, and refused (TypeError) when another user owns it or others can write it (a shared `/tmp` on a multi-user host:
 * cache poisoning).
 */
export function rivetCacheDir(): string {
  if (process.env.RIVET_CACHE_DIR) return process.env.RIVET_CACHE_DIR;
  const uid = process.getuid?.();
  if (uid === undefined) return join(tmpdir(), "rivet-cache");
  const dir = join(tmpdir(), "rivet-cache-" + uid);
  if (verified.has(dir)) return dir;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = statSync(dir);
  if (stat.uid !== uid || stat.mode & 0o022)
    throw new TypeError(`[rivet] build cache ${dir} is owned by another user or writable by others; remove it or set RIVET_CACHE_DIR to a private directory`);
  verified.add(dir);
  return dir;
}
