// Test control of the deferred loaders: each waits for `open(name)` (or `GATE_AUTO`), counts its runs.
const waiting = new Map<string, (() => void)[]>();
export const runs: Record<string, number> = {};
/** Resolves when the test opens `name` (immediately once it was opened with `sticky`). */
export function gate(name: string): Promise<void> {
  runs[name] = (runs[name] ?? 0) + 1;
  if (process.env.GATE_AUTO === "1") return new Promise((done) => setTimeout(done, 20));
  return new Promise((done) => waiting.set(name, [...(waiting.get(name) ?? []), done]));
}
export function open(name: string): void {
  for (const done of waiting.get(name) ?? []) done();
  waiting.delete(name);
}
