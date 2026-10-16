// Idle memory return for the Node adapter: lets V8's memory reducer shrink the heap once a server goes
// quiet after traffic. Node-only (`node:v8`, `node:vm`).
//
// Why: V8's memory reducer starts its shrinking GCs only when young, old AND embedder (cppgc) allocation
// rates are all "low" (`Heap::HasLowAllocationRate`). A rate of exactly 0 counts as high
// (`ComputeMutatorUtilizationImpl` returns 0 for a zero mutator speed). A Node process that has never
// allocated a cppgc object has an embedder rate of exactly 0 forever, so after a traffic spike the
// reducer reports "high alloc" on every 8 s tick and the committed heap + pooled pages stay resident until
// its 100 s watchdog fires (measured: Node 24 / V8 13.6 and Node 26 / V8 14.6). One tiny embedder
// allocation (a `vm.Script`, whose wrapper is a 56-byte cppgc object since Node 22) makes the smoothed
// embedder rate non-zero; one reducer tick later it has decayed to near zero, which is "low", and the
// reducer runs as V8 intends. See docs/design/research/2026-10-07-v8-memory-reducer-embedder-rate.md.
//
// Cost model: per request only a counter increment (`request()`) and, when the last in-flight request
// ends, an `idle()` call that arms a timer if none is pending. At most one unref'd timer exists; while
// requests keep coming it fires at most once per `delay` and re-arms only when the server is idle at that
// moment. Nothing runs on a server that has never served a request, and an idle server stops after the
// heap shrank, after `attempts` tries, or when committed memory is not above the last settled level.
import { getHeapStatistics } from "node:v8";
import { Script } from "node:vm";

export interface IdleMemoryOptions {
  /** Quiet time (ms) after the last request ends before the first check. Default 1000. */
  delay?: number;
  /** Time (ms) between a nudge and the next check: two memory-reducer ticks (8 s each) plus slack. Default 17000. */
  recheck?: number;
  /** Nudges per idle period before accepting the current heap as settled. Default 5 (inside V8's ~110 s smoothing window). */
  attempts?: number;
  /** Committed V8 heap bytes (default `getHeapStatistics().total_heap_size`). Tests replace it. */
  committed?: () => number;
  /** The embedder allocation (default `new Script("")`). Tests replace it. */
  nudge?: () => void;
}

export interface IdleMemory {
  /** A request started (counter only). */
  request(): void;
  /** The last in-flight request ended. */
  idle(): void;
  /** Stop for good (server closing). */
  stop(): void;
}

const MiB = 1024 * 1024;

/** True when committed memory grew past the settled level by V8's own memory-reducer re-arm rule (×1.1 or +10 MiB). */
const grown = (committed: number, settled: number): boolean => committed >= Math.max(settled * 1.1, settled + 10 * MiB);

/** True on Node; Bun (JSC) and Deno have different heaps and are left alone. */
export const idleMemorySupported = (): boolean => {
  const versions = process.versions as Record<string, string | undefined>;
  return typeof versions.v8 === "string" && versions.bun === undefined && versions.deno === undefined;
};

export function idleMemory(inflight: () => number, options: IdleMemoryOptions = {}): IdleMemory {
  const { delay = 1000, recheck = 17_000, attempts = 5 } = options;
  const committed = options.committed ?? (() => getHeapStatistics().total_heap_size);
  const nudge =
    options.nudge ??
    (() => {
      new Script("");
    });
  let timer: ReturnType<typeof setTimeout> | null = null,
    stopped = false,
    seen = 0, // requests started (wraps harmlessly: only compared for equality)
    mark = 0, // `seen` when the pending timer was armed
    attempt = 0,
    before = 0, // committed bytes at the last nudge
    settled = committed(); // committed bytes once the heap was last left as is (boot, shrink, give-up)

  const arm = (ms: number) => {
    mark = seen;
    timer = setTimeout(check, ms);
    timer.unref();
  };
  const settle = (bytes: number) => {
    settled = bytes;
    attempt = 0;
  };
  function check(): void {
    timer = null;
    if (stopped) return;
    if (inflight() > 0) {
      // Busy: the next `idle()` arms again.
      attempt = 0;
      return;
    }
    if (seen !== mark) {
      // Requests came and went: wait for a full quiet `delay`.
      attempt = 0;
      arm(delay);
      return;
    }
    const now = committed();
    if (attempt > 0 && now < before * 0.9) return settle(now); // the reducer ran: memory returned
    if (!grown(now, settled)) return settle(Math.min(settled, now)); // nothing worth returning
    if (attempt >= attempts) return settle(now); // live set grew: accept it until the next spike
    before = now;
    attempt++;
    nudge();
    arm(recheck);
  }
  return {
    request: () => {
      seen = (seen + 1) | 0;
    },
    idle: () => {
      if (timer === null && !stopped) arm(delay);
    },
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
