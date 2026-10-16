// Resume state byte attribution (dev tool): which component / capture / entry kind a page's `rivet/state` bytes come from.
//   node libs/runtime/tests/resume/state-attribution.ts <page.html> [--top 20] [--json]
// Sizes are wire bytes (each table entry's JSON + its comma). Every table entry is owned by the first root that reaches
// it in a depth-first walk over handlers (`e`), bindings (`b`), effects / client events and region locals, in wire
// order; an entry reached through a function / computed / custom entry is attributed to that entry's symbol and capture
// position (`Symbol a<k>`), so `SelectRoot$6xb a3` = everything first reached through capture 3 of a SelectRoot recipe.
// Also `bySymbol` (exclusive bytes per recipe symbol, summed over its captures) and `byKind` (table entry kinds).
// `--exclusive <regex>`: table bytes reached only through the roots whose label matches (e.g. `providers`).
import { readFileSync } from "node:fs";
import { readable } from "./wire.ts";
import type { EntryRecord, TableEntry } from "@rivetjs/runtime/resume-format";

export interface Attribution {
  total: number;
  sections: Record<string, number>;
  byKind: Record<string, { n: number; bytes: number }>;
  byCapture: { label: string; bytes: number; entries: number }[];
  bySymbol: { symbol: string; bytes: number }[];
  unreached: number;
}

const json = (v: unknown) => JSON.stringify(v);

function kindOf(entry: TableEntry): string {
  if (entry === null || typeof entry !== "object") return typeof entry === "string" ? "string" : "literal";
  if (Array.isArray(entry)) return "array";
  for (const k of ["y", "w", "f", "c", "k", "j", "i", "o", "p", "s", "e", "m", "r", "x", "u"])
    if (k in entry) return k === "w" ? ("o" in entry ? "w(o)" : "w(p)") : k;
  return Object.keys(entry)[0] ?? "?";
}

/** Short symbol label: `Local$hash` (module dropped). */
const short = (id: unknown) => (typeof id === "string" ? id.slice(id.indexOf("#") + 1) : String(id));

export function attribute(stateJSON: string, skip?: RegExp): Attribution {
  const raw = JSON.parse(stateJSON) as Record<string, unknown>;
  const wire = (raw.t ?? []) as TableEntry[];
  const sizes = wire.map((e) => json(e).length + 1);
  const sections: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) sections[k] = json(v).length;
  const state = readable(structuredClone(raw)) as Record<string, unknown> & { t: TableEntry[] };
  const table = state.t;

  const byKind: Attribution["byKind"] = {};
  wire.forEach((e, i) => {
    const k = kindOf(e);
    (byKind[k] ??= { n: 0, bytes: 0 }).n++;
    byKind[k].bytes += sizes[i]!;
  });

  const owner = new Map<string, { bytes: number; entries: number }>();
  const seen = new Set<number>();
  const children = (entry: TableEntry): [ref: number, sub?: string][] => {
    if (entry === null || typeof entry !== "object") return [];
    if (Array.isArray(entry)) return entry.map((r) => [r]);
    const e = entry as EntryRecord;
    const out: [number, string?][] = [];
    if (e.o) for (let i = 1; i < e.o.length; i += 2) out.push([e.o[i] as number, String(e.o[i - 1])]);
    else if (e.p) for (let i = 1; i < e.p.length; i += 2) Array.isArray(e.p[i]) && out.push([(e.p[i] as [number])[0], String(e.p[i - 1])]);
    else if (e.m) for (const r of e.m) out.push([r]);
    else if (e.e) for (const r of e.e) out.push([r]);
    else if (e.E && e.E.length > 2) out.push([e.E[2] as number]);
    else if (e.i) out.push([e.i[0]]);
    else if ("s" in e) {
      out.push([e.s!]);
      if (typeof e.q === "number") out.push([e.q]);
    } else if (e.a) {
      e.a.forEach((r, k) => out.push([r, "a" + k]));
      if (typeof e.q === "number") out.push([e.q, "q"]);
    }
    return out;
  };
  const walk = (start: number, label: string) => {
    if (skip?.test(label)) return;
    const stack: [number, string][] = [[start, label]];
    while (stack.length) {
      const [i, at] = stack.pop()!;
      if (i < 0 || i >= table.length || seen.has(i)) continue;
      seen.add(i);
      const o = owner.get(at) ?? { bytes: 0, entries: 0 };
      o.bytes += sizes[i]!;
      o.entries++;
      owner.set(at, o);
      const entry = table[i]!;
      const rec = entry !== null && typeof entry === "object" && !Array.isArray(entry) ? (entry as EntryRecord) : undefined;
      const sym = rec && (rec.f !== undefined || rec.c !== undefined || rec.k !== undefined) ? short(rec.f ?? rec.c ?? rec.k) : undefined;
      const list = children(entry);
      for (let k = list.length - 1; k >= 0; k--) {
        const [ref, sub] = list[k]!;
        stack.push([ref, sym && sub ? `${sym} ${sub}` : at]);
      }
    }
  };
  const handlers = (e: Record<string, Record<string, unknown[]>> | undefined, tag: string) => {
    for (const id in e ?? {})
      for (const type in e![id]) {
        const [symbol, refs] = e![id]![type]! as [unknown, number[]];
        sections[`${tag}:${short(symbol)}`] = (sections[`${tag}:${short(symbol)}`] ?? 0) + 0;
        refs.forEach((r, k) => walk(r, `${tag} ${short(symbol)} a${k}`));
      }
  };
  handlers(state.e as never, "e");
  for (const b of (state.b ?? []) as unknown[][]) {
    const sym = short(b[2]);
    ((b[3] as number[]) ?? []).forEach((r, k) => walk(r, `b ${sym} a${k}`));
    ((b[4] as number[]) ?? []).forEach((r) => walk(r, `b ${sym} signals`));
    if (b[1] === "+") for (const item of (b[8] as { b: unknown[][]; r: number[] }).r) walk(item as unknown as number, `b packed rows`);
    for (const extra of b.slice(10)) {
      if (extra && typeof extra === "object" && !Array.isArray(extra) && "l" in extra)
        for (const r of (extra as { l: (number | null)[] }).l) r !== null && walk(r, `b ${sym} locals`);
      if (Array.isArray(extra)) for (let k = 1; k < extra.length; k += 2) typeof extra[k] === "number" && walk(extra[k] as number, `b ${sym} providers`);
    }
  }
  for (const [tag, list] of [
    ["fx", state.fx],
    ["ce", state.ce],
  ] as [string, unknown[][] | undefined][])
    for (const entry of list ?? []) ((entry[1] as number[]) ?? []).forEach((r, k) => walk(r, `${tag} ${short(entry[0])} a${k}`));
  for (const k of (state.k ?? []) as (number | [number])[]) typeof k === "number" && walk(k, "k consts");
  let unreached = 0;
  for (let i = 0; i < table.length; i++) if (!seen.has(i)) unreached += sizes[i]!;

  const byCapture = [...owner].map(([label, o]) => ({ label, ...o })).sort((a, b) => b.bytes - a.bytes);
  const sym = new Map<string, number>();
  for (const { label, bytes } of byCapture) {
    const s = label
      .split(" ")
      .slice(0, -1)
      .join(" ")
      .replace(/^(e|b|fx|ce) /, "");
    sym.set(s, (sym.get(s) ?? 0) + bytes);
  }
  const bySymbol = [...sym].map(([symbol, bytes]) => ({ symbol, bytes })).sort((a, b) => b.bytes - a.bytes);
  return { total: stateJSON.length, sections, byKind, byCapture, bySymbol, unreached };
}

export function stateOf(html: string): string {
  const m = /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html);
  if (!m) throw new Error("no rivet/state script");
  return m[1]!;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const top = Number(args[args.indexOf("--top") + 1]) || 20;
  const skipArg = args.includes("--exclusive") ? new RegExp(args[args.indexOf("--exclusive") + 1]!) : undefined;
  for (const file of args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--top" && args[i - 1] !== "--exclusive")) {
    const a = attribute(stateOf(readFileSync(file, "utf8")));
    if (skipArg) {
      // Bytes only the roots matching the pattern reach (table bytes reached with them minus without them).
      const without = attribute(stateOf(readFileSync(file, "utf8")), skipArg);
      console.log(`${file}: roots /${skipArg.source}/ alone reach ${without.unreached - a.unreached} B of ${a.total - a.unreached} B reached table bytes`);
      continue;
    }
    if (args.includes("--json")) {
      console.log(JSON.stringify(a));
      continue;
    }
    const sec = Object.entries(a.sections).filter(([, v]) => v > 2);
    console.log(`${file}\n  state ${a.total} B; sections ${sec.map(([k, v]) => `${k} ${v}`).join(", ")}; unreached table ${a.unreached} B`);
    console.log(
      `  kinds: ${Object.entries(a.byKind)
        .sort((x, y) => y[1].bytes - x[1].bytes)
        .map(([k, v]) => `${k} ${v.bytes}/${v.n}`)
        .join(", ")}`,
    );
    console.log(`  top captures:`);
    for (const c of a.byCapture.slice(0, top)) console.log(`    ${String(c.bytes).padStart(6)} B ${String(c.entries).padStart(4)} e  ${c.label}`);
    console.log(`  top symbols:`);
    for (const s of a.bySymbol.slice(0, top)) console.log(`    ${String(s.bytes).padStart(6)} B  ${s.symbol}`);
  }
}
