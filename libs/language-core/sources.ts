// Source packages (`"rivet": { "source": true }` in package.json, e.g. @rivetjs/cdk) a module imports,
// resolved through node_modules from its directory; the compiler's `sourcePackages` option (same rule
// as the Vite plugin), so editor resume sites match the build.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const cache = new Map<string, string | null>(); // "<dir>\0<package>" → source package name

export function sourcePackagesOf(fileName: string, text: string): string[] {
  const found = new Set<string>();
  for (const [, specifier = ""] of text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'./][^"']*)["']/g)) {
    const name = specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
    const key = dirname(fileName) + "\0" + name;
    let hit = cache.get(key);
    if (hit === undefined) {
      hit = null;
      for (let dir = dirname(fileName); ; dir = dirname(dir)) {
        const file = join(dir, "node_modules", name, "package.json");
        if (existsSync(file)) {
          try {
            const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; rivet?: { source?: boolean } };
            hit = pkg.name && pkg.rivet?.source === true ? pkg.name : null;
          } catch {}
          break;
        }
        if (dirname(dir) === dir) break;
      }
      cache.set(key, hit);
    }
    if (hit) found.add(hit);
  }
  return [...found].sort();
}
