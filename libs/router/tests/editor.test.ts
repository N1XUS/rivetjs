import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateRoutes } from "../build/vite.ts";

test("generateRoutes records route ids, patterns and page files for editors (.rivet/editor.json)", async () => {
  const root = await mkdtemp(join(tmpdir(), "rivet-editor-routes-"));
  try {
    await mkdir(join(root, "src/routes/items"), { recursive: true });
    for (const file of ["index.tsx", "items/[id].tsx", "items/[id].server.ts", "_layout.tsx"])
      await writeFile(join(root, "src/routes", file), "export default () => null;\n");
    await generateRoutes(root);
    const manifest = JSON.parse(await readFile(join(root, ".rivet/editor.json"), "utf8"));
    assert.equal(manifest.routesDir, "src/routes");
    // Match order (the router's), layouts and server modules excluded.
    assert.deepEqual(manifest.routes, [
      { id: "items/[id]", pattern: "/items/:id", file: "src/routes/items/[id].tsx" },
      { id: "index", pattern: "/", file: "src/routes/index.tsx" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
