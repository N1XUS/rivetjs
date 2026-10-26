// tailwind-merge on demand (ZERO UI-JS2): production browser builds start `tv.ts` with no merge and load it only from
// modules the compiler's class-override scan flags (`libs/compiler/class-merge.ts`). Census of ui's own modules +
// the join port (`cx.ts`) against upstream.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { cn, cx as upstreamCx } from "tailwind-variants";
import { classJoinDeclarations, classOverrideSites } from "../../compiler/class-merge.ts";
import { cx } from "../styles/src/utils/cx.ts";

const ui = fileURLToPath(new URL("..", import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "tests" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
const sources = [...walk(join(ui, "src")), ...walk(join(ui, "styles", "src"))];

test("census: of ui's own modules only the scheduler can hand a resolver an override tailwind-merge changes", () => {
  const joins = new Map<string, number[]>();
  for (const file of sources) for (const [name, args] of classJoinDeclarations(readFileSync(file, "utf8"))) joins.set(name, args);
  const flagged = sources
    .filter((file) => classOverrideSites(readFileSync(file, "utf8"), file, { merge: (value) => cn(value) as string, joins }).length > 0)
    .map((file) => relative(ui, file));
  assert.deepEqual(flagged, ["src/components/scheduler/scheduler.tsx"]);
});

test("utility cores: text-shimmer imports the merge provider itself", () => {
  const code = readFileSync(join(ui, "src/components/text-shimmer/text-shimmer.tsx"), "utf8");
  assert.match(code, /^import "\.\.\/\.\.\/\.\.\/styles\/src\/utils\/tv-merge\.ts";$/m);
});

test("cx port = tailwind-variants cx", () => {
  const cases: unknown[][] = [
    [],
    [""],
    ["a"],
    ["a", "b"],
    [" a  b ", "\tc\n"],
    ["a", null, undefined, false, 0, "b"],
    [["a", ["b", ["c"]]], "d"],
    [{ a: true, b: false, c: 1, d: 0 }],
    [["a", { b: true }], { c: null }],
    [1, 2n, "x"],
    [[], {}, ""],
  ];
  for (const args of cases)
    assert.equal(
      cx(...args),
      upstreamCx(...(args as never[])),
      JSON.stringify(args, (_, v) => (typeof v === "bigint" ? `${v}n` : v)),
    );
});
