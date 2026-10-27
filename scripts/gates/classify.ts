// Output classification for scripts/gates/run.ts (pure): failure lines per gate kind, known-red matching, size-report
// run-to-run noise, zero-cost Qwik lane noise + baseline restore, peak RSS from `/usr/bin/time`.
import type { Gate } from "./plan.ts";

export type Status = "pass" | "fail" | "known-red" | "noise" | "rss" | "blocked" | "skipped";

export interface KnownRed {
  /** Gate id or pattern (`vitest:runtime`, `vitest:runtime*`). */
  gate: string;
  /** Substring of a failure line (vitest: `file > test name`; docs build: `example <id>`). */
  match: string;
  reason: string;
  owner: string;
  since?: string;
}

export interface Verdict {
  status: Status;
  /** Failure lines (new reds first, then known reds / noise). */
  failures: string[];
  /** Matched registry entries. */
  known: KnownRed[];
  detail: string;
}

const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

/** Failure lines a gate's output names (deduplicated; [] = none recognised). */
export function failureLines(kind: Gate["kind"], output: string): string[] {
  const text = strip(output);
  const lines = new Set<string>();
  if (kind === "vitest") {
    for (const m of text.matchAll(/^\s*FAIL\s+\|([^|]+)\|\s+(.+?)\s*$/gm)) lines.add(`${m[2]}`.replace(/\s+\[[^\]]*\]$/, ""));
    for (const m of text.matchAll(/^.*No projects were found.*$/gm)) lines.add(m[0].trim());
  } else if (kind === "docs-build") {
    for (const m of text.matchAll(/FAILED example ([\w-]+)/g)) lines.add(`example ${m[1]}`);
  } else if (kind === "size") {
    for (const g of sizeGrowth(text)) lines.add(`${g.key}: ${g.from} -> ${g.to} (+${g.delta})`);
  } else if (kind === "frames") {
    for (const m of text.matchAll(/^(\S+: (?:\w+ \d+ exceeds ceiling \d+ \(\+\d+\)|missing \w+|invalid .+))$/gm)) lines.add(m[1]!);
  } else if (kind === "zero-cost") {
    for (const m of text.matchAll(/^([<>]) (\S+) (\S+)/gm)) lines.add(`${m[1]} ${m[2]} ${m[3]}`);
    for (const m of text.matchAll(/^.*(?:leak|condition parity: \d+ problem|corpus cases match).*$/gm))
      if (!/: none|: ok|^(\d+)\/\1 /.test(m[0])) lines.add(m[0].trim());
  }
  return [...lines];
}

/** size-report / frames growth lines: `  key: 123 -> 130 (+7)`. */
export function sizeGrowth(output: string): { key: string; from: number; to: number; delta: number }[] {
  return [...strip(output).matchAll(/^\s+(\S+): (\d+) -> (\d+) \(\+(\d+)\)\s*$/gm)].map((m) => ({ key: m[1]!, from: +m[2]!, to: +m[3]!, delta: +m[4]! }));
}

/** Registry entries that apply to a gate. */
export function entriesFor(id: string, registry: KnownRed[]): KnownRed[] {
  return registry.filter((entry) => entry.gate === id || (entry.gate.endsWith("*") && id.startsWith(entry.gate.slice(0, -1))));
}

/** zero-cost `lanes.txt` entries that drift without Qwik code changes (Qwik server bundles + client / client-stable builds). */
export const isQwikLane = (path: string) => /qwik/i.test(path) || /^client(-stable)?\//.test(path);

export interface ClassifyContext {
  registry: KnownRed[];
  /** Size growth up to this many bytes per value = run-to-run noise. */
  sizeTolerance: number;
  /** Qwik lane sources changed vs the base (then Qwik drift is real). */
  qwikChanged: boolean;
}

/** Verdict of a finished gate from its exit code and output. */
export function classify(gate: Pick<Gate, "id" | "kind">, code: number, output: string, ctx: ClassifyContext): Verdict {
  if (code === 0) return { status: "pass", failures: [], known: [], detail: summaryLine(gate.kind, output) };
  const lines = failureLines(gate.kind, output);
  if (gate.kind === "size") {
    const growth = sizeGrowth(output);
    // Only a completed comparison (the "grew vs" report) can be noise; a crash with growth lines stays red.
    if (growth.length && /size-report: grew vs/.test(output) && growth.every((g) => g.delta <= ctx.sizeTolerance))
      return { status: "noise", failures: lines, known: [], detail: `${growth.length} value(s) within ±${ctx.sizeTolerance} B` };
  }
  if (gate.kind === "zero-cost" && !ctx.qwikChanged) {
    const diff = lines.filter((l) => /^[<>] /.test(l));
    const other = lines.filter((l) => !/^[<>] /.test(l));
    if (diff.length && !other.length && diff.every((l) => isQwikLane(l.split(" ")[1]!)))
      return { status: "noise", failures: lines, known: [], detail: `${diff.length} Qwik lane line(s) only (no Qwik source change)` };
  }
  const entries = entriesFor(gate.id, ctx.registry);
  const known: KnownRed[] = [];
  const fresh: string[] = [];
  for (const line of lines) {
    const entry = entries.find((e) => line.includes(e.match));
    if (entry) known.includes(entry) || known.push(entry);
    else fresh.push(line);
  }
  if (lines.length && !fresh.length) return { status: "known-red", failures: lines, known, detail: `${lines.length} known red(s)` };
  return {
    status: "fail",
    failures: [...fresh, ...lines.filter((l) => !fresh.includes(l))],
    known,
    detail: fresh.length ? `${fresh.length} new red(s)${known.length ? ` + ${lines.length - fresh.length} known` : ""}` : `exit ${code}`,
  };
}

/** One summary line of a passing gate (vitest totals, corpus, …) for the table. */
export function summaryLine(kind: Gate["kind"], output: string): string {
  const text = strip(output);
  const pick = (regex: RegExp) => [...text.matchAll(regex)].map((m) => m[0].trim()).pop() ?? "";
  if (kind === "vitest") return pick(/^\s+Tests\s+.+$/gm).replace(/^Tests\s+/, "");
  if (kind === "zero-cost") return [pick(/runtime \+ lanes: identical|baselines updated/g), pick(/^\d+\/\d+ corpus cases match$/gm)].filter(Boolean).join(", ");
  if (kind === "size") return pick(/size-report: (no growth vs baseline|baseline updated)/g);
  if (kind === "frames") return pick(/frame payload: [^\n(]+/g);
  return pick(/^(?:mcp data --check: ok|format: )[^\n]*$/gm)
    .replace(/, digest \w+/, "")
    .slice(0, 100);
}

/** Peak RSS (bytes) reported by `/usr/bin/time -l` (macOS, bytes) or `-v` (GNU, kbytes); null when absent. */
export function timeRss(output: string): number | null {
  const mac = [...output.matchAll(/^\s*(\d+)\s+maximum resident set size/gm)].pop();
  if (mac) return +mac[1]!;
  const gnu = [...output.matchAll(/Maximum resident set size \(kbytes\): (\d+)/g)].pop();
  return gnu ? +gnu[1]! * 1024 : null;
}

/**
 * `lanes.txt` after `--update` with the Qwik lane lines put back to the base version (they drift with the machine /
 * node_modules layout, not with code): non-Qwik lines from `updated`, Qwik lines from `base`, sorted like lanes-hashes.mjs.
 */
export function restoreQwikLines(base: string, updated: string): string {
  const lines = (text: string) => text.split("\n").filter(Boolean);
  const keep = lines(updated).filter((line) => !isQwikLane(line.split(" ")[0]!));
  const qwik = lines(base).filter((line) => isQwikLane(line.split(" ")[0]!));
  const sorted = [...keep, ...qwik].sort((a, b) => {
    const pa = a.split(" ")[0]!;
    const pb = b.split(" ")[0]!;
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });
  return sorted.join("\n") + "\n";
}

/** Lines that differ between two baseline texts (`-old` / `+new`), for the run report. */
export function baselineDelta(before: string, after: string): string[] {
  const a = new Set(before.split("\n").filter(Boolean));
  const b = new Set(after.split("\n").filter(Boolean));
  return [...[...a].filter((l) => !b.has(l)).map((l) => `-${l}`), ...[...b].filter((l) => !a.has(l)).map((l) => `+${l}`)];
}
