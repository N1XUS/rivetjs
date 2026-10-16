// Plan 2 Task 1: resumed modules importing a source package through a `.ts` barrel register the barrel's `.tsx` leaves.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { barrelLeaves } from "../vite.ts";

test("barrelLeaves: follows export-from chains through .ts files and returns .tsx leaves, sorted, once", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-barrel-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "index.ts"), `export * from "./src/a.ts";\nexport { b } from "./src/b.tsx";\n`);
  writeFileSync(join(dir, "src/a.ts"), `export * as dom from "./tags.tsx";\nexport * from "./a2.ts";\n`);
  writeFileSync(join(dir, "src/a2.ts"), `export * from "./a.ts"; // cycle\nexport const x = 1;\n`);
  writeFileSync(join(dir, "src/tags.tsx"), `export const div = () => null;\n`);
  writeFileSync(join(dir, "src/b.tsx"), `export const b = () => null;\n`);
  const leaves = barrelLeaves(join(dir, "index.ts")).map((f) => f.slice(dir.length + 1));
  assert.deepEqual(leaves, ["src/b.tsx", "src/tags.tsx"]);
});

test("barrelLeaves: a .tsx entry is its own leaf; missing/external specifiers are ignored", () => {
  const dir = mkdtempSync(join(tmpdir(), "rv-barrel-"));
  writeFileSync(join(dir, "e.tsx"), `export const e = 1;\n`);
  writeFileSync(join(dir, "f.ts"), `export * from "@rivetjs/runtime";\nexport * from "./missing.ts";\n`);
  assert.deepEqual(barrelLeaves(join(dir, "e.tsx")), [join(dir, "e.tsx")]);
  assert.deepEqual(barrelLeaves(join(dir, "f.ts")), []);
});
