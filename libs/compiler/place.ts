// PLACE (phase 1, spec docs/design/specs/2026-10-26-automatic-placement-design.md): automatic placement of the derived
// model's per-call-site independence. Not a package export; `vite.ts` `derivedWalk` calls `placeVerdicts()` after
// `boundaryFacts()` and compiles each module with the placed `resume.site` / `resume.sites` lists.
//
// The build hands the compiler's `place` op (Rust `rust/src/place/*`) the whole-program graph: every walked component
// with its fixpoint facts and cost features (`moduleFacts` `elements`, `calls[].bytes`, module source bytes), every
// resolved call site with its context-proof result, and the pages (route / derived roots and shell pages). Rust maps the
// facts to legal backends, prices page views with the cost table and picks per site. The heuristic table (default) is
// today's rule — every proven site uses `site` — so the default build is byte-identical to the unplaced one; `measured`
// uses the calibrated table (`place-table.json`, written by `scripts/place/calibrate.ts`).
import { readFileSync } from "node:fs";
import { call } from "./wasm.ts";
import type { BoundaryFacts } from "./facts-fixpoint.ts";
import type { ModuleFacts } from "./index.ts";

/** Cost table (Rust `place/cost.rs` `Table`): every coefficient in ms of client time per unit. */
export interface PlacementTable {
  kind: "heuristic" | "measured" | "custom";
  siteBonus?: number;
  htmlMsPerByte?: number;
  jsMsPerByte?: number;
  runtimeLiteMs?: number;
  runtimeFullMs?: number;
  recordBytes?: number;
  dependentRecordBytes?: number;
  propsRatio?: number;
  adoptMsPerElement?: number;
  adoptMsPerRecord?: number;
  pInteract?: number;
  serverUsPerRecord?: number;
  serverUsPerStateByte?: number;
  serverMsPerUs?: number;
  /** Provenance (calibration): machine, date, profile, raw measurements. Ignored by the solver. */
  meta?: Record<string, unknown>;
}

/** `rivet({ resume: { placement } })`. */
export type PlacementOption =
  | "heuristic"
  | "measured"
  | "off"
  | PlacementTable
  | {
      table?: "heuristic" | "measured" | PlacementTable | string;
      /** Write the decision report (`explain-placement`) to this file (also env `RIVET_PLACEMENT_EXPLAIN`). */
      explain?: string;
      /** Page weights (traffic share) by page id (root-relative `file` or `file#Name`); default 1. */
      weights?: Record<string, number>;
    };

/** The `place` op result. */
export interface PlacementResult {
  /** Per graph site: the `site` backend chosen. */
  sites: boolean[];
  /** Per graph site: `site` legal (today's choice). */
  legal: boolean[];
  method: "exact" | "local-search";
  variables: number;
  regions: number;
  largestRegion: number;
  evaluations: number;
  pages: number;
  truncatedPages: number;
  instances: number;
  cost: { today: number; chosen: number; conservative: number };
  table: string;
  explain?: unknown;
}

/** The graph handed to Rust (`place/ir.rs`). */
export interface PlacementGraph {
  modules: { id: string; bytes: number }[];
  components: {
    id: string;
    module: number;
    elements: number;
    interactive: boolean;
    source: boolean;
    live: boolean;
    adopted: boolean;
    independent: boolean;
    free: boolean;
    root: boolean;
    siteCapable: boolean;
    lite: boolean;
  }[];
  sites: { caller: number; callee: number; index: number; bytes: number; proof: string; demoted: boolean; data?: boolean }[];
  pages: { id: string; root: number; weight: number }[];
}

export interface PlacementInput {
  facts: ReadonlyMap<string, ModuleFacts>;
  verdicts: BoundaryFacts;
  /** Source bytes per walked file. */
  bytes: ReadonlyMap<string, number>;
  /** Page roots: component keys (`file?Name`) of route / derived roots and shell pages. */
  pages: readonly string[];
  table: PlacementTable;
  weights?: Readonly<Record<string, number>>;
  explain?: boolean;
  /** Display id of a file (root-relative) for page ids / reports. */
  display?: (file: string) => string;
}

export interface Placement {
  /** Placed `resume.site` (component names) per file. */
  site(file: string): string[];
  /** Placed `resume.sites` (`Caller:index`) per file. */
  sites(file: string): string[];
  result: PlacementResult;
  graph: PlacementGraph;
  /** The legal set the Rust side computed equals today's call-site marks (false: the build fell back to today's). */
  agrees: boolean;
}

export const HEURISTIC: PlacementTable = { kind: "heuristic", siteBonus: 1 };

const tableFile = new URL("./place-table.json", import.meta.url);

/** Resolve a table option: `heuristic`, `measured` (the calibrated `place-table.json`), a JSON file path, or a table. */
export function placementTable(option: "heuristic" | "measured" | PlacementTable | string | undefined): PlacementTable {
  if (option === undefined || option === "heuristic") return HEURISTIC;
  if (typeof option === "object") return option;
  const text = readFileSync(option === "measured" ? tableFile : option, "utf8");
  return JSON.parse(text) as PlacementTable;
}

/** Build the whole-program graph, run the `place` op, and return the placed call-site verdicts. */
export function placeVerdicts(input: PlacementInput): Placement {
  const { facts, verdicts } = input;
  const proof = verdicts.callSites;
  const display = input.display ?? ((f: string) => f);
  const files = [...facts.keys()];
  const moduleIndex = new Map(files.map((f, i) => [f, i]));
  const graph: PlacementGraph = { modules: files.map((f) => ({ id: display(f), bytes: input.bytes.get(f) ?? 0 })), components: [], sites: [], pages: [] };
  const componentIndex = new Map<string, number>();
  const free = new Map<string, Set<string>>();
  for (const [file, byName] of verdicts.verdicts) {
    const f = facts.get(file);
    if (!f) continue;
    const freeNames = new Set(proof?.free(file) ?? []);
    free.set(file, freeNames);
    for (const [name, v] of byName) {
      const id = file + "?" + name;
      const c = f.boundaries.get(name)!;
      componentIndex.set(id, graph.components.length);
      graph.components.push({
        id: display(file) + "?" + name,
        module: moduleIndex.get(file)!,
        elements: c.elements ?? 0,
        interactive: v.interactive,
        source: c.source || c.listens,
        live: v.because === "live-props" || v.because === "live-context",
        adopted: v.adopted,
        independent: v.independent,
        free: freeNames.has(name),
        root: verdicts.roots.has(id),
        siteCapable:
          v.interactive &&
          !v.independent &&
          !verdicts.roots.has(id) &&
          c.params === "object" &&
          (v.dependentBecause === "context" || v.dependentBecause === "call-site"),
        lite: false,
      });
    }
  }
  // Sites: every resolved call, in callee order (the trace's order); `key` → graph site index.
  const siteKey = new Map<string, number>();
  for (const [callee, list] of verdicts.callers) {
    const to = componentIndex.get(callee);
    if (to === undefined) continue;
    const results = proof?.trace.get(callee);
    list.forEach((s, k) => {
      const from = componentIndex.get(s.caller);
      if (from === undefined) return;
      const at = s.caller.lastIndexOf("?");
      const callerFacts = facts.get(s.caller.slice(0, at))?.boundaries.get(s.caller.slice(at + 1));
      siteKey.set(s.caller + ":" + s.index, graph.sites.length);
      const callFacts = callerFacts?.calls[s.index];
      graph.sites.push({
        caller: from,
        callee: to,
        index: s.index,
        bytes: callFacts?.bytes ?? 0,
        proof: results?.[k] ?? "",
        demoted: callFacts?.children ?? false,
        data: callFacts?.inputs ?? false,
      });
    });
  }
  for (const id of input.pages) {
    const root = componentIndex.get(id);
    if (root === undefined) continue;
    const at = id.lastIndexOf("?");
    const pageId = display(id.slice(0, at)) + "#" + id.slice(at + 1);
    graph.pages.push({ id: pageId, root, weight: input.weights?.[pageId] ?? input.weights?.[display(id.slice(0, at))] ?? 1 });
  }
  const result = call<PlacementResult>({ op: "place", graph, table: input.table, explain: !!input.explain });
  // Today's marks (callSites) vs the Rust legal set: they must agree, else keep today's (byte-identical) verdicts.
  const today = new Set<number>();
  let agrees = true;
  for (const file of files)
    for (const mark of proof?.sites(file) ?? []) {
      const caller = mark.slice(0, mark.lastIndexOf(":"));
      const index = mark.slice(mark.lastIndexOf(":") + 1);
      const i = siteKey.get(file + "?" + caller + ":" + index);
      if (i === undefined) agrees = false;
      else today.add(i);
    }
  result.legal.forEach((legal, i) => {
    if (legal !== today.has(i)) agrees = false;
  });
  const chosen = agrees ? result.sites : result.legal.map((_, i) => today.has(i));
  const onCallee = new Set<number>();
  chosen.forEach((on, i) => on && onCallee.add(graph.sites[i]!.callee));
  return {
    result,
    graph,
    agrees,
    site: (file) => (proof?.site(file) ?? []).filter((name) => onCallee.has(componentIndex.get(file + "?" + name) ?? -1)),
    sites: (file) =>
      (proof?.sites(file) ?? []).filter((mark) => {
        const i = siteKey.get(file + "?" + mark.slice(0, mark.lastIndexOf(":")) + ":" + mark.slice(mark.lastIndexOf(":") + 1));
        return i !== undefined && chosen[i] === true;
      }),
  };
}

/** Text report of a placement (`explain-placement`): decisions that differ from today's first, then the rest. */
export function explainText(p: { result: PlacementResult; graph: PlacementGraph }, options: { all?: boolean; filter?: string } = {}): string {
  const { result, graph } = p;
  const lines: string[] = [];
  const c = result.cost;
  lines.push(
    `placement: table ${result.table}, ${result.method}, ${result.variables} variables in ${result.regions} regions (largest ${result.largestRegion}), ` +
      `${result.pages} pages (${result.truncatedPages} truncated), ${result.instances} instances, ${result.evaluations} page evaluations`,
  );
  lines.push(`cost (ms / all page views): today ${c.today.toFixed(3)}  chosen ${c.chosen.toFixed(3)}  conservative ${c.conservative.toFixed(3)}`);
  const explain = result.explain as
    { sites: { site: number; backend: string; legal: string[]; why: string; pages?: number; ifOther?: Record<string, number | string> }[] } | undefined;
  if (!explain) return lines.join("\n") + "\n(no per-site report: run with explain)\n";
  const name = (i: number) => graph.components[i]!.id;
  const rows = explain.sites
    .map((s) => {
      const site = graph.sites[s.site]!;
      const label = `${name(site.caller)} → <${name(site.callee).split("?")[1]}> (call ${site.index})`;
      const changed = result.legal[s.site] !== result.sites[s.site];
      return { s, label, changed };
    })
    .filter((r) => !options.filter || r.label.includes(options.filter))
    .sort((a, b) => Number(b.changed) - Number(a.changed));
  for (const { s, label, changed } of rows) {
    if (!options.all && !changed && s.legal.length < 2) continue;
    const o = s.ifOther;
    const delta = o
      ? `  if ${o.backend}: ${Number(o.ms) >= 0 ? "+" : ""}${Number(o.ms).toFixed(4)} ms (records ${o.records}, state ${Number(o.stateBytes).toFixed(0)} B, js src ${o.jsSourceBytes} B, adopt ${Number(o.adoptElements).toFixed(1)} el / ${Number(o.adoptRecords).toFixed(2)} rec, server ${Number(o.serverUs).toFixed(2)} µs) on ${s.pages} pages`
      : "";
    lines.push(`${changed ? "*" : " "} ${s.backend.padEnd(11)} ${label}  [legal: ${s.legal.join(", ")}; ${s.why}]${delta}`);
  }
  return lines.join("\n") + "\n";
}
