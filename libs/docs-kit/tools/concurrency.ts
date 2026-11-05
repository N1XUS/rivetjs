/**
 * Bounded concurrency for the build tools: independent file reads / writes / module loads overlap, results stay in
 * input order, and the first failure in input order wins (as it did when the work ran one item at a time).
 */
import { readFile } from "node:fs/promises";

/** Run `fn` over `items`, at most `size` at a time (order of completion unspecified; the first rejection rejects). */
export async function pool<T>(items: readonly T[], size: number, fn: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await fn(items[index]!, index);
      }
    }),
  );
}

/**
 * `fn` over `items`, at most `size` at a time; results by index. Every item runs; a failure is thrown after all
 * settled, the one of the earliest item — the error a one-at-a-time loop would have thrown.
 */
export async function mapPool<T, R>(items: readonly T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  await pool(items, size, async (item, index) => {
    try {
      results[index] = { status: "fulfilled", value: await fn(item, index) };
    } catch (reason) {
      results[index] = { status: "rejected", reason };
    }
  });
  return results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}

/**
 * Read at most `size` (default 16) files at a time; yield results (failures thrown) in input order. Parsing stays in
 * the caller, so an earlier parse error still wins over a later read error.
 */
export async function* readTexts(files: readonly string[], size = 16): AsyncGenerator<string> {
  for (let i = 0; i < files.length; i += size) {
    const results = await Promise.allSettled(files.slice(i, i + size).map((file) => readFile(file, "utf8")));
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      yield result.value;
    }
  }
}
