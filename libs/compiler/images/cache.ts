import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { availableParallelism } from "node:os";
import { join } from "node:path";

export function hash(...parts: (string | Buffer)[]): string {
  const h = createHash("sha256");
  for (const part of parts) h.update(part);
  return h.digest("hex");
}
/** Content-addressed files; writes are atomic (temp + rename) so parallel builds never read partial output. */
export function diskCache(dir: string) {
  return {
    async get(name: string): Promise<Buffer | undefined> {
      try {
        return await readFile(join(dir, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    async set(name: string, data: Buffer): Promise<void> {
      await mkdir(dir, { recursive: true });
      const temp = join(dir, `${name}.${randomUUID()}.tmp`);
      await writeFile(temp, data);
      await rename(temp, join(dir, name));
    },
  };
}
/** Run at most `limit` tasks at once. */
export function pool(limit = availableParallelism()) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
