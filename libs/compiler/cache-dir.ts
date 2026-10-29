// Where Rivet's persistent build caches live (INCR-BUILD): one root outside every project. Dependency-free so any build
// module (compiler, images, router, docs-kit) can import it without loading the compiler.
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Root of Rivet's persistent build caches (compiler answers `compile/`, comptime results `comptime/`, `?image` / `?svg`
 * outputs `images/`, router brotli sizes `css-brotli.json`, docs-kit page passes + example checks `docs/`):
 * env `RIVET_CACHE_DIR`, else `<os tmpdir>/rivet-cache`. Deliberately OUTSIDE the project: Tailwind's automatic source
 * detection scans the app directory (its `node_modules/.vite` included), so cache files there turned compiled code /
 * class strings into extra utilities (INCR-BUILD-01 regression: starter-ui `.ring`, `[rivet:cdk]`). Entries are keyed by
 * everything they depend on, so projects sharing the root never see each other's results.
 */
export function rivetCacheDir(): string {
  return process.env.RIVET_CACHE_DIR || join(tmpdir(), "rivet-cache");
}
