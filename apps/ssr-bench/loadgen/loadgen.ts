// Multi-threaded verified HTTP load generator for the SSR benchmark (replaces the
// GIL-bound load.py as the default). Each worker thread owns a slice of the
// keep-alive connections and runs either:
//   closed loop  - every connection sends its next request as soon as the previous ends;
//   open loop    - constant arrival rate (wrk2-style): request i is *scheduled* at
//                  start + i/rate regardless of responses; latency is measured from the
//                  scheduled time, so queueing behind a slow server is counted
//                  (coordinated-omission free) and admission delay is reported separately.
// Validation: every response must be HTTP 200 with complete framing. A response is
// strictly validated (every row identity/field value, token, article markers) when it is
// one of the first two on its connection, every Nth response, or whenever its byte length
// or tail differs from an already strictly-validated response. All other responses are
// byte-length-identical to a strictly validated page.
//
// CLI (inside rivet-ssr-bench-load:v2): node loadgen.ts --config '<json>' --out file [--hold]
import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { Connection, now, responseBody, responseTail, type Response } from "./client.ts";
import { validateResponse } from "./validate.ts";

export type LoadConfig = {
  url: string;
  rows: number;
  token: string;
  concurrency: number;
  duration: number;
  rate?: number;
  article?: boolean;
  /** Text variant (1 escaping, 2 text grid; `true` = 1): field text compared after HTML parsing (see validate.ts fieldText). */
  strings?: boolean | number;
  /** Worker threads (capped at concurrency). */
  threads?: number;
  /** Strictly validate every Nth response per worker (plus first two per connection and any length change). */
  sample_every?: number;
  /** Seconds allowed after the measured window for in-flight / queued arrivals. */
  drain_seconds?: number;
  timeout_seconds?: number;
};

const FLAG_OK = 1;
const FLAG_STRICT = 2;
const FLAG_UNSENT = 4;
const SOURCES = ["client.ts", "loadgen.ts", "validate.ts"];

/** sha256 over this generator's own sources, so the harness can detect a stale image. */
export function sourceHash(directory = import.meta.dirname): string {
  const hash = createHash("sha256");
  for (const name of SOURCES) hash.update(name + "\0").update(readFileSync(`${directory}/${name}`)).update("\0");
  return hash.digest("hex");
}

class Columns {
  length = 0;
  scheduled = new Float64Array(1024);
  admission = new Float64Array(1024);
  ttfb = new Float64Array(1024);
  latency = new Float64Array(1024);
  bytes = new Float64Array(1024);
  status = new Uint16Array(1024);
  flags = new Uint8Array(1024);
  error = new Uint8Array(1024);
  push(scheduled: number, admission: number, ttfb: number, latency: number, bytes: number, status: number, flags: number, error: number): void {
    if (this.length === this.scheduled.length) {
      for (const key of ["scheduled", "admission", "ttfb", "latency", "bytes", "status", "flags", "error"] as const) {
        const old = this[key];
        const grown = new (old.constructor as Float64ArrayConstructor)(old.length * 2);
        grown.set(old as Float64Array);
        (this as Record<string, unknown>)[key] = grown;
      }
    }
    const i = this.length++;
    this.scheduled[i] = scheduled;
    this.admission[i] = admission;
    this.ttfb[i] = ttfb;
    this.latency[i] = latency;
    this.bytes[i] = bytes;
    this.status[i] = status;
    this.flags[i] = flags;
    this.error[i] = error;
  }
  trimmed() {
    const n = this.length;
    return {
      scheduled: this.scheduled.slice(0, n),
      admission: this.admission.slice(0, n),
      ttfb: this.ttfb.slice(0, n),
      latency: this.latency.slice(0, n),
      bytes: this.bytes.slice(0, n),
      status: this.status.slice(0, n),
      flags: this.flags.slice(0, n),
      error: this.error.slice(0, n),
    };
  }
}

type WorkerInput = { config: Required<LoadConfig>; index: number; workers: number; connections: number; base: string };
type WorkerResult = {
  columns: ReturnType<Columns["trimmed"]>;
  errors: string[];
  strict: number;
  strictFailed: number;
  lengthChecked: number;
  reconnects: number;
  /** Open loop: how late each arrival was noticed by the generator (timer/event-loop lag), ms. */
  lags: number[];
  elu: number;
  end: number;
};

const ms = (value: bigint, base: bigint): number => Number(value - base) / 1e6;

async function runWorker(input: WorkerInput): Promise<void> {
  const { config, index, workers } = input;
  const base = BigInt(input.base);
  const url = new URL(config.url);
  const port = Number(url.port || 80);
  const connections = Array.from({ length: input.connections }, () => new Connection(url.hostname, port, url.pathname + url.search));
  await Promise.all(connections.map((connection) => connection.open()));
  const start = await new Promise<bigint>((resolve) => {
    parentPort!.once("message", (message: { start: string }) => resolve(BigInt(message.start)));
    parentPort!.postMessage({ ready: true });
  });
  const wait = ms(start, now());
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const elu0 = performance.eventLoopUtilization();

  const columns = new Columns();
  const errors: string[] = [];
  const errorIndex = new Map<string, number>();
  const codeOf = (name: string): number => {
    let code = errorIndex.get(name);
    if (code === undefined) {
      errors.push(name);
      code = errors.length; // 0 means "no error"
      errorIndex.set(name, code);
    }
    return code;
  };
  const passedLengths = new Set<number>();
  const perConnection = new Map<Connection, number>();
  let strict = 0;
  let strictFailed = 0;
  let lengthChecked = 0;
  let completed = 0;
  const lags: number[] = [];

  const deadline = start + BigInt(Math.round(config.duration * 1e9));
  const drainDeadline = deadline + BigInt(Math.round(config.drain_seconds * 1e9));
  const timeoutNs = BigInt(Math.round(config.timeout_seconds * 1e9));
  const sampleEvery = Math.max(1, config.sample_every);

  const record = (connection: Connection, scheduled: bigint, dispatched: bigint, response: Response): void => {
    let flags = 0;
    let error = 0;
    if (response.error) error = codeOf(response.error);
    else if (response.status !== 200) error = codeOf("HTTP" + response.status);
    else {
      const seen = perConnection.get(connection) ?? 0;
      const tail = responseTail(response);
      const tailOk = tail.includes("<!--complete-->") && tail.includes("</html>");
      const mustCheck = seen < 2 || completed % sampleEvery === 0 || !tailOk || !passedLengths.has(response.bytes);
      if (mustCheck) {
        strict++;
        flags |= FLAG_STRICT;
        const body = responseBody(response);
        if (validateResponse(200, body, config.rows, config.token, config.article, config.strings)) {
          flags |= FLAG_OK;
          passedLengths.add(response.bytes);
        } else {
          strictFailed++;
          error = codeOf("InvalidPage");
        }
      } else {
        lengthChecked++;
        flags |= FLAG_OK;
      }
    }
    perConnection.set(connection, (perConnection.get(connection) ?? 0) + 1);
    response.buffers.length = 0;
    completed++;
    columns.push(
      ms(scheduled, start),
      ms(dispatched, scheduled),
      response.firstByte ? ms(response.firstByte, scheduled) : 0,
      ms(response.end, scheduled),
      response.bytes,
      response.status,
      flags,
      error,
    );
  };
  const timeoutScan = setInterval(() => {
    const t = now();
    for (const connection of connections) if (connection.busy && t - connection.sentAt > timeoutNs) connection.abort("Timeout");
  }, 250);

  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      resolve();
    };
    if (!config.rate) {
      let active = connections.length;
      const issue = (connection: Connection): void => {
        const scheduled = now();
        connection.send((response) => {
          record(connection, scheduled, scheduled, response);
          if (now() < deadline) issue(connection);
          else if (--active === 0) finish();
        });
      };
      if (active === 0) finish();
      for (const connection of connections) issue(connection);
      return;
    }
    // Open loop: this worker owns arrivals index, index+workers, ... of the global schedule.
    const total = Math.ceil(config.duration * config.rate);
    const intervalNs = 1e9 / config.rate;
    const at = (i: number): bigint => start + BigInt(Math.round(i * intervalNs));
    const pending: bigint[] = [];
    let pendingHead = 0;
    let next = index;
    const idle = [...connections];
    let timer: NodeJS.Timeout | null = null;
    const dispatch = (connection: Connection, scheduled: bigint): void => {
      const dispatched = now();
      connection.send((response) => {
        record(connection, scheduled, dispatched, response);
        if (pendingHead < pending.length) dispatch(connection, pending[pendingHead++]!);
        else idle.push(connection);
        settle();
      });
    };
    const settle = (): void => {
      if (next >= total && pendingHead >= pending.length && idle.length === connections.length) {
        clearTimeout(drainTimer);
        finish();
      }
    };
    const pump = (): void => {
      timer = null;
      const t = now();
      while (next < total && at(next) <= t) {
        pending.push(at(next));
        lags.push(ms(t, at(next)));
        next += workers;
      }
      while (idle.length && pendingHead < pending.length) dispatch(idle.pop()!, pending[pendingHead++]!);
      if (pendingHead > 4096 && pendingHead * 2 > pending.length) {
        pending.splice(0, pendingHead);
        pendingHead = 0;
      }
      if (next < total) timer = setTimeout(pump, Math.max(0, ms(at(next), now())));
      settle();
    };
    // Hard cap: arrivals never sent and requests still in flight count as failures.
    const drainTimer = setTimeout(() => {
      if (timer) clearTimeout(timer);
      const t = now();
      const unsent = codeOf("ArrivalBacklog");
      while (next < total) {
        pending.push(at(next));
        next += workers;
      }
      for (; pendingHead < pending.length; pendingHead++) {
        const scheduled = pending[pendingHead]!;
        columns.push(ms(scheduled, start), ms(t, scheduled), 0, ms(t, scheduled), 0, 0, FLAG_UNSENT, unsent);
      }
      for (const connection of connections) if (connection.busy) connection.abort("DrainTimeout");
      queueMicrotask(() => queueMicrotask(finish));
    }, Math.max(1, ms(drainDeadline, now())));
    pump();
  });
  clearInterval(timeoutScan);
  const end = ms(now(), start);
  const elu = performance.eventLoopUtilization(elu0).utilization;
  for (const connection of connections) connection.close();
  const result: WorkerResult = {
    columns: columns.trimmed(),
    errors,
    strict,
    strictFailed,
    lengthChecked,
    reconnects: connections.reduce((sum, connection) => sum + connection.reconnects, 0),
    lags,
    elu,
    end,
  };
  const c = result.columns;
  parentPort!.postMessage(result, [c.scheduled.buffer, c.admission.buffer, c.ttfb.buffer, c.latency.buffer, c.bytes.buffer, c.status.buffer, c.flags.buffer, c.error.buffer]);
}

function percentile(sorted: Float64Array, p: number): number | null {
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]! : null;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Run the configured load across worker threads and return summary + every request (columnar). */
export async function runLoad(input: LoadConfig) {
  const config: Required<LoadConfig> = {
    rate: 0,
    article: false,
    strings: 0,
    threads: Math.max(1, availableParallelism()),
    sample_every: 32,
    drain_seconds: 15,
    timeout_seconds: 15,
    ...input,
  };
  const workers = Math.max(1, Math.min(config.threads, config.concurrency));
  const base = now();
  const threads = Array.from({ length: workers }, (_, index) => {
    const connections = Math.floor(config.concurrency / workers) + (index < config.concurrency % workers ? 1 : 0);
    const data: WorkerInput = { config, index, workers, connections, base: String(base) };
    return new Worker(new URL(import.meta.url), { workerData: { loadgen: data } });
  });
  await Promise.all(threads.map((worker) => new Promise((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
  })));
  // CPU is counted from here: worker start-up (isolates, TypeScript stripping) is excluded.
  const cpu0 = process.cpuUsage();
  const start = now() + 20_000_000n;
  const results = await Promise.all(
    threads.map(
      (worker) =>
        new Promise<WorkerResult>((resolve, reject) => {
          worker.once("message", resolve);
          worker.once("error", reject);
          worker.postMessage({ start: String(start) });
        }),
    ),
  );
  const cpu = process.cpuUsage(cpu0);
  await Promise.all(threads.map((worker) => worker.terminate()));

  // Merge columns; remap per-worker error codes to one global name table.
  const names: string[] = [];
  const merged = { scheduled: [] as number[], admission: [] as number[], ttfb: [] as number[], latency: [] as number[], bytes: [] as number[], status: [] as number[], flags: [] as number[], error: [] as number[] };
  const errorCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const good: number[] = [];
  const goodTtfb: number[] = [];
  const admissions: number[] = [];
  let ttfbSum = 0;
  let bytesSum = 0;
  let unsent = 0;
  for (const result of results) {
    const c = result.columns;
    const remap = result.errors.map((name) => {
      let at = names.indexOf(name);
      if (at === -1) at = names.push(name) - 1;
      return at + 1;
    });
    for (let i = 0; i < c.scheduled.length; i++) {
      const error = c.error[i] ? remap[c.error[i]! - 1]! : 0;
      merged.scheduled.push(round3(c.scheduled[i]!));
      merged.admission.push(round3(c.admission[i]!));
      merged.ttfb.push(round3(c.ttfb[i]!));
      merged.latency.push(round3(c.latency[i]!));
      merged.bytes.push(c.bytes[i]!);
      merged.status.push(c.status[i]!);
      merged.flags.push(c.flags[i]!);
      merged.error.push(error);
      admissions.push(c.admission[i]!);
      if (c.flags[i]! & FLAG_UNSENT) unsent++;
      else statusCounts[c.status[i]!] = (statusCounts[c.status[i]!] ?? 0) + 1;
      if (error) errorCounts[names[error - 1]!] = (errorCounts[names[error - 1]!] ?? 0) + 1;
      if (c.flags[i]! & FLAG_OK) {
        good.push(c.latency[i]!);
        goodTtfb.push(c.ttfb[i]!);
        ttfbSum += c.ttfb[i]!;
        bytesSum += c.bytes[i]!;
      }
    }
  }
  const times = Float64Array.from(good).sort();
  const ttfbSorted = Float64Array.from(goodTtfb).sort();
  const admissionSorted = Float64Array.from(admissions).sort();
  const elapsed = Math.max(...results.map((result) => result.end)) / 1000;
  const attempts = merged.scheduled.length;
  const strict = results.reduce((sum, result) => sum + result.strict, 0);
  const strictFailed = results.reduce((sum, result) => sum + result.strictFailed, 0);
  const lengthChecked = results.reduce((sum, result) => sum + result.lengthChecked, 0);
  const cpuSeconds = (cpu.user + cpu.system) / 1e6;
  const elus = results.map((result) => round3(result.elu));
  const lagSorted = Float64Array.from(results.flatMap((result) => result.lags)).sort();
  const summary = {
    attempts,
    successful: good.length,
    failed: attempts - good.length,
    rps: good.length / elapsed,
    duration_seconds: elapsed,
    p50_ms: percentile(times, 0.5),
    p90_ms: percentile(times, 0.9),
    p95_ms: percentile(times, 0.95),
    p99_ms: percentile(times, 0.99),
    p999_ms: percentile(times, 0.999),
    max_ms: times.length ? times[times.length - 1]! : null,
    mean_ttfb_ms: good.length ? ttfbSum / good.length : null,
    p50_ttfb_ms: percentile(ttfbSorted, 0.5),
    p99_ttfb_ms: percentile(ttfbSorted, 0.99),
    mean_response_bytes: good.length ? bytesSum / good.length : null,
    max_admission_delay_ms: admissionSorted.length ? admissionSorted[admissionSorted.length - 1]! : 0,
    p99_admission_delay_ms: percentile(admissionSorted, 0.99) ?? 0,
    mode: config.rate ? "open-loop" : "closed-loop",
    offered_rate: config.rate || null,
    unsent,
    errors: errorCounts,
    statuses: statusCounts,
    validation: {
      policy: `strict: first 2 per connection, every ${config.sample_every}th, any new length/tail; others: HTTP 200 + complete framing + byte length equal to a strictly validated page + tail markers`,
      sample_every: config.sample_every,
      strict,
      strict_failed: strictFailed,
      length_checked: lengthChecked,
      strict_fraction: strict + lengthChecked ? strict / (strict + lengthChecked) : null,
    },
  };
  const generator = {
    implementation: "node-net-workers",
    node: process.version,
    threads: workers,
    connections: config.concurrency,
    cpu_seconds: cpuSeconds,
    cpu_cores_used: cpuSeconds / elapsed,
    worker_elu: elus,
    max_worker_elu: Math.max(...elus),
    reconnects: results.reduce((sum, result) => sum + result.reconnects, 0),
    schedule_lag_p99_ms: config.rate ? percentile(lagSorted, 0.99) : null,
    schedule_lag_max_ms: config.rate && lagSorted.length ? lagSorted[lagSorted.length - 1]! : null,
    cpu_window: "worker threads ready -> last result received (start-up excluded)",
    source_sha256: sourceHash(),
  };
  return {
    summary,
    generator,
    request_columns: {
      units: "ms from scheduled start (latency/ttfb/admission) / ms from run start (scheduled)",
      flag_bits: { ok: FLAG_OK, strict: FLAG_STRICT, unsent: FLAG_UNSENT },
      error_names: names,
      ...merged,
    },
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { config: { type: "string" }, out: { type: "string" }, hold: { type: "boolean" }, hash: { type: "boolean" } } });
  if (values.hash) {
    console.log(sourceHash());
    return;
  }
  if (!values.config || !values.out) throw new Error("--config and --out are required");
  const result = await runLoad(JSON.parse(values.config) as LoadConfig);
  const temporary = values.out.replace(/\.json$/, "") + ".tmp";
  writeFileSync(temporary, JSON.stringify(result));
  renameSync(temporary, values.out);
  // Keep cumulative cgroup counters readable until the controller samples and removes us.
  if (values.hold) await new Promise((resolve) => setTimeout(resolve, 60_000));
}

if (!isMainThread && (workerData as { loadgen?: WorkerInput } | null)?.loadgen) {
  void runWorker((workerData as { loadgen: WorkerInput }).loadgen);
} else if (isMainThread && process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
