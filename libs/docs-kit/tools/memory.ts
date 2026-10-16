// Memory budget: peak resident memory of this process and every descendant (example workers, their Vite builds,
// Chromium, Pagefind), sampled with `ps`. Docs builds must stay under `MEMORY_BUDGET_MB` (user rule 2026-10-08:
// 3 GB for the whole tree); `buildDocs` prints the peak and fails above the budget.
import { execFile } from "node:child_process";

/** Default budget for a docs build's process tree (env `DOCS_KIT_MAX_RSS_MB` overrides; 0 = report only). */
export const MEMORY_BUDGET_MB = 3072;
export const memoryBudget = (): number => {
  const value = process.env.DOCS_KIT_MAX_RSS_MB;
  return value === undefined || value === "" ? MEMORY_BUDGET_MB : Number(value);
};

/** Resident memory (bytes) of `pid` and all its descendants, from one `ps` listing; 0 when unavailable. */
export function treeRss(pid = process.pid): Promise<number> {
  if (process.platform === "win32") return Promise.resolve(0);
  return new Promise((done) => {
    execFile("ps", ["-A", "-o", "pid=,ppid=,rss="], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) return done(0);
      const children = new Map<number, number[]>();
      const rss = new Map<number, number>();
      for (const line of stdout.split("\n")) {
        const [p, pp, kb] = line.trim().split(/\s+/).map(Number);
        if (!p || pp === undefined || kb === undefined || Number.isNaN(kb)) continue;
        rss.set(p, kb * 1024);
        const list = children.get(pp) ?? [];
        list.push(p);
        children.set(pp, list);
      }
      let total = 0;
      const stack = [pid];
      const seen = new Set<number>();
      while (stack.length) {
        const next = stack.pop()!;
        if (seen.has(next)) continue;
        seen.add(next);
        total += rss.get(next) ?? 0;
        stack.push(...(children.get(next) ?? []));
      }
      done(total);
    });
  });
}

export interface MemoryWatch {
  /** Highest tree RSS sampled so far (bytes). */
  peak(): number;
  stop(): Promise<number>;
}

/** Sample the tree RSS of this process every `interval` ms until `stop()` (which takes a last sample). */
export function watchMemory(interval = 500): MemoryWatch {
  let peak = 0;
  let sampling: Promise<void> = Promise.resolve();
  const sample = () => (sampling = treeRss().then((bytes) => void (peak = Math.max(peak, bytes))));
  void sample();
  const timer = setInterval(() => void sample(), interval);
  timer.unref();
  return {
    peak: () => peak,
    async stop() {
      clearInterval(timer);
      await sampling;
      await sample();
      return peak;
    },
  };
}

export const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
