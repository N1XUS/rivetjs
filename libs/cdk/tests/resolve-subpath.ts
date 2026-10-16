// Resolve a `@rivetjs/cdk/<subpath>` specifier to its source file through the package's `exports`
// map (exact keys first, then `*` patterns), so the test harnesses follow the same mapping as
// Node / Vite (`./id` → `utils/id.ts`, `./overlay-ref` → `overlay-service/overlay-ref.ts`, …).
import { readFileSync } from "node:fs";

type Target = string | { default?: string; types?: string };
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { exports: Record<string, Target> };
const file = (target: Target | undefined): string | undefined => {
  const value = typeof target === "string" ? target : target?.default;
  return value?.replace(/^\.\//, "");
};

/** Source file (relative to libs/cdk) of the subpath, or `undefined` when no export matches. */
export function resolveCdkSubpath(subpath: string): string | undefined {
  const key = "./" + subpath;
  if (pkg.exports[key]) return file(pkg.exports[key]);
  for (const [pattern, target] of Object.entries(pkg.exports)) {
    const star = pattern.indexOf("*");
    if (star < 0) continue;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (key.startsWith(prefix) && key.endsWith(suffix) && key.length >= prefix.length + suffix.length) {
      const match = key.slice(prefix.length, key.length - suffix.length);
      return file(target)?.replace("*", match);
    }
  }
  return undefined;
}
