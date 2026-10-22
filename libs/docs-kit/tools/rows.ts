// Per-`For` share of a resumed page's `rivet/state` (lazy collection rows, spec
// docs/design/specs/2026-10-19-lazy-collection-rows-design.md T1): for every keyed `For` whose rows the server recorded,
// how many rows and how many state bytes sit inside them; Fors rendered as lazy rows report `lazy`.
//
// Derivation (the page's own HTML + state script, nothing extra emitted by the server):
// 1. The state is decoded the way the loader does it before anything reads it: the repeat + expand add-ons
//    (`resume-repeat.ts` / `resume-expand.ts`, run against a stub `document`) turn wire repeats and compact row templates
//    into full `e` / `b` entries; packed bindings (`+`) are unpacked like dom-resume `unpack`.
// 2. Keyed Fors = region binding entries (`#`) with rows at [8] (`RowsSpec`: flat `[rowId, itemRef, flags]` triples or
//    compact rows); `*` hosts (rows of a For that is no region) count too. Their rows are row regions `<!--rN[-->…<!--]-->`.
// 3. One scan of the HTML pairs markers like dom-resume `markers()` (ids left out continue the stride of the two starts
//    before them) and gives every element `data-r` id and marker id its enclosing marker.
// 4. Every record (handlers `e`, bindings `b`, models `m`, effects `fx`, client events `ce`) belongs to the innermost For
//    row that encloses its node (its region [6] when the node is no element / marker); a For's own region entry belongs
//    to the row around it. Fors with the same region symbol (the cell loop of every table row) form one group.
// 5. A table entry (`t`) is in a group's share when only that group's records reach it (through other entries); entries
//    also reached from elsewhere (the items, shared contexts, collection state) stay out.
// Share bytes = the wire JSON of the group's `e` / `b` / `m` / `fx` / `ce` entries, its Fors' row lists ([8] / [9] / [13]
// of their region entries) and its `t` entries, raw and brotli (the share's JSON alone, default quality); `saved` (probe
// only, `{ saved: true }`) = brotli of the whole state minus brotli of the state without the share.
// Lazy rows (`RIVET_LAZY_ROWS=swap` measurement builds, `libs/runtime/server-lazy-swap.ts`): a For whose rows render
// unrecorded writes `<!--L-->` before its first row and `<!--l-->` before every row; it reports `lazy` with that count.
// Lazy rows proper (LAZY-ROWS T4, default since LAZY-FLIP 2026-10-22; server env `RIVET_LAZY_ROWS=off` records): every state `L` entry (`LazyRowsEntry`
// `[forId, region, rowFn, items, by, flags, chunks, reads?, state?]`) reports `lazy`: symbol = its region's symbol, rows =
// the items list length (else the row markers `forId + 1 + k` under one parent), share = the entry's wire JSON.
// Eligibility facts (compiler `forRows`, LAZY-ROWS T2): `facts(symbol)` = the verdicts of the keyed Fors in the group
// symbol's component (`module#Component`): `eligible` when all are lazy-eligible (recorded until T4), else their reasons.
// `rowFacts(root)` compiles the group's source module on demand (server target, resume mode, no app plugins: the
// verdict depends on the For's own source) and assigns each fact to a component: the row symbol's component for lazy
// facts, else the last top-level `function X` / `const X =` declaration above the `<For` line.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync } from "node:zlib";
import { expand, strided } from "../../runtime/resume-expand.ts";
import { repeat } from "../../runtime/resume-repeat.ts";
import { full, repeated } from "../../runtime/resume-format.ts";
import type { BindingEntry, CompactRows, EntryRecord, PackedBindings, ResumeState, RowTemplate, TableEntry } from "../../runtime/resume-format.ts";

/** One group of keyed Fors on a page (same region symbol). */
export interface ForRows {
  /** Region symbol of the For's site (`module#Component$hash`), `?` when unknown. */
  symbol: string;
  /** `recorded`: the server recorded every row; `lazy`: rows carry their markers only. */
  mode: "recorded" | "lazy";
  /** Fors in the group (one per enclosing row for nested loops). */
  fors: number;
  rows: number;
  /** Why the rows are recorded (compiler facts, `facts`): its reason, or `eligible` (lazy-eligible, recorded until T4). */
  reason?: string;
  /** Depth: 0 = not inside another For's row. */
  depth: number;
  /** Records in the share. */
  entries: { e: number; b: number; t: number };
  /** Share bytes, raw wire JSON and brotli of that JSON. */
  raw: number;
  brotli: number;
  /** Brotli of the state minus brotli of the state without this share (`{ saved: true }`). */
  saved?: number;
}

export interface PageRows {
  /** `rivet/state` script bytes (raw, as written) and brotli (`{ saved: true }` only: one more compression of the state). */
  state: { raw: number; brotli?: number };
  fors: ForRows[];
}

const STATE = /<script type="rivet\/state"[^>]*>([\s\S]*?)<\/script>/;
const br = (text: string) => brotliCompressSync(Buffer.from(text)).length;

/** Eligibility of the keyed Fors behind a group symbol (`module#Component$hash`); undefined when unknown. */
export type ForFacts = (symbol: string) => { lazy: boolean; reason?: string } | undefined;

/**
 * Markers + `data-r` ids of a page: each id's enclosing marker id (-1: none), region-start markers directly inside each
 * marker, lazy row markers per enclosing marker.
 */
export function scanMarkers(html: string): {
  parent: Map<number, number>;
  regions: Map<number, number>;
  lazy: Map<number, { fors: number; rows: number }>;
} {
  const parent = new Map<number, number>(),
    regions = new Map<number, number>(),
    lazy = new Map<number, { fors: number; rows: number }>(),
    open: number[] = [];
  let last = -1,
    step = 0;
  // Comments, `data-r` attributes; raw text elements skipped (their content is no markup).
  const token = /<!--([\s\S]*?)-->|\sdata-r="(\d+)"|<(script|style|textarea|title|noscript|template)\b[^>]*>[\s\S]*?<\/\3\s*>/gi;
  for (let m: RegExpExecArray | null; (m = token.exec(html));) {
    if (m[2] !== undefined) {
      parent.set(+m[2], open.length ? open[open.length - 1]! : -1);
      continue;
    }
    if (m[1] === undefined) continue;
    const data = m[1];
    const start = /^r(\d*)(\[?)$/.exec(data);
    if (start) {
      let id: number;
      if (start[1]) ((id = +start[1]), (step = last < 0 ? 0 : id - last), (last = id));
      else id = last += step;
      const at = open.length ? open[open.length - 1]! : -1;
      parent.set(id, at);
      if (start[2]) regions.set(at, (regions.get(at) ?? 0) + 1);
      open.push(id);
    } else if ((data === "/" || data === "]") && open.length) open.pop();
    else if (data === "l" || data === "L") {
      const at = open.length ? open[open.length - 1]! : -1;
      const entry = lazy.get(at) ?? { fors: 0, rows: 0 };
      if (data === "L") entry.fors++;
      else entry.rows++;
      lazy.set(at, entry);
    }
  }
  return { parent, regions, lazy };
}

/** The loader's view of a raw state: repeats and compact row templates decoded (stub `document`). */
function decode(state: ResumeState): void {
  const scope = globalThis as { document?: unknown };
  const had = "document" in scope,
    before = scope.document;
  const stub: { $rx?: (s: ResumeState, list: BindingEntry[]) => void } = {};
  scope.document = stub;
  try {
    expand();
    // DOM-DATA builds' part of the expand add-on (`EXPAND_DOM`): strided item refs `rs` back to `r`.
    strided();
    repeat();
    stub.$rx!(state, state.b);
  } finally {
    if (had) scope.document = before;
    else delete scope.document;
  }
}

/** Table refs an entry holds (wire forms: compact recipes, `{y}` repeats, `{w, o}` shapes). */
function tableRefs(table: readonly TableEntry[], index: number, out: number[]): void {
  const entry = table[index];
  if (entry === null || typeof entry !== "object") return;
  if (Array.isArray(entry)) {
    for (const ref of entry) if (ref >= 0) out.push(ref);
    return;
  }
  let record: EntryRecord = entry;
  if (record.y !== undefined) {
    out.push(record.y);
    record = repeated(table, index, record.y);
  } else record = full(record);
  if (record.w !== undefined) out.push(record.w);
  if (record.o) for (let i = record.w !== undefined ? 0 : 1; i < record.o.length; i += record.w !== undefined ? 1 : 2) out.push(record.o[i] as number);
  if (record.p) for (const value of record.p) if (Array.isArray(value)) out.push(value[0]);
  if (record.m) out.push(...record.m);
  if (record.e) out.push(...record.e);
  if (record.E && record.E.length > 2) out.push(record.E[2] as number);
  if (record.i) out.push(record.i[0]);
  if (record.s !== undefined) out.push(record.s);
  if (typeof record.q === "number") out.push(record.q);
  if (record.a) out.push(...record.a);
}

/** Symbol ids of the wire symbol list (`ResumeRecords.s`), by page index. */
function symbolIds(list: readonly (string | number)[]): string[] {
  const out: string[] = [];
  let module = "",
    component = "";
  for (const item of list) {
    if (typeof item === "number") continue;
    if (item.startsWith("$")) {
      for (const suffix of item.split("$").slice(1)) out.push(`${module}#${component}$${suffix}`);
      continue;
    }
    const id = item.startsWith("#") ? module + item : item;
    const hash = id.indexOf("#");
    module = id.slice(0, hash);
    component = id.slice(hash + 1).split("$")[0]!;
    out.push(id);
  }
  return out;
}

const isRows = (entry: BindingEntry): boolean => {
  const slot = entry[8];
  if (!slot || entry[1] === "+") return false;
  // Branch specs carry `k`; compact rows never do.
  return Array.isArray(slot) ? typeof slot[0] !== "object" : !("k" in slot);
};
const rowIds = (entry: BindingEntry, table: readonly TableEntry[]): number[] => {
  const rows = entry[8] as number[] | CompactRows;
  if (Array.isArray(rows)) return rows.filter((_, i) => i % 3 === 0);
  const items = (rows.a !== undefined ? table[rows.a] : rows.r) as number[];
  return items.map((_, k) => (rows.ids ? rows.ids[k]! : rows.i! + k * rows.d!));
};

/**
 * Rows and their state share per keyed For group of a page's HTML (null: no `rivet/state`). `saved` adds the marginal
 * brotli per group (one compression of the state per group: probe only).
 */
export function pageRows(html: string, options: { saved?: boolean; facts?: ForFacts } = {}): PageRows | null {
  const match = STATE.exec(html);
  if (!match) return null;
  const text = match[1]!;
  const wire = JSON.parse(text) as ResumeState;
  const state = JSON.parse(text) as ResumeState;
  const wireB = wire.b.length;
  decode(state);
  const table = state.t;
  const symbols = symbolIds(state.s ?? []);
  const { parent, regions: childRegions, lazy } = scanMarkers(html);
  // Path-addressed rows (`w`, no `data-r`): element j of row k is id row + 1 + j, inside its row region.
  for (const [first, stride, count, paths] of state.w ?? [])
    for (let k = 0; k < count; k++) for (let j = 0; j < paths.length; j++) parent.set(first + k * stride + 1 + j, first + k * stride);
  // Fors: region entries with rows; row id → For (index into fors).
  const fors: { entry: number; node: number; symbol: string; rows: number[]; group: number }[] = [];
  const rowOf = new Map<number, number>();
  for (let j = 0; j < state.b.length; j++) {
    const entry = state.b[j]!;
    if (!(entry[1] === "#" || entry[1] === "*") || !isRows(entry)) continue;
    const rows = rowIds(entry, table);
    const k = fors.push({ entry: j, node: entry[0], symbol: symbolName(entry[2], symbols), rows, group: -1 }) - 1;
    for (const row of rows) rowOf.set(row, k);
  }
  // Innermost For row enclosing a node (exclusive of the node itself unless `self`).
  const forOf = (node: number, self: boolean): number => {
    let at = self ? node : (parent.get(node) ?? -1);
    for (let guard = 0; at >= 0 && guard < 10_000; guard++) {
      const k = rowOf.get(at);
      if (k !== undefined) return k;
      at = parent.get(at) ?? -1;
    }
    return -1;
  };
  // Groups by symbol; depth = Fors enclosing the group's first For.
  const groups: { symbol: string; fors: number[]; depth: number }[] = [];
  const bySymbol = new Map<string, number>();
  for (let k = 0; k < fors.length; k++) {
    const f = fors[k]!;
    let g = bySymbol.get(f.symbol);
    if (g === undefined) {
      let depth = 0;
      for (let at = forOf(f.node, false); at >= 0 && depth < 100; at = forOf(fors[at]!.node, false)) depth++;
      bySymbol.set(f.symbol, (g = groups.push({ symbol: f.symbol, fors: [], depth }) - 1));
    }
    f.group = g;
    groups[g]!.fors.push(k);
  }
  const OUT = -1;
  const groupOfNode = (node: number, region: number): number => {
    const k = node >= 0 && parent.has(node) ? forOf(node, false) : forOf(region, true);
    return k < 0 ? OUT : fors[k]!.group;
  };
  // Records per group: refs they hold (roots of the table walk) and their wire bytes.
  const roots = new Map<number, number[]>();
  const bytes = new Map<number, { raw: string[]; e: number; b: number }>();
  const root = (g: number, refs: Iterable<number>) => {
    const list = roots.get(g) ?? roots.set(g, []).get(g)!;
    for (const ref of refs) {
      if (ref >= 0) list.push(ref);
      else if (ref <= -10) {
        const value = state.k?.[-ref - 10];
        if (typeof value === "number" && value >= 0) list.push(value);
      }
    }
  };
  const share = (g: number) => bytes.get(g) ?? bytes.set(g, { raw: [], e: 0, b: 0 }).get(g)!;
  const wireE = wire.e as Record<string, unknown>;
  for (const id in state.e) {
    const g = groupOfNode(+id, -1);
    for (const type in state.e[id]) root(g, state.e[id]![type]![1]);
    if (g !== OUT && id in wireE) {
      const s = share(g);
      s.raw.push(JSON.stringify(id) + ":" + JSON.stringify(wireE[id]));
      s.e++;
    }
  }
  for (const id in state.m ?? {}) {
    const g = groupOfNode(+id, -1);
    root(g, [state.m[id]![1]]);
    if (g !== OUT) share(g).raw.push(JSON.stringify(id) + ":" + JSON.stringify(wire.m[id]));
  }
  const forEntry = new Map(fors.map((f, k) => [f.entry, k]));
  for (let j = 0; j < state.b.length; j++) {
    const entry = state.b[j]!;
    const k = forEntry.get(j);
    // An expanded template entry ends with its row id; a packed entry's rows sit in regions [6] + base offset.
    const expanded = j >= wireB;
    let g: number;
    if (entry[1] === "+") {
      const { i, d, ids, k: count, n, r, b, g: own } = entry[8] as PackedBindings;
      const groupsOf = new Set<number>();
      for (let row = 0; row < count; row++) {
        const base = ids ? ids[row]! : i! + row * d!;
        const region = own ? entry[6] + base - (ids ? ids[0]! : i!) : entry[6];
        const rg = groupOfNode(base + (b[0]?.[0] ?? 0), region);
        groupsOf.add(rg);
        for (const item of b) root(rg, [...item[3].map((ref) => (ref < 0 ? r[row * n - 1 - ref]! : ref)), ...item[4]]);
      }
      g = groupsOf.size === 1 ? [...groupsOf][0]! : OUT;
    } else {
      g = expanded ? groupOfNode(-1, entry[entry.length - 1] as number) : groupOfNode(entry[0], entry[6]);
      root(g, [...entry[3], ...entry[4]]);
      // Region data: locals [11], providers [12] (a number: a table array), row reads [13], row items, branch values.
      const locals = entry[11] as { l?: (number | null)[] } | null | undefined;
      if (locals && typeof locals === "object" && !Array.isArray(locals))
        root(
          g,
          (locals.l ?? []).filter((x): x is number => x !== null),
        );
      const providers = entry[12];
      if (typeof providers === "number") root(g, [providers]);
      else if (Array.isArray(providers)) root(g, providers.filter((_, i) => i % 2 === 1) as number[]);
      if (Array.isArray(entry[13])) root(g, entry[13] as number[]);
      if (k !== undefined) {
        const rows = entry[8] as number[] | CompactRows;
        root(g, Array.isArray(rows) ? rows.filter((_, i) => i % 3 === 1) : rows.a !== undefined ? [rows.a] : (rows.r ?? []));
        const tpl = entry[9] as RowTemplate | 0 | undefined;
        if (tpl) for (const binding of tpl.b) root(g, [...binding[3], ...binding[4]]);
      }
    }
    if (expanded) continue;
    const wireEntry = wire.b[j]!;
    if (k === undefined) {
      if (g !== OUT) {
        const s = share(g);
        s.raw.push(JSON.stringify(wireEntry));
        s.b++;
      }
      continue;
    }
    // A For's region entry: its row lists ([8] rows, [9] template, [13] row reads) are its own rows' wire; the rest
    // belongs to the row around the For (a nested loop disappears with that row), else stays.
    const lists = JSON.stringify([wireEntry[8], wireEntry[9] ?? 0, wireEntry[13] ?? null]);
    share(fors[k]!.group).raw.push(lists);
    if (g !== OUT) {
      const s = share(g);
      s.raw.push(JSON.stringify(stripLists(wireEntry)));
      s.b++;
    }
  }
  for (const effect of state.fx ?? []) root(groupOfNode(-1, effect[4]), effect[1]);
  for (const event of state.ce ?? []) root(groupOfNode(-1, event[6]), event[1]);
  // Table owners: the one group whose records reach the entry, else shared (-2).
  const SHARED = -2;
  const owner = new Int32Array(table.length).fill(-3);
  const refs: number[] = [];
  for (const [g, list] of roots) {
    const stack = list.slice();
    while (stack.length) {
      const index = stack.pop()!;
      if (index >= table.length) continue;
      const was = owner[index]!;
      if (was === g || was === SHARED) continue;
      owner[index] = was === -3 ? g : SHARED;
      refs.length = 0;
      tableRefs(table, index, refs);
      stack.push(...refs);
    }
  }
  const counts = new Map<number, number>();
  for (let index = 0; index < table.length; index++) {
    const g = owner[index]!;
    if (g < 0) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
    share(g).raw.push(JSON.stringify(wire.t[index]));
  }
  // `saved` compares two re-serializations (the script may escape `<` etc.; JSON.stringify does not).
  const whole = options.saved ? br(JSON.stringify(wire)) : 0;
  const out: ForRows[] = groups.map((group, g) => {
    const s = bytes.get(g) ?? { raw: [], e: 0, b: 0 };
    const joined = s.raw.join(",");
    const result: ForRows = {
      symbol: group.symbol,
      mode: "recorded",
      fors: group.fors.length,
      rows: group.fors.reduce((sum, k) => sum + fors[k]!.rows.length, 0),
      depth: group.depth,
      entries: { e: s.e, b: s.b, t: counts.get(g) ?? 0 },
      raw: joined.length,
      brotli: joined ? br(joined) : 0,
    };
    const fact = options.facts?.(group.symbol);
    if (fact) result.reason = fact.lazy ? "eligible" : (fact.reason ?? "ineligible");
    if (options.saved) result.saved = whole - br(JSON.stringify(without(wire, state, g, owner, fors, groupOfNode, wireB)));
    return result;
  });
  // Lazy Fors: rows marked `<!--l-->` inside a region (swap harness), or state `L` entries (T4).
  const regions = new Map<number, BindingEntry>();
  for (const entry of state.b) if (entry[1] === "#") regions.set(entry[0], entry);
  const lazyFor = (symbol: string, count: number, rows: number): ForRows => ({
    symbol,
    mode: "lazy",
    fors: count,
    rows,
    depth: 0,
    entries: { e: 0, b: 0, t: 0 },
    raw: 0,
    brotli: 0,
    ...(options.saved ? { saved: 0 } : {}),
  });
  for (const [at, { fors: count, rows }] of lazy) {
    const region = regions.get(at);
    out.push(lazyFor(region ? symbolName(region[2], symbols) : "?", count || 1, rows));
  }
  for (const entry of wire.L ?? []) {
    const region = regions.get(entry[1]);
    // Rows: the items list length (plain JSON `{j}` / array entry), else the row markers after the For id that share the first one's parent.
    const items = table[entry[3]] as unknown;
    let rows = Array.isArray(items) ? items.length : Array.isArray((items as { j?: unknown } | null)?.j) ? (items as { j: unknown[] }).j.length : -1;
    if (rows < 0) {
      const at = parent.get(entry[0] + 1);
      rows = 0;
      while (parent.has(entry[0] + 1 + rows) && parent.get(entry[0] + 1 + rows) === at) rows++;
    }
    const json = JSON.stringify(entry);
    out.push({ ...lazyFor(region ? symbolName(region[2], symbols) : "?", 1, rows), raw: json.length, brotli: br(json) });
  }
  out.sort((a, b) => a.depth - b.depth || b.raw - a.raw);
  return { state: { raw: Buffer.byteLength(text), ...(options.saved ? { brotli: br(text) } : {}) }, fors: out };
}

function symbolName(ref: unknown, symbols: readonly string[]): string {
  return typeof ref === "number" ? (symbols[ref] ?? "?") : typeof ref === "string" ? ref : "?";
}

/** The wire state without group `g`'s share (table entries → 0, so indexes stay). */
function without(
  wire: ResumeState,
  state: ResumeState,
  g: number,
  owner: Int32Array,
  fors: { entry: number; group: number }[],
  groupOfNode: (node: number, region: number) => number,
  wireB: number,
): ResumeState {
  const e: Record<string, unknown> = {};
  for (const id in wire.e) if (groupOfNode(+id, -1) !== g) e[id] = (wire.e as Record<string, unknown>)[id];
  const own = new Set(fors.filter((f) => f.group === g).map((f) => f.entry));
  const b: unknown[] = [];
  for (let j = 0; j < wireB; j++) {
    const entry = state.b[j]!;
    if (entry[1] !== "+" && groupOfNode(entry[0], entry[6]) === g) continue;
    b.push(own.has(j) ? stripLists(wire.b[j]!) : wire.b[j]);
  }
  return { ...wire, e: e as ResumeState["e"], b: b as ResumeState["b"], t: wire.t.map((entry, index) => (owner[index] === g ? 0 : entry)) };
}

/** A region entry without its row lists ([8], [9], [13] → 0). */
function stripLists(entry: BindingEntry): unknown[] {
  const copy: unknown[] = entry.slice();
  for (const slot of [8, 9, 13]) if (slot < copy.length) copy[slot] = 0;
  return copy;
}

/** One compiler verdict (`compile(…).forRows[i]`, `@rivetjs/compiler` `ForRowFact`). */
export interface ForFact {
  line: number;
  lazy: boolean;
  reason?: string;
  symbol?: string;
}

/** Component of each fact: the row symbol's (lazy) or the last top-level declaration above the For's line. */
export function factComponents(source: string, facts: readonly ForFact[]): string[] {
  const decls: [line: number, name: string][] = [];
  source.split("\n").forEach((text, index) => {
    const m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*([\w$]+)|(?:const|let|var)\s+([\w$]+)\s*[:=])/.exec(text);
    if (m) decls.push([index + 1, (m[1] ?? m[2])!]);
  });
  return facts.map((fact) => {
    const own = fact.symbol && /#([\w$]+?)\$[^#$]*$/.exec(fact.symbol);
    if (own) return own[1]!;
    let name = "?";
    for (const [line, decl] of decls) if (line <= fact.line) name = decl;
    return name;
  });
}

/** Group facts by component: lazy iff every For of it is lazy-eligible; reasons joined (`/`, first seen order). */
export function componentFacts(module: string, source: string, facts: readonly ForFact[]): Map<string, { lazy: boolean; reason?: string }> {
  const out = new Map<string, { lazy: boolean; reason?: string }>();
  const components = factComponents(source, facts);
  facts.forEach((fact, k) => {
    const key = `${module}#${components[k]}`;
    const prior = out.get(key) ?? { lazy: true };
    if (!fact.lazy) {
      const reasons = prior.reason ? prior.reason.split("/") : [];
      const reason = fact.reason ?? "ineligible";
      if (!reasons.includes(reason)) reasons.push(reason);
      prior.lazy = false;
      prior.reason = reasons.join("/");
    }
    out.set(key, prior);
  });
  return out;
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
/** Source file of a resume module id: `@rivetjs/<lib>/<path>` → `libs/<lib>/<path>`, else relative to the app root. */
export function moduleFile(root: string, module: string): string {
  const lib = /^@rivetjs\/([^/]+)\/(.+)$/.exec(module);
  return lib ? resolve(REPO, "libs", lib[1]!, lib[2]!) : resolve(root, module);
}

/** Compiler facts for the groups of an app's pages (`root` = app root): modules compiled once, on first use. */
export async function rowFacts(root: string): Promise<ForFacts> {
  const { compile } = await import("../../compiler/index.ts");
  const modules = new Map<string, Map<string, { lazy: boolean; reason?: string }> | null>();
  return (symbol) => {
    const hash = symbol.indexOf("#");
    if (hash < 0) return undefined;
    const module = symbol.slice(0, hash);
    if (!modules.has(module)) {
      let facts: Map<string, { lazy: boolean; reason?: string }> | null = null;
      try {
        const source = readFileSync(moduleFile(root, module), "utf8");
        const result = compile(source, { target: "server", filename: module, resume: { module } }) as { forRows?: ForFact[] };
        facts = componentFacts(module, source, result.forRows ?? []);
      } catch {
        // Unknown file / compile failure: no facts for its groups.
      }
      modules.set(module, facts);
    }
    return modules.get(module)?.get(symbol.replace(/\$[^#$]*$/, ""));
  };
}

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
const short = (symbol: string) => symbol.replace(/^.*\//, "");

/** The `rows:` column of a page (check-examples): `-` without keyed Fors. */
export function rowsColumn(rows: PageRows | null): string {
  if (!rows || !rows.fors.length) return "rows: -";
  return (
    "rows: " +
    rows.fors
      .map((f) => {
        const per = f.rows ? ` ${kb(Math.round(f.raw / f.rows))} / ${kb(Math.round(f.brotli / f.rows))} br per row` : "";
        const nested = f.depth ? `${"+".repeat(f.depth)} ` : "";
        return `${nested}${f.mode}${f.reason ? ` (${f.reason})` : ""} ${short(f.symbol)} ×${f.rows}${f.fors > 1 ? ` in ${f.fors} lists` : ""}${per}`;
      })
      .join("; ")
  );
}
