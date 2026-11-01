// Atomic writes for files several docs-kit processes update (the examples manifest, the example check cache, rebuild
// state: parallel `docs-kit examples <id>` runs and `serve` rebuilds write them). Readers see the old or the new
// contents, never a part.
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

let serial = 0;

/** Write `file` via a temporary sibling + rename: readers see the old or the new contents, never a part. */
export async function writeAtomic(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  // Unique per write (pid + counter + time): concurrent writers of one file in one process never share a temp.
  const temp = `${file}.${process.pid}.${(serial++).toString(36)}${Date.now().toString(36)}.tmp`;
  try {
    await writeFile(temp, contents);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}
