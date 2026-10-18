// Replay `coLoadGroups` on a merge-input dump (`RIVET_MERGE_DUMP=<file>` on a client build) to tune the chunk policy
// without rebuilding the site: per entry, the chunks it would load (a module's chunk = its merge group, else the
// bundler's own chunk for its owner set) and their bytes, for the named entries and as a distribution.
//
//   node libs/compiler/spikes/merge-replay.ts <dump.json> [--budget 65536] [--cap 3] [--entry select-default,…] [--list]
import { readFileSync } from "node:fs";
import { coLoadInspect, type CoLoadModule } from "../chunk-groups.ts";

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const dump = JSON.parse(readFileSync(argv[0]!, "utf8")) as { budget: number; cap?: number; nodes: CoLoadModule[] };
const budget = opt("--budget") !== undefined ? Number(opt("--budget")) : dump.budget;
const cap = opt("--cap") !== undefined ? Number(opt("--cap")) : dump.cap;
const names = (opt("--entry") ?? "select-default,date-picker-basic,combo-box-default,showcase-dashboard").split(",");
const nodes = dump.nodes;
const index = new Map(nodes.map((m, i) => [m.id, i] as const));
const imports = nodes.map((m) => m.imports.map((id) => index.get(id)).filter((i): i is number => i !== undefined));
const entries = nodes.flatMap((m, i) => (m.entry ? [i] : []));
// Owners as the bundler sees them: every entry whose static closure reaches the module (barrels included: the bundler
// links through them; this over-counts what tree-shaking drops, like the group walk does for pinned entries).
const owners: Set<number>[] = nodes.map(() => new Set());
for (const e of entries) {
  const seen = new Uint8Array(nodes.length);
  const stack = [e];
  while (stack.length) {
    const m = stack.pop()!;
    if (seen[m]) continue;
    seen[m] = 1;
    owners[m]!.add(e);
    for (const next of imports[m]!) if (!seen[next]) stack.push(next);
  }
}
const t = performance.now();
const inspection = coLoadInspect(nodes, { budget, ...(cap !== undefined ? { cap } : {}) });
const groups = inspection.names;
console.log(`coLoadGroups: ${groups.size} grouped modules in ${(performance.now() - t).toFixed(0)} ms (budget ${budget}, cap ${cap ?? "none"})`);
// Chunk key per module: entry → its own chunk; grouped → the group; else the owner set.
const chunkKeys = nodes.map((node, m) => (node.entry ? "entry:" + node.id : (groups.get(node.id) ?? "set:" + [...owners[m]!].sort((a, b) => a - b).join(","))));
const chunkOf = (m: number): string => chunkKeys[m]!;
const chunkBytes = new Map<string, number>();
const chunkModules = new Map<string, number[]>();
nodes.forEach((m, i) => {
  const key = chunkOf(i);
  chunkBytes.set(key, (chunkBytes.get(key) ?? 0) + m.size);
  (chunkModules.get(key) ?? chunkModules.set(key, []).get(key)!).push(i);
});
const loads = (e: number): Map<string, number> => {
  const out = new Map<string, number>();
  nodes.forEach((_, m) => {
    if (owners[m]!.has(e)) out.set(chunkOf(m), chunkBytes.get(chunkOf(m))!);
  });
  return out;
};
const routeEntries = entries.filter((e) => nodes[e]!.id.includes("rivet-resume-chunk:route:"));
const counts = routeEntries.map((e) => loads(e).size).sort((a, b) => a - b);
const bytes = routeEntries.map((e) => [...loads(e).values()].reduce((n, b) => n + b, 0)).sort((a, b) => a - b);
const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? NaN;
console.log(
  `route entries: ${routeEntries.length}; chunks loaded p50 ${q(counts, 0.5)} p90 ${q(counts, 0.9)} max ${q(counts, 1)}; KB p50 ${(q(bytes, 0.5) / 1024).toFixed(0)} p90 ${(q(bytes, 0.9) / 1024).toFixed(0)} max ${(q(bytes, 1) / 1024).toFixed(0)}`,
);
for (const name of names) {
  const e = routeEntries.find((e) => nodes[e]!.id.includes(name));
  if (e === undefined) continue;
  const l = loads(e);
  const total = [...l.values()].reduce((n, b) => n + b, 0);
  const small = [...l].filter(([k, b]) => b < 2048 && !k.startsWith("entry:"));
  console.log(
    `${name}: ${l.size} chunks, ${(total / 1024).toFixed(1)} KB; < 2 KB: ${small.length} (${(small.reduce((n, [, b]) => n + b, 0) / 1024).toFixed(1)} KB)`,
  );
  if (argv.includes("--list"))
    for (const [k, b] of [...l].sort((a, b) => a[1] - b[1]).slice(0, 25)) {
      const ms = chunkModules.get(k)!;
      const first = nodes[ms[0]!]!.id;
      const why = inspection.reason.get(first);
      const own = inspection.owners.get(first)!;
      console.log(
        `   ${b} B ${k.startsWith("set:") ? `${why}, walk owners ${own.count} (${own.pinned} pinned)` : k} ← ${ms
          .slice(0, 3)
          .map((m) => nodes[m]!.id.replace(/^.*\/node_modules\//, "").replace(/^.*\/libs\//, "libs/"))
          .join(", ")}${ms.length > 3 ? " …" : ""}`,
      );
    }
}
