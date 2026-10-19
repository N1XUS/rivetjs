// Test helper: a parsed resume state (or patch) in the readable shape tests assert on — wire symbol indexes back to
// symbol ids (`s` as id → chunk), table entries in full form (`{R}` relocations and repeated handler maps / bindings
// decoded by the page's repeat add-on, `{y}` repeats, compact `{f|c|k: [..]}`, `{w}` shapes), table-held binding names and provider
// token ids back to strings. `page` carries the symbol list + table across patches. Lazy row records (`L`, format v2) stay as
// written: their row function / items / `by` are table refs (read them through `page.table`), `chunks` chunk indexes.
import { full, repeated } from "@rivetjs/runtime/resume-format";
import type { BindingEntry, EntryRecord, LoaderDocument, ResumeState, TableEntry } from "@rivetjs/runtime/resume-format";
import { REPEAT } from "../../resume-loader.min.ts";

export interface WireSymbols {
  ids: string[];
  chunks: number[];
  table: unknown[];
}

export function readable<T>(input: T, page: WireSymbols = { ids: [], chunks: [], table: [] }): T {
  const state = input as Record<string, unknown> & { t?: TableEntry[]; t0?: number; s?: (string | number)[] };
  const from = page.ids.length;
  let chunk = -1,
    unit = "",
    component = "";
  for (const x of state.s ?? []) {
    if (typeof x === "number") {
      chunk = x;
      continue;
    }
    // `$a$b…`: a run of ids of the previous id's module + component (dom-resume `named`).
    if (x[0] === "$" && !x.includes("#")) {
      for (const suffix of x.slice(1).split("$")) (page.ids.push(unit + "#" + component + "$" + suffix), page.chunks.push(chunk));
      continue;
    }
    const id = x[0] === "#" ? unit + x : x;
    const hash = id.indexOf("#"),
      dollar = id.lastIndexOf("$");
    unit = id.slice(0, hash);
    component = dollar > hash + 1 ? id.slice(hash + 1, dollar) : "";
    page.ids.push(id);
    page.chunks.push(chunk);
  }
  if (state.s) state.s = Object.fromEntries(page.ids.slice(from).map((id, i) => [id, page.chunks[from + i]])) as never;
  const sym = (ref: unknown): unknown => (typeof ref === "number" ? page.ids[ref] : ref);
  const t0 = state.t0 ?? 0;
  const t = state.t ?? [];
  // Index-aligned with the page table (patches continue at t0).
  page.table.length = t0;
  for (const entry of t) page.table.push(entry);
  // Table relocations (`{R}`), repeated handler maps / bindings (`RepeatedHandlers` / `RepeatedBinding`): decoded as the
  // page's repeat add-on does (in place, from t0).
  {
    const d = {} as LoaderDocument,
      e = state.e ?? {};
    new Function("document", REPEAT)(d);
    d.$rx!({ t: page.table, e } as unknown as ResumeState, (state.b ?? []) as BindingEntry[], { t0, e } as never);
    for (let i = 0; i < t.length; i++) t[i] = page.table[t0 + i] as TableEntry;
  }
  const table = page.table as TableEntry[];
  for (let i = 0; i < t.length; i++) {
    let entry = t[i]!;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    if ("y" in entry) entry = repeated(table, t0 + i, entry.y!);
    else if ("w" in entry) {
      const base = table[entry.w!] as EntryRecord;
      const keys = (base.o ?? base.p)!;
      const values = (entry.o ?? entry.p)! as unknown[];
      const pairs = values.flatMap((v, k) => [keys[2 * k], v]);
      entry = "o" in entry ? { o: pairs as never } : { p: pairs as never };
    } else entry = full(entry);
    if (entry.f !== undefined) entry = { ...entry, f: sym(entry.f) as string };
    if (entry.c !== undefined) entry = { ...entry, c: sym(entry.c) as string };
    if (entry.cls !== undefined) entry = { ...entry, cls: sym(entry.cls) as string };
    t[i] = entry;
  }
  for (let i = 0; i < t.length; i++) page.table[t0 + i] = t[i];
  const name = (n: unknown): unknown => (typeof n === "number" ? page.table[n] : n);
  const handlers = (e: Record<string, Record<string, unknown[]>> | undefined) => {
    for (const id in e ?? {}) for (const type in e![id]) e![id]![type]![0] = sym(e![id]![type]![0]);
  };
  handlers(state.e as never);
  for (const b of (state.b ?? []) as unknown[][]) {
    b[1] = name(b[1]);
    b[2] = sym(b[2]);
    if (b[1] === "+") for (const item of (b[8] as { b: unknown[][] }).b) ((item[1] = name(item[1])), (item[2] = sym(item[2])));
    const tpl = b[9] as { b: unknown[][]; e: Record<string, Record<string, unknown[]>> } | 0 | undefined;
    if (tpl) {
      for (const item of tpl.b) ((item[1] = name(item[1])), (item[2] = sym(item[2])));
      handlers(tpl.e);
    }
    // A shared provider list: the table array holding it (copied, then read like an inline list).
    if (typeof b[12] === "number") b[12] = (page.table[b[12]] as unknown[]).slice();
    if (Array.isArray(b[12])) for (let k = 0; k < b[12].length; k += 2) b[12][k] = name(b[12][k]);
  }
  for (const list of [state.fx, state.ce] as (unknown[][] | undefined)[]) for (const entry of list ?? []) entry[0] = sym(entry[0]);
  return input;
}
