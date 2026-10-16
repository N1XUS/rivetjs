// Brand gate (DEBRAND 2026-10-12, replaces the upstream heading-drift test): user-facing ui-docs text never names the
// upstream project. Allowed: `content/start/licenses.md` (the one attribution page) and per-file license headers of
// ported demo sources (their first lines). Covers pages, nav, site / API config, example metadata and demo code shown
// on the pages (comments included: the source is displayed), and the site's own sources `src/**` (every code line: no ported
// headers there; generated files and internal CLAUDE.md notes excluded).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "vitest";

const APP = resolve(import.meta.dirname, "..");
const NAME = /hero\s*ui/i;
const ALLOWED = new Set(["content/start/licenses.md"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(md|ts|tsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

/** Lines naming the upstream project, minus a ported source's license header (comment lines at the top). */
function hits(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  let header = /\.(tsx?|css)$/.test(file);
  const found: string[] = [];
  lines.forEach((line, i) => {
    if (header && /^\s*(\/\/|\/\*|\*)/.test(line)) return;
    header = false;
    if (NAME.test(line)) found.push(`${relative(APP, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
  return found;
}

test("user-facing ui-docs text names no upstream project outside start/licenses", () => {
  const files = [
    ...walk(join(APP, "content")),
    ...walk(join(APP, "examples")).filter((f) => !f.includes(`${join("examples", "_assets")}`)),
    join(APP, "site.config.ts"),
    join(APP, "api.config.ts"),
  ].filter((f) => !ALLOWED.has(relative(APP, f)));
  assert.deepEqual(files.flatMap(hits), []);
});

test("ui-docs site sources (src/**, generated excluded) name no upstream project", () => {
  const files = walk(join(APP, "src")).filter(
    (f) => !f.includes(join("src", "generated")) && !f.includes(join("src", "routes", "(docs)")) && !f.endsWith(".md"),
  );
  const found = files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, i) => (NAME.test(line) ? [`${relative(APP, file)}:${i + 1}: ${line.trim().slice(0, 120)}`] : [])),
  );
  assert.deepEqual(found, []);
});
