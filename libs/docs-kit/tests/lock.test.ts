// `writeAtomic`: readers see the old or the new contents; concurrent writers of one file in one process never share a temp.
import { strict as assert } from "node:assert";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { writeAtomic } from "../tools/lock.ts";

test("writeAtomic: concurrent writes of one file all land (last wins), no temp left behind", async () => {
  const dir = await mkdtemp(join(tmpdir(), "docs-kit-lock-"));
  try {
    const file = join(dir, "sub", "manifest.json");
    await Promise.all(Array.from({ length: 8 }, (_, i) => writeAtomic(file, String(i))));
    assert.match(await readFile(file, "utf8"), /^[0-7]$/);
    assert.deepEqual(await readdir(join(dir, "sub")), ["manifest.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
