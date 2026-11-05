import { readFile } from "node:fs/promises";

/**
 * Read `size` (default 16) files at a time, yielded in input order; a failed read throws when its turn comes, so the
 * caller's earlier errors (parse, validation) still win as in a one-file-at-a-time loop.
 */
export async function* readAhead(paths: readonly string[], size = 16): AsyncGenerator<string> {
  for (let i = 0; i < paths.length; i += size) {
    const texts = await Promise.allSettled(paths.slice(i, i + size).map((path) => readFile(path, "utf8")));
    for (const text of texts) {
      if (text.status === "rejected") throw text.reason;
      yield text.value;
    }
  }
}
