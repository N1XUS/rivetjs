# V8 memory reducer: a zero embedder allocation rate counts as "high" (bug report draft)

Status: **draft, not filed** — the user decides whether/where to file it (crbug.com/v8, component `Blink>JavaScript>GC`; optionally a nodejs/node issue linking it). Rivet ships a workaround: `libs/router/adapters/idle-memory.ts` (node adapter `idleMemory`, default on).

## Summary

- `Heap::HasLowAllocationRate()` = young && old && embedder rates all "low" (`src/heap/heap.cc`).
- `ComputeMutatorUtilizationImpl(mutator_speed, gc_speed)` returns `kMinMutatorUtilization` (0.0) when `mutator_speed == 0`; "low" needs utilization > 0.993.
- Embedder (cppgc) throughput is `SmoothedBytesAndDuration` with a 100 ms decay (`kSmoothedAllocationSpeedDecayRate`). An isolate with a `CppHeap` attached that never allocates a cppgc object keeps an embedder throughput of exactly 0.0 → utilization 0 → `HasLowEmbedderAllocationRate()` false → the memory reducer's timer reports "high alloc" on every tick, forever.
- Same for an isolate that allocated cppgc objects once: the smoothed throughput decays to 0 after ~1074 half-lives below its last value (double underflow, ~110 s), and from then on the process is "high alloc" again.
- Effect: after an allocation spike, an idle process keeps its grown heap (committed old space, pooled pages) until `WatchdogGC` fires (`kWatchdogDelayMs` = 100 s after the last mark-compact), and only one GC per watchdog period; a process with idle gaps < 100 s between spikes never shrinks.
- Embedders hit: Node.js ≥ 20 always attaches a `CppHeap`; most Node servers create no cppgc objects (Node migrates classes to cppgc gradually — `ContextifyScript`, `ContextifyContext` today).
- A zero rate means "nothing allocated", i.e. the lowest possible rate. The young/old generations share the same code path (zero → "high"), so a fully idle isolate with no JS allocation is also misjudged; in practice timers keep those rates tiny but non-zero for ~110 s after the last activity.

## Versions verified

| Runtime | V8 | Without nudge (idle after burst) | With one `new vm.Script("")` |
| --- | --- | --- | --- |
| Node 24.14.1 (Docker `node:24.14.1-bookworm-slim`) | 13.6.233.17 | "high alloc" every 8 s; RSS 376 MB until the watchdog GC at 108 s → 62 MB | "low alloc" at the 2nd tick (19 s): RSS 350 → 62 MB |
| Node 26.5.1 (macOS arm64) | 14.6.202.34 | "high alloc" every 8 s (observed 40 s) | "low alloc" at 41 s → RSS 275 → 70 MB, committed 71.6 → 4.4 MB |

Trace evidence (`--trace-mutator-utilization`, rivet-router lane, Node 24, idle after a burst):

```txt
16248 ms: Old generation mutator utilization = 0.999 (mutator_speed=2154, gc_speed=2274503)
16248 ms: Embedder mutator utilization = 0.000 (mutator_speed=0, gc_speed=1)
16248 ms: Memory reducer: high alloc, foreground
```

## Minimal repro

```js
// repro.mjs — node --trace-memory-reducer repro.mjs [nudge]
import v8 from "node:v8";
const nudge = process.argv[2] === "nudge";
const mb = (n) => (n / 1048576).toFixed(1);
const report = (t) => {
  const h = v8.getHeapStatistics();
  console.log(`${t} rss ${mb(process.memoryUsage.rss())} MB committed ${mb(h.total_heap_size)} used ${mb(h.used_heap_size)} cppgc ${v8.getCppHeapStatistics("brief").used_size_bytes} B`);
};
// 1. ~3 s allocation burst grows the old generation.
let keep = [];
const end = Date.now() + 3000;
while (Date.now() < end) {
  keep.push(Array.from({ length: 1000 }, (_, i) => ({ i, s: "x" + i })));
  if (keep.length > 200) keep = [];
}
keep = null;
report("after burst");
// 2. Idle. Optionally allocate ONE cppgc object (vm.Script's wrapper is a 56-byte cppgc object).
if (nudge) setTimeout(async () => { const { Script } = await import("node:vm"); new Script(""); report("nudged"); }, 1000);
let t = 0;
const iv = setInterval(() => { t += 5; report(`idle ${t}s`); if (t >= 130) clearInterval(iv); }, 5000);
```

Expected: the memory reducer sees a low allocation rate once the burst is over and shrinks the heap within ~8–16 s, with or without cppgc objects.
Actual: without `nudge` it reports "high alloc" on every tick; memory is returned only by the 100 s watchdog. With `nudge` it reports "low alloc" one tick after the allocation and shrinks.

## Mechanism (V8 13.6 / 14.6 sources)

- `MemoryReducer::TimerTask::RunInternal`: `SampleAllocation(now, new_space, old_gen, embedder counters)` → `should_start_incremental_gc = HasLowAllocationRate() || ShouldOptimizeForMemoryUsage()`.
- `GCTracer::SampleAllocation` → `embedder_generation_allocations_.Update(BytesAndDuration(bytes, duration))`; `SmoothedBytesAndDuration::Update`: `throughput = new + (throughput - new) * 2^(-duration / 100 ms)`.
- One embedder allocation of B bytes before a sample: throughput ≈ B / interval; at the next 8 s tick it decays by 2^-80 → tiny positive → utilization ≈ 1 → "low". After ~1074 more half-lives (~110 s) the double underflows to 0.0 → "high" again.
- `EmbedderSpeedInBytesPerMillisecond()` = `BoundedAverageSpeed(recorded_embedder_marking_)`, clamped to ≥ 1 B/ms; with almost no cppgc objects marked it is 1, so a just-allocated object over a short interval still reads "high" (e.g. 20 B/ms → 0.047) and the next tick reads "low".

## Suggested fixes (for the report)

1. In `ComputeMutatorUtilizationImpl`, treat `mutator_speed == 0` as maximal utilization (1.0) — nothing allocated means the mutator is not allocating. If 0 must stay "unknown" for the young generation during startup, apply it only to the embedder check:
   ```cpp
   bool Heap::HasLowEmbedderAllocationRate() {
     const double rate = tracer()->EmbedderAllocationThroughputInBytesPerMillisecond();
     if (rate == 0) return true;  // no embedder allocations: cannot be high
     ...
   }
   ```
2. Or skip the embedder term when the `CppHeap` has never allocated (`cpp_heap()->allocated_size() == 0`, or no `embedder_allocation_counter` progress since isolate start).
3. Or clamp the smoothed throughput at a tiny epsilon instead of letting it underflow to 0 (`SmoothedBytesAndDuration::Decay`), which also fixes the ~110 s cliff for young/old rates on isolates that go fully idle.

## Rivet workaround (shipped)

- `idleMemory(inflight)` in the node adapter: after 1 s with no requests, if committed V8 heap ≥ max(1.1 × settled, settled + 10 MiB) (V8's own reducer re-arm rule), one `new vm.Script("")`; re-check after 17 s (two reducer ticks); stop once committed dropped ≥ 10 %, when a request arrives, or after 5 tries (inside the ~110 s window where young/old rates are still non-zero). Unref'd timer, no `gc()`, no flags; opt-out `idleMemory: false`. Bun/Deno untouched.
- Idle curve (Docker `--cpus 2 -m 512m`, node:24.14.1, bench flags `--single-threaded-gc --max-semi-space-size=8`; 20 s boot idle, 10 s 5000-row burst at c=1, then 180 s idle sampling `/proc/<pid>/status` RssAnon every 5 s, no HTTP while idle; 3 paired runs):

  | Run | off: t=0 → t=105 → t=110 | on: t=0 → t=10 → t=15 |
  | --- | --- | --- |
  | 1 | 180 → 176 → 76 MiB | 161 → 159 → 70 MiB |
  | 2 | 162 → 167 → 78 MiB | 133 → 131 → 61 MiB |
  | 3 | 129 → 127 → 56 MiB | 127 → 125 → 56 MiB |

- `benchmark.py` (c=1, rows 100/1000/5000, 2 off/on pairs × 3 repeats): rivet-resume peak 179 → 151 / 192 → 185 / 203 → 179 MiB; rivet-compiled + solid-stable-interactive (unchanged code) ±3 MiB; CPU/page and p50 track the control lanes (noisy host).
