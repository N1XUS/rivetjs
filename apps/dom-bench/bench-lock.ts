// Shared machine-wide benchmark lock (mkdir mutex). Hold it only while timing; at most ~10 minutes.
import { mkdirSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const lockPath = process.env.RIVET_BENCH_LOCK ?? join(tmpdir(), "rivet-bench.lock");
let held = false;
process.on("exit", () => {
  if (held) try { rmdirSync(lockPath); } catch {}
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (held) try { rmdirSync(lockPath); } catch {}
    process.exit(130);
  });

/** Run `fn` while holding the lock; `RIVET_BENCH_LOCK=none` disables locking (caller already holds it). */
export async function withBenchLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (lockPath === "none" || held) return fn();
  let waited = 0;
  for (;;) {
    try {
      mkdirSync(lockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (waited % 60 === 0) console.log(`[lock] waiting for ${lockPath} (${label}, ${waited}s)`);
      await sleep(20_000);
      waited += 20;
    }
  }
  held = true;
  const started = Date.now();
  try {
    return await fn();
  } finally {
    held = false;
    try { rmdirSync(lockPath); } catch {}
    const minutes = (Date.now() - started) / 60000;
    console.log(`[lock] released after ${minutes.toFixed(1)} min (${label})${minutes > 10 ? " — WARNING: held > 10 min" : ""}`);
  }
}
