// routerUsage: scans the app's sources only (never build output) and tolerates files vanishing mid-walk.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { routerUsage } from "../build/vite.ts";

const uses = `import { navigate } from "@rivetjs/router/client";\nnavigate("/x");\n`;

test("routerUsage skips build output (dist, dist-<lane>, outDir) and entries that vanish (ENOENT)", async () => {
  const app = await mkdtemp(join(tmpdir(), "rivet-usage-"));
  try {
    await mkdir(join(app, "src/routes"), { recursive: true });
    await writeFile(join(app, "src/routes/index.tsx"), "export default () => <p />;\n");
    // A source file named like an output dir is still a source.
    await writeFile(join(app, "src/dist-info.ts"), `import "@rivetjs/router";\nexport const p = "useParams";\nuseParams;\n`);
    for (const dir of ["dist", "dist-lane-a", "dist.old", "out", ".rivet"]) {
      await mkdir(join(app, dir, "assets"), { recursive: true });
      await writeFile(join(app, dir, "assets", "chunk.js"), uses);
    }
    // Another build removing its output mid-walk: a listed file that is gone when read.
    await symlink(join(app, "dist-lane-b", "gone.js"), join(app, "src", "vanished.ts"));
    const usage = await routerUsage(app, { exclude: ["out"] });
    assert.equal(usage.navigate, false);
    assert.equal(usage.params, true);
    // Without the exclude, a custom outDir is an ordinary folder.
    assert.equal((await routerUsage(app)).navigate, true);
  } finally {
    await rm(app, { recursive: true, force: true });
  }
});
