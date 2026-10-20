// Development only (imported by dev/on.ts; production resolution never reaches it): resume state-size attribution.
// `server-resume.ts` calls `DEV.stateSites(…)` under `if (DEV)`, so production folds the call and this module away.
import type {
  BindingEntry,
  BindingName,
  BranchSpec,
  ClientEventEntry,
  CompactRows,
  EffectEntry,
  HandlerEntry,
  ModelEntry,
  PackedBindings,
  RegionLocals,
  SymbolRef,
  TableEntry,
  TemplateBinding,
} from "../resume-format.ts";
import { kb } from "./kb.ts";

/**
 * Dev only (STATE-WARN, `DEV.stateCaptures`): what each capture site of this segment adds to `rivet/state`. Sites in the
 * order `encodeRecords` encoded them (handlers, models, bindings, regions, effects, client events); a site's capture `i`
 * owns the wire bytes (`wire[index - t0]`, JSON + comma) of every new table entry it reaches first, so the sites add up to
 * the segment's table and a value shared by many sites is counted once, at the first. A function / computed recipe
 * reached through a capture is a site of its own (its captures named by the recipe's symbol). Lazy row records (`L`) are
 * no capture sites: their rows record nothing. Called only under `if (DEV)` (`DEV.stateSites`), so production folds the call and this module away.
 */
export function stateSites(
  table: readonly TableEntry[],
  symbols: ReadonlyMap<string, number>,
  names: Record<string, readonly string[]> | undefined,
  t0: number,
  wire: readonly TableEntry[],
  e: Record<string, Record<string, HandlerEntry>>,
  m: Record<string, ModelEntry>,
  b: BindingEntry[],
  fx: EffectEntry[],
  ce: ClientEventEntry[],
): { key: string; site: string; shape: string; bytes: number }[] {
  const ids: string[] = [];
  for (const [id, index] of symbols) ids[index] = id;
  const symbolId = (symbol: SymbolRef): string => (typeof symbol === "number" ? (ids[symbol] ?? "#" + symbol) : symbol);
  const owned = new Uint8Array(table.length - t0);
  const out: { key: string; site: string; shape: string; bytes: number }[] = [];
  const size = (index: number): number => {
    const json = JSON.stringify(wire[index - t0]);
    return json === undefined ? 1 : json.length + 1;
  };
  // Bytes of the new entries `ref` reaches first; recipe entries (other than `ref`'s own) end the walk, their captures queued.
  const walk = (ref: number, nested: [symbol: string, refs: number[], kind: string][]): number => {
    let bytes = 0;
    const stack = [ref];
    while (stack.length) {
      const index = stack.pop()!;
      if (index < t0 || index >= table.length || owned[index - t0]) continue;
      owned[index - t0] = 1;
      bytes += size(index);
      const entry = table[index];
      if (entry === null || typeof entry !== "object") continue;
      if (Array.isArray(entry)) {
        for (let i = 0; i < entry.length; i++) stack.push(entry[i]!);
        continue;
      }
      const recipe = typeof entry.f === "string" || typeof entry.c === "string" ? ((entry.f ?? entry.c) as string) : null;
      if (recipe !== null && entry.a) {
        nested.push([recipe, entry.a, entry.c !== undefined ? "computed" : "function"]);
        if (typeof entry.q === "number") stack.push(entry.q);
        continue;
      }
      if (entry.o) for (let i = 1; i < entry.o.length; i += 2) stack.push(entry.o[i] as number);
      else if (entry.p) for (let i = 1; i < entry.p.length; i += 2) if (Array.isArray(entry.p[i])) stack.push((entry.p[i] as [number])[0]);
      if (entry.m) for (let i = 0; i < entry.m.length; i++) stack.push(entry.m[i]!);
      if (entry.e) for (let i = 0; i < entry.e.length; i++) stack.push(entry.e[i]!);
      if (entry.a) for (let i = 0; i < entry.a.length; i++) stack.push(entry.a[i]!);
      if (entry.i) stack.push(entry.i[0]);
      if (typeof entry.s === "number") stack.push(entry.s);
      if (typeof entry.q === "number") stack.push(entry.q);
      if (entry.E && typeof entry.E[2] === "number") stack.push(entry.E[2]);
    }
    return bytes;
  };
  // `src/a.tsx#Card$onClick` → `<Card> `; a site without a symbol (a model binding) → "".
  const component = (symbol: string): string => {
    const at = symbol.indexOf("#");
    if (at < 0) return "";
    const local = symbol.slice(at + 1),
      end = local.indexOf("$");
    return "<" + (end > 0 ? local.slice(0, end) : local) + "> ";
  };
  // One site: its captures `refs` (negative: row item / index / packed slot, not table entries).
  const site = (symbolRef: SymbolRef, kind: string, refs: readonly number[], what = "captures"): void => {
    const symbol = symbolId(symbolRef);
    const nested: [string, number[], string][] = [];
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]!;
      if (ref < t0 || ref >= table.length || owned[ref - t0]) continue;
      const bytes = walk(ref, nested);
      if (bytes === 0) continue;
      const name = what === "captures" ? names?.[symbol]?.[i] : undefined;
      out.push({
        // Captures by position; row items / signals / values of one site as one (summed in the page summary).
        key: symbol + "\n" + kind + "\n" + (what === "captures" ? i : what),
        site:
          component(symbol) +
          kind +
          " " +
          what +
          (what === "captures" ? " " + (name ? "`" + name + "`" : "#" + i) : "") +
          (symbol.includes("#") ? " (" + symbol + ")" : ""),
        shape: shape(table, ref, 0),
        bytes,
      });
    }
    for (const [recipe, captures, recipeKind] of nested) site(recipe, recipeKind, captures);
  };
  const handlerKind = (type: string): string => {
    const capture = type.endsWith("!"),
      name = capture ? type.slice(0, -1) : type;
    return "on" + name.charAt(0).toUpperCase() + name.slice(1) + (capture ? "Capture" : "") + " handler";
  };
  const handlers = (map: Record<string, Record<string, HandlerEntry>>): void => {
    for (const id in map) for (const type in map[id]) site(map[id]![type]![0], handlerKind(type), map[id]![type]![1]);
  };
  const bindingKind = (name: BindingName): string =>
    name === null
      ? "text binding"
      : typeof name === "number" || name.charCodeAt(0) === 46
        ? "spread binding"
        : name === "#"
          ? "region"
          : 'binding of attribute "' + name + '"';
  const templated = (bindings: readonly TemplateBinding[]): void => {
    for (const [, name, symbol, refs, signals] of bindings) {
      site(symbol, bindingKind(name), refs);
      site(symbol, bindingKind(name), signals, "reads a signal");
    }
  };
  handlers(e);
  for (const id in m) site("", "model:" + m[id]![0] + " binding", [m[id]![1]], "holds");
  for (const entry of b) {
    const [, name, , refs, signals] = entry;
    if (name === "+") {
      const packed = entry[8] as PackedBindings;
      templated(packed.b);
      // Per-row slot values: the binding whose template ref reads the slot.
      for (let slot = 0; slot < packed.n; slot++) {
        const owner = packed.b.find((item) => item[3].includes(-1 - slot));
        if (!owner) continue;
        // At the capture's own position (its name), the other positions skipped (-1).
        const refs: number[] = new Array(owner[3].indexOf(-1 - slot) + 1).fill(-1);
        for (let k = 0; k < packed.k; k++) {
          refs[refs.length - 1] = packed.r[k * packed.n + slot]!;
          site(owner[2], bindingKind(owner[1]), refs);
        }
      }
      continue;
    }
    if (name !== "*") {
      site(entry[2], bindingKind(name), refs);
      site(entry[2], bindingKind(name), signals, "reads a signal");
    }
    const rows = entry[8];
    if (name === "#" || name === "*") {
      const tpl = entry[9];
      // A list that is no region (`*`) has no symbol: name it by its row template's.
      const rowSymbol = name === "*" && tpl ? (tpl.b[0]?.[2] ?? Object.values(Object.values(tpl.e)[0] ?? {})[0]?.[0]) : undefined;
      const symbol = rowSymbol ?? entry[2];
      if (tpl) {
        handlers(tpl.e);
        templated(tpl.b);
      }
      // [8]: rows (flat triples / compact) or, without rows, the branches; branches after rows at [10].
      const isBranches = (value: unknown): boolean =>
        Array.isArray(value) ? typeof value[0] === "object" : !!value && typeof value === "object" && (value as BranchSpec).w !== undefined;
      if (Array.isArray(rows) && !isBranches(rows)) {
        const items: number[] = [];
        for (let i = 1; i < rows.length; i += 3) items.push((rows as number[])[i]!);
        site(symbol, "For", items, "row items");
      } else if (rows && !isBranches(rows) && typeof rows === "object") {
        const spec = rows as CompactRows;
        if (spec.a !== undefined || spec.r !== undefined) site(symbol, "For", spec.a !== undefined ? [spec.a] : spec.r!, "row items");
      }
      const branches = (isBranches(rows) ? rows : entry[10]) as BranchSpec | BranchSpec[] | 0 | undefined;
      if (branches)
        for (const spec of Array.isArray(branches) ? branches : [branches]) if (spec.v !== undefined) site(symbol, "Show branch", [spec.v], "value");
      const locals = entry[11] as RegionLocals | 0 | undefined;
      if (locals)
        site(
          symbol,
          "region state (_regionState)",
          locals.l.filter((ref): ref is number => ref !== null),
          "holds",
        );
      const providers = entry[12] as (string | number)[] | number | null | undefined;
      if (typeof providers === "number") site(symbol, "region", [providers], "provider values");
      else if (Array.isArray(providers))
        for (let k = 0; k < providers.length; k += 2) {
          const token = table[providers[k] as number];
          site(symbol, 'provider of context "' + (typeof token === "string" ? token : providers[k]) + '"', [providers[k + 1] as number], "value");
        }
      const reads = entry[13] as number[] | undefined;
      if (Array.isArray(reads)) site(symbol, "For", reads, "row reads");
    }
  }
  for (const [symbol, refs] of fx) site(symbol, "clientEffect", refs);
  for (const [symbol, refs, , type] of ce) site(symbol, 'clientEvent "' + type + '"', refs);
  return out;
}
/** What a table entry holds, short: `array of 1,000 objects`, `object with 48 keys`, `string of 32.0 KB`. */
function shape(table: readonly TableEntry[], ref: number, depth: number): string {
  const entry = table[ref];
  const count = (n: number, one: string, many = one + "s"): string => n.toLocaleString("en-US") + " " + (n === 1 ? one : many);
  const item = (value: unknown, n: number): string => {
    if (Array.isArray(value)) return count(n, "array");
    if (value !== null && typeof value === "object") return count(n, "object");
    if (typeof value === "string") return count(n, "string");
    if (typeof value === "number") return count(n, "number");
    if (typeof value === "boolean") return count(n, "boolean");
    return count(n, "value");
  };
  const entryItem = (index: number, n: number): string => {
    const first = table[index];
    if (first === null || typeof first !== "object" || Array.isArray(first)) return item(first, n);
    if (first.j !== undefined) return item(first.j, n);
    if (first.l) return count(n, "array");
    if (first.o || first.p || first.cls !== undefined) return count(n, "object");
    if (first.s !== undefined) return count(n, "signal");
    return count(n, "value");
  };
  if (typeof entry === "string") return "string of " + kb(JSON.stringify(entry).length);
  if (entry === null || typeof entry !== "object") return typeof entry;
  if (Array.isArray(entry)) return "array of " + (entry.length ? entryItem(entry[0]!, entry.length) : "0 values");
  if (entry.j !== undefined) {
    const value = entry.j;
    return Array.isArray(value) ? "array of " + item(value[0], value.length) : "object with " + count(Object.keys(value).length, "key");
  }
  if (entry.l) return "array of " + item(entry.l[0], entry.l.length);
  if (entry.o) return "object with " + count(entry.o.length / 2, "key");
  if (entry.p) return "object with " + count(entry.p.length / 2, "key");
  if (entry.m) return "Map of " + count(entry.m.length / 2, "entry", "entries");
  if (entry.e) return "Set of " + count(entry.e.length, "value");
  if (typeof entry.s === "number") return depth < 2 ? "signal holding " + shape(table, entry.s, depth + 1) : "signal";
  if (entry.b) return "binary data (" + entry.b[0] + ")";
  if (entry.cls !== undefined) return "class instance";
  if (entry.f !== undefined) return "function";
  if (entry.c !== undefined) return "computed";
  if (entry.i) return "value inside " + (depth < 2 ? shape(table, entry.i[0], depth + 1) : "another value");
  if (entry.k === "cell" && entry.a && depth < 2) return "let variable holding " + shape(table, entry.a[0]!, depth + 1);
  if (typeof entry.k === "string") return entry.k + " value";
  return "value";
}
