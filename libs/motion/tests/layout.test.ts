// T12: `layout` / `layoutId` cost nothing in bundles that never import `@rivetjs/motion/layout` (esbuild metafile: files with bytes in the output).
import { test } from "vitest";
import assert from "node:assert/strict";
import { build } from "esbuild";

const root = new URL("../", import.meta.url).pathname;
const inputs = async (contents: string) =>
  Object.entries(
    Object.values(
      (
        await build({
          stdin: { contents, resolveDir: root, loader: "tsx" },
          bundle: true,
          write: false,
          metafile: true,
          jsx: "preserve",
          format: "esm",
          platform: "browser",
          conditions: ["browser", "production"],
          logLevel: "error",
          external: [
            "motion",
            "motion/*",
            "@rivetjs/runtime",
            "@rivetjs/runtime/*",
            "@rivetjs/reactivity",
            "@rivetjs/router",
            "@rivetjs/router/*",
            "@rivetjs/kit/*",
          ],
        })
      ).metafile!.outputs,
    )[0]!.inputs,
  )
    .filter(([, input]) => input.bytesInOutput > 0)
    .map(([file]) => file);

test("Motion.div without /layout: no layout engine, no cdk FLIP core in the bundle", async () => {
  const files = await inputs('import { Motion } from "./index.tsx"; export const d = Motion.div;');
  assert.ok(
    files.some((f) => f.endsWith("layout-hook.ts")),
    "the hook object (empty) is the only layout part",
  );
  assert.ok(!files.some((f) => f.endsWith("layout-engine.ts") || f.includes("cdk/flip") || f.includes("cdk/motion")), files.join("\n"));
});

test("LayoutGroup brings the engine (its hook registration) and the cdk FLIP core", async () => {
  const files = await inputs('import { LayoutGroup } from "./layout.tsx"; export { LayoutGroup };');
  assert.ok(files.some((f) => f.endsWith("layout-engine.ts")));
  assert.ok(files.some((f) => f.includes("cdk/flip")));
});

test('a bare `import "@rivetjs/motion/layout"` keeps the engine (package sideEffects): layoutId works', async () => {
  const files = await inputs('import "@rivetjs/motion/layout"; import { Motion } from "@rivetjs/motion"; export const d = Motion.div;');
  assert.ok(
    files.some((f) => f.endsWith("layout-engine.ts")),
    files.join("\n"),
  );
});

test("Motion only (no /layout import): package sideEffects keep nothing from layout", async () => {
  const files = await inputs('import { Motion } from "@rivetjs/motion"; export const d = Motion.div;');
  assert.ok(!files.some((f) => f.endsWith("layout-engine.ts") || f.endsWith("layout.tsx")), files.join("\n"));
});
