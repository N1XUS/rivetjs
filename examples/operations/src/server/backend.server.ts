interface Stats {
  sseActive: number;
  sseStarted: number;
  sseClosed: number;
  wsActive: number;
  wsStarted: number;
  searchStarted: number;
  searchAborted: number;
}
interface Backend {
  stats: Stats;
  tasks: Map<string, { version: number; title: string }>;
  titles: string[];
}
const key = Symbol.for("rivet.examples.operations.backend");
const registry = globalThis as unknown as Record<symbol, Backend>;
export const backend = (registry[key] ??= {
  stats: { sseActive: 0, sseStarted: 0, sseClosed: 0, wsActive: 0, wsStarted: 0, searchStarted: 0, searchAborted: 0 },
  tasks: new Map(),
  titles: [],
});
