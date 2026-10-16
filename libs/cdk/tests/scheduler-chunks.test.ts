// `@rivetjs/cdk/scheduler` chunk graph: the modules a resumed page fetches before (or at) the first input import leaf
// modules only (cdk rule "Handler chunks import leaf modules", `libs/cdk/CLAUDE.md` Idle boot). Walks the static
// VALUE imports (type-only imports are erased; dynamic `import()` is a lazy chunk) from source:
// - `behaviour.ts` (every delegated month / time-grid handler chunk) never reaches `state.ts` / `intl.ts` (14 locale
//   tables), the layout engine or the lazy gesture chunks `drag.ts` / `select.ts`;
// - `keys-month.ts` / `keys-time-grid.ts` (the delegated keydown chunks) reach `keys.ts`, `behaviour.ts` and
//   `selection.ts` only — commits, labels and navigation go through the root context's actions;
// - `time-grid-client.tsx` (the time grid's load-time effects) never reaches `state.ts` / `intl.ts` / drag code.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cdk = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMPORT = /^\s*(import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/gm;

/** Static value imports of a module (`import type …`, `import { type A, type B }` and `export type …` skipped). */
function valueImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const [, , clause, spec] of source.matchAll(IMPORT)) {
    if (/^type\s/.test(clause!)) continue;
    const named = /^\{([^}]*)\}$/s.exec(clause!.trim());
    if (named && named[1]!.split(",").every((part) => !part.trim() || /^type\s/.test(part.trim()))) continue;
    out.push(spec!);
  }
  return out;
}

/** Repo-relative closure of `entry` inside `libs/cdk` (packages outside it are not followed). */
function closure(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    const key = file.slice(cdk.length + 1);
    if (seen.has(key)) return;
    seen.add(key);
    for (const spec of valueImports(file)) if (spec.startsWith(".")) visit(resolve(dirname(file), spec));
  };
  visit(resolve(cdk, entry));
  return seen;
}

describe("scheduler chunk graph", () => {
  it("the delegated handlers (behaviour.ts) import leaf modules only", () => {
    const graph = closure("scheduler/behaviour.ts");
    for (const heavy of ["scheduler/state.ts", "scheduler/intl.ts", "scheduler/layout.ts", "scheduler/dates.ts", "scheduler/drag.ts", "scheduler/select.ts"])
      expect(graph.has(heavy), heavy).toBe(false);
    expect([...graph].sort()).toEqual(["scheduler/behaviour.ts", "scheduler/selection.ts"]);
  });

  it("the delegated key handlers (keys-month.ts / keys-time-grid.ts) import leaf modules only", () => {
    for (const entry of ["scheduler/keys-month.ts", "scheduler/keys-time-grid.ts"]) {
      const graph = closure(entry);
      expect([...graph].sort(), entry).toEqual([entry, "scheduler/behaviour.ts", "scheduler/keys.ts", "scheduler/selection.ts"].sort());
    }
  });

  it("the time grid's client effects (time-grid-client.tsx) never pull state / intl / drag code", () => {
    const graph = closure("scheduler/time-grid-client.tsx");
    for (const heavy of ["scheduler/state.ts", "scheduler/intl.ts", "scheduler/layout.ts", "scheduler/drag.ts", "scheduler/select.ts", "scheduler/pointer.ts"])
      expect(graph.has(heavy), heavy).toBe(false);
  });
});
