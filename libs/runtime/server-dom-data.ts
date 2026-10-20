// DOM-backed loader data, server half (DOM-DATA, spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md):
// the render's registry of values list rows wrote as an element's whole text / a plain attribute value (`domRows` for
// keyed plan rows, `domLazyRow` for lazy rows), the encoder's `D` form of plain JSON trees holding them (`domTree`,
// called by `resume-format.ts` `createEncoder({ dom })`) and the `Dr` run compaction of the state table (`domRuns`).
// Only builds with `rivet({ resume: { domData: true } })` reach this module: the compiler plugin serves
// `dom-data-server.ts` with `_domRegistry` from here (default: null, so other servers carry none of it).
import { ATTRIBUTE, booleanAttributes, COMPILED, _attributeName } from "./template.ts";
import type { AttributeNamespace } from "./template.ts";
import { rowTexts } from "./server-resume-paths.ts";
import { URLS } from "./url.ts";
import type { DomLast, DomTexts, DomTree, EntryRecord, Literal, TableEntry } from "./resume-format.ts";

/** The registry of one render (server-resume `Recorder.dom`): per list row whose template wrote eligible values, `regs`
 * holds `anchor, n, n × (value, path below the anchor)`; `items` maps the row's item to that header. */
export interface DomRegistry extends DomTexts {
  regs: unknown[];
  /** Tape rows of a keyed row plan: row k's root is element id `rows[k].id + 1`. */
  rows(plan: DomPlan, tape: readonly unknown[], rows: readonly DomRow[], count: number, width: number): void;
  /** A lazy row's compiled template value, row region `marker`. */
  lazyRow(value: unknown, marker: number, item: unknown): void;
  /** Wire form: runs of single `D` trees → `Dr` entries (in place, `t`; `table`: the encoder's, for the shapes). */
  runs(t: TableEntry[], table: readonly TableEntry[]): void;
}
/** What a row plan carries for DOM-DATA (server-resume `RowPlan`): its template and its eligible slots (made on first use). */
export interface DomPlan {
  source: readonly [fragments: readonly string[], entries: readonly unknown[], sites: readonly number[]];
  texts: DomSlot[] | null | undefined;
}
interface DomRow {
  id: number;
  item: unknown;
}
const own = (out: Record<string, unknown>, key: string, value: unknown): unknown =>
  key === "__proto__" ? Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true }) : (out[key] = value);

/** A render's registry. */
export function _domRegistry(): DomRegistry {
  const dom: DomRegistry = {
    items: new Map(),
    regs: [],
    rows: (plan, tape, rows, count, width) => domRows(dom, plan, tape, rows, count, width),
    lazyRow: (value, marker, item) => domLazyRow(dom, value, marker, item),
    tree: (value, shapeRef, last) => domTree(dom, value, shapeRef, last),
    runs: domRuns,
  };
  return dom;
}

// ---- registration ----
/** A slot value worth a DOM reference: a string long enough to pay for it, or a finite number (`String(value)`, read back
 * with `Number`: paths `#…`; -0 never reaches a JSON tree). Whether the parser keeps a string as written (no CR, NUL,
 * lone surrogate) is the encoder's check, on the values it uses. */
const domValue = (value: unknown): boolean => (typeof value === "string" ? value.length >= 8 : typeof value === "number" && Number.isFinite(value));
/** Open a row's registrations (`DomTexts.regs` header `anchor, n`); `domClose` keeps them (n > 0) under the row's item. */
const domOpen = (dom: DomRegistry, anchor: number): number => dom.regs.push(anchor, 0) - 2;
function domClose(dom: DomRegistry, head: number, item: unknown): void {
  const n = (dom.regs.length - head - 2) / 2;
  if (n === 0 || item === null || typeof item !== "object" || dom.items.has(item)) dom.regs.length = head;
  else ((dom.regs[head + 1] = n), dom.items.set(item, head));
}
// Attributes the server writes as `String(value)` (escaped): not boolean / enumerated (`hidden`, `popover`) and not a URL
// (the unsafe-URL rule may replace it). `name`: the output name.
const domAttribute = (name: string): boolean => !booleanAttributes.has(name) && name !== "hidden" && name !== "popover" && !URLS.has(name);
/** A plan's DOM-DATA slots (`rowTexts`): text slots, and plain html attributes that are no resume site (an `_rAttr`
 * binding may change it), their paths with the output name. */
function planTexts(plan: DomPlan): DomSlot[] | null {
  const [fragments, entries, sites] = plan.source,
    all = rowTexts(fragments, entries);
  if (all === null) return null;
  const out: DomSlot[] = [];
  for (const [slot, path] of all) {
    if (!path.endsWith("@")) out.push([slot, path, "#" + path]);
    else if (!sites.includes(slot)) {
      const [name, namespace] = entries[slot] as [string, AttributeNamespace];
      const output = namespace === "html" ? _attributeName(name, namespace) : "";
      if (output && domAttribute(output)) out.push([slot, path + output, "#" + path + output]);
    }
  }
  return out.length ? out : null;
}
/** A DOM-DATA slot: its index, its path, the path for a number (`#…`); lazy templates' attribute slots: the name the
 * paths were made for (`domLazyRow`). */
export type DomSlot = [slot: number, path: string, number: string, name?: string];
/** Tape rows of a row plan (`planRows`): row k's root is element id `rows[k].id + 1` (structural ids, root-anchored plan). */
function domRows(dom: DomRegistry, plan: DomPlan, tape: readonly unknown[], rows: readonly DomRow[], count: number, width: number): void {
  const texts = plan.texts === undefined ? (plan.texts = planTexts(plan)) : plan.texts;
  if (texts === null) return;
  const regs = dom.regs;
  for (let k = 0; k < count; k++) {
    const head = domOpen(dom, rows[k]!.id + 1),
      base = k * width;
    for (let i = 0; i < texts.length; i++) {
      const value = tape[base + texts[i]![0]];
      if (domValue(value)) regs.push(value, typeof value === "number" ? texts[i]![2] : texts[i]![1]);
    }
    domClose(dom, head, rows[k]!.item);
  }
}
/** Wire form (DOM-DATA): ≥ 3 consecutive `D` entries of one single-tree shape, equal length and evenly spaced anchors become
 * `{Dr: [shape, first anchor, stride, count, ...literals of each]}` at the first index and 0 at the others (`DomTree`);
 * the browser rewrites them back before decoding (`dom-resume-data.ts` `expand`). */
function domRuns(t: TableEntry[], table: readonly TableEntry[]): void {
  for (let i = 0; i < t.length;) {
    const head = (t[i] as EntryRecord | null)?.D;
    // Trees holding rows nodes (shape `[skeleton, paths, subs]` with subs) or without an anchor never run.
    if (head === undefined || head[1] === null || (((table[head[0] as number] as EntryRecord).j as unknown[])[2] as unknown[]).length !== 0) {
      i++;
      continue;
    }
    let n = 1,
      stride = 0;
    for (; i + n < t.length; n++) {
      const next = (t[i + n] as EntryRecord | null)?.D;
      if (next === undefined || next.length !== head.length || next[0] !== head[0]) break;
      const step = (next[1] as number) - (head[1] as number);
      if (n === 1 ? (stride = step) === 0 : step !== n * stride) break;
      if ((head[1] as number) < 0 !== (next[1] as number) < 0) break;
    }
    if (n >= 3) {
      const run: (number | Literal)[] = [head[0]!, head[1]!, stride, n];
      for (let k = 0; k < n; k++) {
        const tree = (t[i + k] as EntryRecord).D!;
        for (let j = 2; j < tree.length; j++) run.push(tree[j]!);
        t[i + k] = 0;
      }
      t[i] = { Dr: run } as EntryRecord;
    }
    i += n;
  }
}
// Compiled templates of lazy rows: their sole-child text slots (`rowTexts`, slots in a start tag = attributes), per fragments.
const templateTexts = new WeakMap<readonly string[], DomSlot[] | null>();
/** A lazy row's own template (`render(get, at)`'s value): its texts, addressed from the row root (row region `marker`:
 * anchor `-1 - marker`), when every content slot holds a primitive (a nested template could add elements before a path). */
function domLazyRow(dom: DomRegistry, value: unknown, marker: number, item: unknown): void {
  if (value === null || typeof value !== "object" || !(value as { [COMPILED]?: true })[COMPILED]) return;
  const { fragments, slots } = value as { fragments: readonly string[]; slots: readonly unknown[] };
  let texts = templateTexts.get(fragments);
  if (texts === undefined) {
    const all = rowTexts(fragments, null);
    templateTexts.set(fragments, (texts = all && all.map(([slot, path]): DomSlot => [slot, path, "#" + path])));
  }
  if (texts === null) return;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot !== null && typeof slot === "object" && !(slot as { [ATTRIBUTE]?: true })[ATTRIBUTE]) return;
    if (typeof slot === "function") return;
  }
  const head = domOpen(dom, -1 - marker),
    regs = dom.regs;
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]!,
      slot = slots[text[0]] as { [ATTRIBUTE]?: true; name: string; value: unknown; namespace: AttributeNamespace } | null;
    if (text[3] === undefined && !text[1].endsWith("@")) {
      if (domValue(slot)) regs.push(slot, typeof slot === "number" ? text[2] : text[1]);
    } else if (slot !== null && typeof slot === "object" && slot[ATTRIBUTE] && slot.namespace === "html" && domValue(slot.value)) {
      // Attribute paths name the attribute: made for the first row's name (the template's), remade when a row's differs.
      if (text[3] !== slot.name) {
        if (!domAttribute(slot.name)) continue;
        const path = (text[3] === undefined ? text[1] : text[1].slice(0, text[1].indexOf("@") + 1)) + slot.name;
        ((text[1] = path), (text[2] = "#" + path), (text[3] = slot.name));
      }
      regs.push(slot.value, typeof slot.value === "number" ? text[2] : text[1]);
    }
  }
  domClose(dom, head, item);
}

// ---- encoding: `j` trees whose values sit in the page's DOM (`DomTree`) ----
// A registered string the browser's parser keeps as written: no CR (newline normalisation), no NUL, no lone surrogate.
const domFits = (value: string | number): boolean =>
  typeof value === "number" || (value.indexOf("\r") < 0 && value.indexOf("\0") < 0 && (value as unknown as { isWellFormed(): boolean }).isWellFormed());
// The skeleton of a tree whose row registrations start at `start` (a `regs` header; -1: none): leaves 0 (a literal) or the path of
// the registration holding this very value (the DOM has it); arrays in `rows` stay as they are (rows nodes). `saved[0]`
// counts what the holes save.
function domSkeleton(dom: DomRegistry, value: unknown, start: number, saved: number[], rows: Map<unknown, DomRows> | null): unknown {
  if (value === null || typeof value !== "object") {
    if (start >= 0 && (typeof value === "string" || typeof value === "number")) {
      const regs = dom.regs,
        end = start + 2 + 2 * (regs[start + 1] as number);
      // Leaves come in template order mostly: the registration after the last match first (`saved[1]`).
      let at = saved[1]! > start && saved[1]! < end && regs[saved[1]!] === value ? saved[1]! : start + 2;
      for (; at < end; at += 2)
        if (regs[at] === value) {
          saved[1] = at + 2;
          return domFits(value) ? ((saved[0]! += typeof value === "string" ? value.length : 2), regs[at + 1] as string) : 0;
        }
    }
    return 0;
  }
  if (rows?.has(value)) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = domSkeleton(dom, value[i], start, saved, rows);
    return out;
  }
  const out: Record<string, unknown> = {},
    names = Object.keys(value);
  for (let i = 0; i < names.length; i++) own(out, names[i]!, domSkeleton(dom, (value as Record<string, unknown>)[names[i]!], start, saved, rows));
  return out;
}
const leaf = (v: unknown): boolean => v === null || typeof v !== "object";
// One structure for every row (keys in order, lengths): a path leaf where the rows that have one agree on it (a row
// without it is an exception: `domWire`), else 0 (literals); undefined: the structures differ.
function domMerge(a: unknown, b: unknown): unknown {
  if (leaf(a) || leaf(b)) return leaf(a) && leaf(b) ? (a === b || b === 0 ? a : a === 0 ? b : 0) : undefined;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return undefined;
    const out: unknown[] = new Array(a.length);
    for (let i = 0; i < a.length; i++) if ((out[i] = domMerge(a[i], b[i])) === undefined) return undefined;
    return out;
  }
  if (Array.isArray(b)) return undefined;
  const keys = Object.keys(a as object),
    other = Object.keys(b as object),
    out: Record<string, unknown> = {};
  if (keys.length !== other.length) return undefined;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== other[i]) return undefined;
    const merged = domMerge((a as Record<string, unknown>)[keys[i]!], (b as Record<string, unknown>)[keys[i]!]);
    if (merged === undefined) return undefined;
    own(out, keys[i]!, merged);
  }
  return out;
}
/** A rows node: an array of ≥ 2 trees of one structure, each under its own anchor, the anchors evenly spaced (list rows). */
interface DomRows {
  skeleton: unknown;
  skeletons: unknown[];
  first: number;
  stride: number;
}
// Arrays of the tree that are rows nodes (outermost first; rows inside a row are plain row content), with what they save.
function treeRows(dom: DomRegistry, value: unknown, rows: Map<unknown, DomRows>, saved: number[]): void {
  if (leaf(value)) return;
  if (Array.isArray(value) && value.length > 1 && !leaf(value[0])) {
    const own = [0, 0],
      skeletons: unknown[] = [];
    let merged: unknown,
      first = 0,
      stride = 0,
      k = 0;
    for (; k < value.length; k++) {
      const head = leaf(value[k]) ? undefined : dom.items.get(value[k] as object);
      if (head === undefined) break;
      const anchor = dom.regs[head] as number,
        skeleton = domSkeleton(dom, value[k], head, own, null);
      skeletons.push(skeleton);
      if (k === 0) ((merged = skeleton), (first = anchor));
      else if ((k === 1 ? (stride = anchor - first) === 0 : anchor !== first + k * stride) || first < 0 !== anchor < 0) break;
      else if (!domSame(merged, skeleton) && (merged = domMerge(merged, skeleton)) === undefined) break;
    }
    if (k === value.length && own[0]! > 0) {
      rows.set(value, { skeleton: merged, skeletons, first, stride });
      saved[0]! += own[0]!;
      return;
    }
  }
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) treeRows(dom, value[i], rows, saved);
  else for (const key of Object.keys(value as object)) treeRows(dom, (value as Record<string, unknown>)[key], rows, saved);
}
// The wire skeleton and the literal stream of `value` (depth-first): path leaves → k ≥ 1 into `paths` (`mine`: the row's
// own skeleton inside a rows node — a path leaf it does not hold in the DOM is an exception), rows nodes → -k into `subs`
// (stream: first anchor, stride, count, n, n × [row, leaf k, value], then the rows' literals).
interface DomOut {
  paths: string[];
  subs: unknown[];
  lits: (number | Literal)[];
  exceptions: (number | Literal)[] | null;
  row: number;
  rows: Map<unknown, DomRows>;
}
// `build` false: the stream only (the later rows of a rows node: the wire is the first row's).
function domWire(skeleton: unknown, mine: unknown, value: unknown, out: DomOut, build: boolean): unknown {
  if (typeof skeleton === "string") {
    if (!build && mine === skeleton) return;
    let k = out.paths.indexOf(skeleton);
    if (k < 0) k = out.paths.push(skeleton) - 1;
    if (mine !== skeleton) out.exceptions!.push(out.row, k + 1, value as Literal);
    return k + 1;
  }
  if (skeleton === 0) return (out.lits.push(value as Literal), 0);
  const rows = out.rows.get(skeleton);
  if (rows !== undefined) {
    const list = value as unknown[],
      lits = out.lits,
      outer = [out.exceptions, out.row] as const;
    out.lits = [];
    out.exceptions = [];
    let wire: unknown;
    for (out.row = 0; out.row < list.length; out.row++) {
      const row = domWire(rows.skeleton, rows.skeletons[out.row], list[out.row], out, build && out.row === 0);
      if (out.row === 0) wire = row;
    }
    lits.push(rows.first, rows.stride, list.length, out.exceptions.length / 3);
    for (let i = 0; i < out.exceptions.length; i++) lits.push(out.exceptions[i]!);
    for (let i = 0; i < out.lits.length; i++) lits.push(out.lits[i]!);
    out.lits = lits;
    [out.exceptions, out.row] = outer;
    if (!build) return;
    const key = JSON.stringify(wire);
    let k = out.subs.findIndex((sub) => JSON.stringify(sub) === key);
    if (k < 0) k = out.subs.push(wire) - 1;
    return -1 - k;
  }
  if (Array.isArray(skeleton)) {
    const list: unknown[] | undefined = build ? new Array(skeleton.length) : undefined;
    for (let i = 0; i < skeleton.length; i++) {
      const wire = domWire(skeleton[i], (mine as unknown[])[i], (value as unknown[])[i], out, build);
      if (list) list[i] = wire;
    }
    return list;
  }
  const object: Record<string, unknown> | undefined = build ? {} : undefined,
    names = Object.keys(skeleton as object);
  for (let i = 0; i < names.length; i++) {
    const key = names[i]!,
      wire = domWire((skeleton as Record<string, unknown>)[key], (mine as Record<string, unknown>)[key], (value as Record<string, unknown>)[key], out, build);
    if (object) own(object, key, wire);
  }
  return object;
}
// A DOM-backed tree saving less than this (characters of its DOM values) stays a `j` tree.
const DOM_MIN = 32;
// Whether two skeletons are the same (leaves equal, keys in order).
function domSame(a: unknown, b: unknown): boolean {
  if (leaf(a) || leaf(b)) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!domSame(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const keys = Object.keys(a as object),
    other = Object.keys(b as object);
  if (keys.length !== other.length) return false;
  for (let i = 0; i < keys.length; i++)
    if (keys[i] !== other[i] || !domSame((a as Record<string, unknown>)[keys[i]!], (b as Record<string, unknown>)[keys[i]!])) return false;
  return true;
}
/** The `D` form `[shape, anchor | null, ...stream]` of a plain JSON tree whose values the render registered (`DomTexts`),
 * or undefined. `shapeRef(key, shape)` interns the shape entry `[skeleton, paths, subs]`; `last` (a tree without rows
 * nodes) skips it for a tree of the previous one's skeleton. */
function domTree(dom: DomRegistry, value: object, shapeRef: (key: string, shape: unknown[]) => number, last: DomLast): DomTree | undefined {
  const saved = [0, 0],
    rows = new Map<unknown, DomRows>();
  treeRows(dom, value, rows, saved);
  const head = dom.items.get(value),
    anchor = head === undefined ? undefined : (dom.regs[head] as number),
    skeleton = domSkeleton(dom, value, head ?? -1, saved, rows);
  if (saved[0]! < DOM_MIN) return undefined;
  const out: DomOut = { paths: [], subs: [], lits: [], exceptions: null, row: 0, rows },
    tree: DomTree = [0, anchor ?? null];
  if (rows.size === 0 && last.ref >= 0 && domSame(skeleton, last.skeleton)) {
    out.paths = last.paths;
    out.lits = tree;
    domWire(skeleton, skeleton, value, out, false);
    tree[0] = last.ref;
    return tree;
  }
  out.lits = tree;
  const shape = [domWire(skeleton, skeleton, value, out, true), out.paths, out.subs];
  tree[0] = shapeRef(JSON.stringify(shape), shape);
  if (rows.size === 0) ((last.skeleton = skeleton), (last.paths = out.paths), (last.ref = tree[0]));
  return tree;
}
