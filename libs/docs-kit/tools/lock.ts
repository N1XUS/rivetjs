// Cross-process file locks and atomic writes for files several docs-kit processes update (the
// examples manifest: parallel `docs-kit examples <id>` runs and `serve` rebuilds read-modify-write it).
// A lock is a directory holding `owner.json` ({ pid, time }), created by renaming a prepared directory
// into place (atomic; fails while another process holds it); a lock whose owner process is gone, or
// older than `stale`, is broken.
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface LockOptions {
  /** Give up after this many ms (default 10 min). */
  timeout?: number;
  /** Break a lock older than this many ms even when its owner looks alive (default 10 min). */
  stale?: number;
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Run `fn` holding the lock directory `dir` (created next to the file it guards). */
export async function withLock<T>(dir: string, fn: () => Promise<T>, options: LockOptions = {}): Promise<T> {
  const { timeout = 600_000, stale = 600_000 } = options;
  const started = Date.now();
  await mkdir(dirname(dir), { recursive: true });
  // The lock appears with its owner file in place: prepared aside, then renamed (atomic, fails when held).
  const mine = `${dir}.${process.pid}.${Math.random().toString(36).slice(2)}`;
  for (let wait = 5; ; wait = Math.min(wait * 2, 100)) {
    await mkdir(mine, { recursive: true });
    await writeFile(resolve(mine, "owner.json"), JSON.stringify({ pid: process.pid, time: Date.now() }));
    try {
      await rename(mine, dir);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOTEMPTY" && code !== "EEXIST" && code !== "EPERM") throw error;
    }
    const owner = await readFile(resolve(dir, "owner.json"), "utf8").then(
      (text) => {
        try {
          return JSON.parse(text) as { pid: number; time: number };
        } catch {
          return null;
        }
      },
      () => null,
    );
    const age = await stat(dir).then(
      (info) => Date.now() - info.mtimeMs,
      () => 0,
    );
    // An unreadable owner (a lock from an older writer, or one being removed): its age decides.
    if (owner ? !alive(owner.pid) || Date.now() - owner.time > stale : age > 2_000) {
      await drop(dir);
      continue;
    }
    if (Date.now() - started > timeout) {
      await rm(mine, { recursive: true, force: true });
      throw new Error(`docs-kit: timed out waiting for lock ${dir} (held by pid ${owner?.pid ?? "?"})`);
    }
    await new Promise((done) => setTimeout(done, wait));
  }
  try {
    return await fn();
  } finally {
    await drop(dir);
  }
}

/** Remove a lock dir atomically: renamed away first, so no other process can take a half-removed lock. */
async function drop(dir: string): Promise<void> {
  const gone = `${dir}.${process.pid}.${Math.random().toString(36).slice(2)}.gone`;
  try {
    await rename(dir, gone);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await rm(gone, { recursive: true, force: true });
}

/** Write `file` via a temporary sibling + rename: readers see the old or the new contents, never a part. */
export async function writeAtomic(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    await writeFile(temp, contents);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}
