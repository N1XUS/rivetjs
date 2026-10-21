// DOM-backed loader data, server half (DOM-DATA, spec docs/design/specs/2026-10-20-dom-backed-loader-data-design.md):
// the render's registry of the list rows whose template writes values as an element's whole text / a plain attribute
// value (`domRows` for keyed plan rows, `domTemplateRow` for lazy rows rendered one by one, `domLazyTape` for lazy rows of a
// row plan), the encoder's `D` form of plain JSON trees holding
// them (`domTree`, called by `resume-format.ts` `createEncoder({ dom })`) and the `Dr` run compaction of the state table
// (`domRuns`). Only builds with `rivet({ resume: { domData: true } })` reach this module: the compiler plugin serves
// `dom-data-server.ts` with `_domRegistry` from here (default: null, so other servers carry none of it).
// T2 (registry by reference): a row registers where its values already are (the plan's tape / the lazy template's slots,
// an offset, the template's slots) — no value is copied; the encoder reads them back by slot. Row item trees of the
// previous tree's skeleton are checked against it in one walk (no skeleton per row).
import { ATTRIBUTE, booleanAttributes, COMPILED, _attributeName } from "./template.ts";
import type { AttributeNamespace } from "./template.ts";
import { rowContent, rowTexts } from "./server-resume-paths.ts";
import { URLS } from "./url.ts";
import type { BindingEntry, CompactRows, DomLast, DomTexts, DomTree, EntryRecord, Literal, TableEntry } from "./resume-format.ts";

/** The registry of one render (server-resume `Recorder.dom`). `items` maps a registered row's item to h: `info[h]` its
 * anchor, `info[h + 1]` the offset of its slots in its block's source, `info[h + 2]` its block; per block, `sources` the
 * array holding its rows' slot values (by reference: a plan's tape, a lazy row's template slots) and `slots` its
 * template's DOM-DATA slots. */
export interface DomRegistry extends DomTexts {
  info: number[];
  sources: (readonly unknown[])[];
  slots: DomSlot[][];
  /** Lazy rows: per template (its slots), its block (the rows' values side by side). */
  lazyBlocks: Map<DomSlot[], number>;
  /** One row: anchor, its slot values (`source[base + slot]`), its template's slots, its item. */
  row(anchor: number, source: readonly unknown[], base: number, slots: DomSlot[], item: unknown): void;
  /** Tape rows of a keyed row plan: row k's root is element id `rows[k].id + 1`. */
  rows(plan: DomPlan, tape: readonly unknown[], rows: readonly DomRow[], count: number, width: number): void;
  /** A lazy row's compiled template value, row region `marker`. */
  lazyRow(value: unknown, marker: number, item: unknown): void;
  /** A recorded row's compiled template value (anchor: its root element's `data-r` id); `item` its data object. */
  recordedRow(value: unknown, item: unknown): void;
  /** Lazy rows 0 … count − 1 of a row plan on one list tape (`lazyPlanRows`): row k = `tape[k * stride]` (its row region
   * marker id) + its slots, `items[k]` its data object. */
  lazyTape(plan: DomPlan, tape: readonly unknown[], items: readonly unknown[], count: number, stride: number): void;
  /** Wire form: runs of single `D` trees → `Dr` entries (in place, `t`; `table`: the encoder's, for the shapes). */
  runs(t: TableEntry[], table: readonly TableEntry[]): void;
  /** Wire form (DOM-DATA builds): compact rows' item refs `r` → runs `rs` when shorter (in place, the binding entries `b`). */
  strided(b: readonly BindingEntry[]): void;
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
/**
 * A DOM-DATA slot of a row template: its slot index, its path, the path for a number (`#…`). `attr` 1 (lazy templates'
 * attribute slots, where the slot holds the attribute record): `name` = the attribute the paths were made for (set by
 * the first row read; "" before), `ok` = it is a plain attribute (rows writing another name, or a name that is not, hold
 * nothing there).
 */
export type DomSlot = [slot: number, path: string, number: string, attr: 0 | 1, name: string, ok: boolean];
type Attribute = { [ATTRIBUTE]?: true; name: string; value: unknown; namespace: AttributeNamespace };
const own = (out: Record<string, unknown>, key: string, value: unknown): unknown =>
  key === "__proto__" ? Object.defineProperty(out, key, { value, writable: true, enumerable: true, configurable: true }) : (out[key] = value);

/** A render's registry. */
export function _domRegistry(): DomRegistry {
  const dom: DomRegistry = {
    items: new Map(),
    info: [],
    sources: [],
    slots: [],
    lazyBlocks: new Map(),
    row: (anchor, source, base, slots, item) => {
      if (item !== null && typeof item === "object" && !dom.items.has(item))
        (dom.items.set(item, dom.info.push(anchor, base, dom.sources.push(source) - 1) - 3), dom.slots.push(slots));
    },
    rows: (plan, tape, rows, count, width) => domRows(dom, plan, tape, rows, count, width),
    lazyRow: (value, marker, item) => domTemplateRow(dom, value, -1 - marker, item),
    recordedRow: (value, item) => domTemplateRow(dom, value, null, item),
    lazyTape: (plan, tape, items, count, stride) => domLazyTape(dom, plan, tape, items, count, stride),
    tree: (value, shapeRef, last) => domTree(dom, value, shapeRef, last as DomMemo),
    runs: domRuns,
    strided: domStrided,
  };
  return dom;
}

// ---- registration (by reference) ----
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
    if (!path.endsWith("@")) out.push([slot, path, "#" + path, 0, "", true]);
    else if (!sites.includes(slot)) {
      const [name, namespace] = entries[slot] as [string, AttributeNamespace];
      const output = namespace === "html" ? _attributeName(name, namespace) : "";
      if (output && domAttribute(output)) out.push([slot, path + output, "#" + path + output, 0, "", true]);
    }
  }
  return out.length ? out : null;
}
/** Tape rows of a row plan (`planRows`): row k's root is element id `rows[k].id + 1` (structural ids, root-anchored plan),
 * its values `tape[k * width + slot]`: one block for the plan's rows, three numbers per row. */
function domRows(dom: DomRegistry, plan: DomPlan, tape: readonly unknown[], rows: readonly DomRow[], count: number, width: number): void {
  const texts = plan.texts === undefined ? (plan.texts = planTexts(plan)) : plan.texts;
  if (texts === null) return;
  const { info, items } = dom,
    block = dom.sources.push(tape) - 1;
  dom.slots.push(texts);
  for (let k = 0; k < count; k++) {
    const item = rows[k]!.item;
    if (item !== null && typeof item === "object" && !items.has(item)) items.set(item, info.push(rows[k]!.id + 1, k * width, block) - 3);
  }
}
// LAZY-COST-2: a row plan's DOM-DATA slots on a lazy tape (`planTexts`, one slot later: the row's marker id comes first).
const tapeTexts = new WeakMap<DomPlan, DomSlot[] | null>();
/** Lazy rows of a row plan written from one list tape (`lazyPlanRows`): row k's anchor is its row region (`-1 - marker`,
 * marker = `tape[k * stride]`, as `lazyRow` anchors a row rendered by itself), its values `tape[k * stride + 1 + slot]`: one
 * block for the tape, three numbers per row. Slots as for recorded plan rows (`planTexts`: no `_rAttr` site's attribute). */
function domLazyTape(dom: DomRegistry, plan: DomPlan, tape: readonly unknown[], items: readonly unknown[], count: number, stride: number): void {
  let texts = tapeTexts.get(plan);
  if (texts === undefined) {
    const own = plan.texts === undefined ? (plan.texts = planTexts(plan)) : plan.texts;
    tapeTexts.set(plan, (texts = own && own.map(([slot, path, number, attr, name, ok]): DomSlot => [slot + 1, path, number, attr, name, ok])));
  }
  if (texts === null) return;
  const { info, items: registered } = dom,
    block = dom.sources.push(tape) - 1;
  dom.slots.push(texts);
  for (let k = 0; k < count; k++) {
    const item = items[k];
    if (item !== null && typeof item === "object" && !registered.has(item))
      registered.set(item, info.push(-1 - (tape[k * stride] as number), k * stride, block) - 3);
  }
}
// Compiled templates of row regions: their DOM-DATA slots (`rowTexts`, slots in a start tag = attributes), per fragments,
// the same slots over the template's block (`[i, …]`: its rows' values sit side by side, n per row) and its content slots.
const templateTexts = new WeakMap<readonly string[], [texts: DomSlot[], block: DomSlot[], content: number[], root: number[]] | null>();
/** A row's own template — a lazy row's `render(get, at)` value (anchor `-1 - marker`: its row region), or (SMALL-FIXES
 * 2026-10-21) a recorded row's value (`anchor` null: the `data-r` id its root element's start tag holds; none → not
 * registered), whose item may be the data object a cdk collection row named (`server-resume` `rowItem`): its values,
 * addressed from the row root, when every content slot holds a primitive (a nested template could add elements before a
 * path; start-tag slots — attribute records, a spread's attribute list — add none). The row's slots array dies with its
 * HTML: the values (references) go to one array per template (`lazyBlocks`). */
function domTemplateRow(dom: DomRegistry, value: unknown, anchor: number | null, item: unknown): void {
  if (item === null || typeof item !== "object" || dom.items.has(item)) return;
  if (value === null || typeof value !== "object" || !(value as { [COMPILED]?: true })[COMPILED]) return;
  const { fragments, slots } = value as { fragments: readonly string[]; slots: readonly unknown[] };
  let texts = templateTexts.get(fragments);
  if (texts === undefined) {
    const all = rowTexts(fragments, null),
      content = all && rowContent(fragments);
    templateTexts.set(
      fragments,
      (texts = all &&
        content && [
          all.map(([slot, path]): DomSlot => [slot, path, "#" + path, path.endsWith("@") ? 1 : 0, "", true]),
          all.map(([, path], i): DomSlot => [i, path, "#" + path, 0, "", true]),
          content,
          all.filter(([, path]) => /^[^:.]*:@$/.test(path)).map(([slot]) => slot),
        ]),
    );
  }
  if (texts === null) return;
  const [mine, shared, content, root] = texts;
  for (let i = 0; i < content.length; i++) {
    const slot = slots[content[i]!];
    if ((slot !== null && typeof slot === "object") || typeof slot === "function") return;
  }
  // A recorded row: its root element's id (`_rId`'s `data-r` record in the root start tag).
  for (let i = 0; anchor === null && i < root.length; i++) {
    const record = slots[root[i]!] as Attribute | null;
    if (record !== null && typeof record === "object" && record[ATTRIBUTE] && record.name === "data-r" && typeof record.value === "number")
      anchor = record.value;
  }
  if (anchor === null) return;
  let block = dom.lazyBlocks.get(mine);
  if (block === undefined) (dom.lazyBlocks.set(mine, (block = dom.sources.push([]) - 1)), dom.slots.push(shared));
  const values = dom.sources[block] as unknown[],
    base = values.length;
  for (let i = 0; i < mine.length; i++) {
    const text = mine[i]!;
    let v = slots[text[0]];
    if (text[3] === 1) {
      // An attribute record: the paths name the first name a row wrote (rows writing another hold nothing there).
      const record = v as Attribute | null;
      v = undefined;
      if (record !== null && typeof record === "object" && record[ATTRIBUTE] && record.namespace === "html") {
        if (text[4] === "") {
          text[4] = record.name;
          if ((text[5] = shared[i]![5] = domAttribute(record.name))) ((shared[i]![1] += record.name), (shared[i]![2] += record.name));
        }
        if (text[5] && text[4] === record.name) v = record.value;
      }
    }
    values.push(v);
  }
  dom.items.set(item, dom.info.push(anchor, base, block) - 3);
}
/** The value row h holds at DOM-DATA slot i of its template when it is worth a DOM reference (a string of ≥ 8 chars, a
 * finite number: `String(value)`, read back with `Number`; -0 never reaches a JSON tree), else undefined. */
function domAt(dom: DomRegistry, h: number, i: number): unknown {
  const block = dom.info[h + 2]!,
    value = dom.sources[block]![dom.info[h + 1]! + dom.slots[block]![i]![0]];
  return typeof value === "string" ? (value.length >= 8 ? value : undefined) : typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

// ---- encoding: `j` trees whose values sit in the page's DOM (`DomTree`) ----
// A registered string the browser's parser keeps as written: no CR (newline normalisation), no NUL, no lone surrogate
// (the class test first: one scan for the common string).
const UNFIT = /[\r\0\ud800-\udfff]/;
const domFits = (value: unknown): boolean =>
  typeof value === "number" ||
  !UNFIT.test(value as string) ||
  ((value as string).indexOf("\r") < 0 && (value as string).indexOf("\0") < 0 && (value as unknown as { isWellFormed(): boolean }).isWellFormed());
const leaf = (v: unknown): boolean => v === null || typeof v !== "object";
// Whether `value` could be a DOM leaf (`domAt`'s rule).
const worth = (value: unknown): boolean => (typeof value === "string" ? value.length >= 8 : typeof value === "number" && Number.isFinite(value));
/**
 * Skeletons (internal form): leaf 0 = a literal, code c ≥ 2 = the value of DOM-DATA slot `(c - 2) >> 1` of the row's
 * template (c odd: a number, its `#` path); arrays as arrays, objects as `DomObject` (keys in order), rows nodes as
 * `DomRows`. The wire skeleton (`domWire`) replaces codes by path indexes.
 */
class DomObject {
  keys: string[];
  values: unknown[];
  constructor(keys: string[], values: unknown[]) {
    this.keys = keys;
    this.values = values;
  }
}
/** A rows node: an array of ≥ 2 registered row items of one template, evenly spaced anchors, one skeleton; its stream
 * (exceptions as row, code, value; the rows' literals in turn) and what it saves. */
class DomRows {
  skeleton: unknown;
  texts: DomSlot[];
  first: number;
  stride: number;
  count: number;
  exceptions: (number | Literal)[];
  lits: (number | Literal)[];
  constructor(skeleton: unknown, texts: DomSlot[], first: number, stride: number, count: number, exceptions: (number | Literal)[], lits: (number | Literal)[]) {
    this.skeleton = skeleton;
    this.texts = texts;
    this.first = first;
    this.stride = stride;
    this.count = count;
    this.exceptions = exceptions;
    this.lits = lits;
  }
}
/** A scan: what the DOM leaves save (chars), the slot after the last match (leaves come in template order mostly). */
interface DomScan {
  saved: number;
  hint: number;
}
// The code of leaf `value` in row h (0: none, or the parser would change it).
function domLeaf(dom: DomRegistry, value: unknown, h: number, scan: DomScan): number {
  if (!worth(value)) return 0;
  const n = dom.slots[dom.info[h + 2]!]!.length;
  for (let i = scan.hint < n && domAt(dom, h, scan.hint) === value ? scan.hint : 0; i < n; i++)
    if (domAt(dom, h, i) === value) {
      scan.hint = i + 1;
      if (!domFits(value)) return 0;
      scan.saved += typeof value === "string" ? value.length : 2;
      return 2 + 2 * i + (typeof value === "number" ? 1 : 0);
    }
  return 0;
}
// The skeleton of `value` for row h (-1: none, every leaf a literal); arrays in `rows` are rows nodes.
function domSkeleton(dom: DomRegistry, value: unknown, h: number, scan: DomScan, rows: Map<unknown, DomRows> | null): unknown {
  if (leaf(value)) return h >= 0 ? domLeaf(dom, value, h, scan) : 0;
  const node = rows?.get(value);
  if (node !== undefined) return node;
  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) out[i] = domSkeleton(dom, value[i], h, scan, rows);
    return out;
  }
  const keys = Object.keys(value as object),
    values: unknown[] = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) values[i] = domSkeleton(dom, (value as Record<string, unknown>)[keys[i]!], h, scan, rows);
  return new DomObject(keys, values);
}
/** A walk of `value` along a skeleton for one row (`domRow`: its source, offset, template slots): literals in order,
 * exceptions (null: a DOM leaf the row does not hold fails the walk), what the DOM leaves save, `miss`: literals the row
 * does hold (the skeleton came from another row). */
interface DomWalk {
  lits: (number | Literal)[];
  exceptions: (number | Literal)[] | null;
  row: number;
  saved: number;
  miss: number;
  source: readonly unknown[];
  base: number;
  texts: DomSlot[];
}
const domWalk = (lits: (number | Literal)[], exceptions: (number | Literal)[] | null): DomWalk => ({
  lits,
  exceptions,
  row: 0,
  saved: 0,
  miss: 0,
  source: lits,
  base: 0,
  texts: [],
});
// Walk row h next.
function domRow(dom: DomRegistry, walk: DomWalk, h: number): void {
  const block = dom.info[h + 2]!;
  walk.source = dom.sources[block]!;
  walk.base = dom.info[h + 1]!;
  walk.texts = dom.slots[block]!;
}
// A leaf of code `code` (0: a literal) holding `value` (a JSON literal).
function domLeafCheck(code: number, value: unknown, walk: DomWalk): boolean {
  if (code === 0) {
    walk.lits.push(value as Literal);
    if (walk.exceptions !== null && worth(value))
      for (let i = 0; i < walk.texts.length; i++) if (walk.source[walk.base + walk.texts[i]![0]] === value && domFits(value)) return (walk.miss++, true);
    return true;
  }
  if (
    walk.source[walk.base + walk.texts[(code - 2) >> 1]![0]] === value &&
    (typeof value === "number") === ((code & 1) === 1) &&
    worth(value) &&
    domFits(value)
  ) {
    walk.saved += typeof value === "string" ? value.length : 2;
    return true;
  }
  return walk.exceptions !== null && (walk.exceptions.push(walk.row, code, value as Literal), true);
}
// Whether `value` has the structure of `skeleton` (keys in order, lengths, leaves where it has leaves); streams `walk`.
function domCheck(skeleton: unknown, value: unknown, walk: DomWalk): boolean {
  if (typeof skeleton === "number") return leaf(value) && domLeafCheck(skeleton, value, walk);
  if (Array.isArray(skeleton)) {
    if (!Array.isArray(value) || value.length !== skeleton.length) return false;
    for (let i = 0; i < skeleton.length; i++) {
      const s = skeleton[i],
        v = value[i];
      if (typeof s === "number" ? !leaf(v) || !domLeafCheck(s, v, walk) : !domCheck(s, v, walk)) return false;
    }
    return true;
  }
  if (leaf(value) || Array.isArray(value)) return false;
  const { keys, values } = skeleton as DomObject,
    names = Object.keys(value as object);
  if (names.length !== keys.length) return false;
  for (let i = 0; i < keys.length; i++) {
    const s = values[i],
      v = (value as Record<string, unknown>)[keys[i]!];
    if (names[i] !== keys[i] || (typeof s === "number" ? !leaf(v) || !domLeafCheck(s, v, walk) : !domCheck(s, v, walk))) return false;
  }
  return true;
}
// One structure for every row (keys in order, lengths): a code where the rows that have one agree on it, else 0;
// undefined: the structures differ.
function domMerge(a: unknown, b: unknown): unknown {
  if (typeof a === "number" || typeof b === "number")
    return typeof a === "number" && typeof b === "number" ? (a === b || b === 0 ? a : a === 0 ? b : 0) : undefined;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return undefined;
    const out: unknown[] = new Array(a.length);
    for (let i = 0; i < a.length; i++) if ((out[i] = domMerge(a[i], b[i])) === undefined) return undefined;
    return out;
  }
  if (Array.isArray(b)) return undefined;
  const x = a as DomObject,
    y = b as DomObject;
  if (x.keys.length !== y.keys.length) return undefined;
  const values: unknown[] = new Array(x.keys.length);
  for (let i = 0; i < x.keys.length; i++) if (x.keys[i] !== y.keys[i] || (values[i] = domMerge(x.values[i], y.values[i])) === undefined) return undefined;
  return new DomObject(x.keys, values);
}
// A rows node over `list`, or null: every element a registered row of one template, anchors evenly spaced (one sign).
// The skeleton is row 0's; every row is walked along it. When some row holds a value where row 0 has a literal (an odd
// first row), the skeleton is the merge of every row's own (rows without a DOM leaf become exceptions).
function domRowsNode(dom: DomRegistry, list: readonly unknown[], scan: DomScan): DomRows | null {
  const { items, info } = dom,
    count = list.length,
    hs: number[] = new Array(count);
  let first = 0,
    stride = 0,
    texts: DomSlot[] | undefined;
  for (let k = 0; k < count; k++) {
    const h = leaf(list[k]) ? undefined : items.get(list[k] as object);
    if (h === undefined) return null;
    const anchor = info[h]!,
      mine = dom.slots[info[h + 2]!]!;
    if (k === 0) ((first = anchor), (texts = mine));
    else if ((k === 1 ? (stride = anchor - first) === 0 : anchor !== first + k * stride) || first < 0 !== anchor < 0 || mine !== texts) return null;
    hs[k] = h;
  }
  let skeleton = domSkeleton(dom, list[0], hs[0]!, { saved: 0, hint: 0 }, null);
  for (let pass = 0; pass < 2; pass++) {
    const walk = domWalk([], []);
    for (; walk.row < count; walk.row++) if ((domRow(dom, walk, hs[walk.row]!), !domCheck(skeleton, list[walk.row], walk))) return null;
    if (walk.miss === 0 || pass === 1) {
      if (walk.saved === 0) return null;
      scan.saved += walk.saved;
      return new DomRows(skeleton, texts!, first, stride, count, walk.exceptions!, walk.lits);
    }
    for (let k = 1; k < count && skeleton !== undefined; k++) skeleton = domMerge(skeleton, domSkeleton(dom, list[k], hs[k]!, { saved: 0, hint: 0 }, null));
    if (skeleton === undefined) return null;
  }
  return null;
}
// Arrays of the tree that are rows nodes (outermost first; rows inside a row are plain row content), with what they save.
function treeRows(dom: DomRegistry, value: unknown, rows: Map<unknown, DomRows>, scan: DomScan): void {
  if (leaf(value)) return;
  if (Array.isArray(value)) {
    if (value.length > 1 && !leaf(value[0])) {
      const node = domRowsNode(dom, value, scan);
      if (node !== null) return void rows.set(value, node);
    }
    for (let i = 0; i < value.length; i++) treeRows(dom, value[i], rows, scan);
  } else for (const key of Object.keys(value as object)) treeRows(dom, (value as Record<string, unknown>)[key], rows, scan);
}
/** A wire build: paths (deduplicated, `keys`), rows node skeletons (`subs`, deduplicated by JSON), the stream. */
interface DomOut {
  paths: string[];
  keys: Map<string, number>;
  subs: unknown[];
  subKeys: string[];
  lits: (number | Literal)[];
}
// The path index (≥ 1) of code `code` of a row of template `texts`.
function domPath(out: DomOut, texts: DomSlot[], code: number): number {
  const slot = texts[(code - 2) >> 1]!,
    path = code & 1 ? slot[2] : slot[1];
  let k = out.keys.get(path);
  if (k === undefined) out.keys.set(path, (k = out.paths.push(path)));
  return k;
}
// The wire skeleton of `skeleton` (codes → path indexes, rows nodes → -1 - sub index) and, with `value`, its literals
// (depth-first; a rows node: first anchor, stride, count, n, n × (row, path index, value), then its rows' literals).
function domWire(skeleton: unknown, value: unknown, texts: DomSlot[] | null, out: DomOut, stream: boolean): unknown {
  if (typeof skeleton === "number") {
    if (skeleton !== 0) return domPath(out, texts!, skeleton);
    if (stream) out.lits.push(value as Literal);
    return 0;
  }
  if (skeleton instanceof DomRows) {
    const sub = domWire(skeleton.skeleton, undefined, skeleton.texts, out, false),
      { exceptions, lits } = skeleton;
    out.lits.push(skeleton.first, skeleton.stride, skeleton.count, exceptions.length / 3);
    for (let i = 0; i < exceptions.length; i += 3) out.lits.push(exceptions[i]!, domPath(out, skeleton.texts, exceptions[i + 1] as number), exceptions[i + 2]!);
    for (let i = 0; i < lits.length; i++) out.lits.push(lits[i]!);
    const key = JSON.stringify(sub);
    let k = out.subKeys.indexOf(key);
    if (k < 0) ((k = out.subKeys.push(key) - 1), out.subs.push(sub));
    return -1 - k;
  }
  if (Array.isArray(skeleton)) {
    const list: unknown[] = new Array(skeleton.length);
    for (let i = 0; i < skeleton.length; i++) list[i] = domWire(skeleton[i], stream ? (value as unknown[])[i] : undefined, texts, out, stream);
    return list;
  }
  const { keys, values } = skeleton as DomObject,
    object: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++)
    own(object, keys[i]!, domWire(values[i], stream ? (value as Record<string, unknown>)[keys[i]!] : undefined, texts, out, stream));
  return object;
}
// A DOM-backed tree saving less than this (characters of its DOM values) stays a `j` tree.
const DOM_MIN = 32;
/** The encoder's memo (`DomLast`): the previous single row tree's skeleton (internal form), its template, its shape. */
interface DomMemo extends DomLast {
  texts?: DomSlot[];
}
/** The `D` form `[shape, anchor | null, ...stream]` of a plain JSON tree whose values the render registered (`DomTexts`),
 * or undefined. `shapeRef(key, shape)` interns the shape entry `[skeleton, paths, subs]`; `last`: a row item tree of the
 * previous one's template is walked along its skeleton (no rows nodes) and shares its shape when it fits. */
function domTree(dom: DomRegistry, value: object, shapeRef: (key: string, shape: unknown[]) => number, last: DomMemo): DomTree | undefined {
  const h = dom.items.get(value) ?? -1,
    texts = h >= 0 ? dom.slots[dom.info[h + 2]!]! : null;
  if (texts !== null && last.ref >= 0 && last.texts === texts) {
    const tree: DomTree = [last.ref, dom.info[h]!],
      walk = domWalk(tree, null);
    domRow(dom, walk, h);
    if (domCheck(last.skeleton, value, walk)) return walk.saved >= DOM_MIN ? tree : undefined;
  }
  const scan: DomScan = { saved: 0, hint: 0 },
    rows = new Map<unknown, DomRows>();
  treeRows(dom, value, rows, scan);
  const skeleton = domSkeleton(dom, value, h, scan, rows);
  if (scan.saved < DOM_MIN) return undefined;
  const out: DomOut = { paths: [], keys: new Map(), subs: [], subKeys: [], lits: [0, h >= 0 ? dom.info[h]! : null] },
    shape = [domWire(skeleton, value, texts, out, true), out.paths, out.subs];
  const ref = (out.lits[0] = shapeRef(JSON.stringify(shape), shape));
  if (rows.size === 0 && texts !== null) ((last.skeleton = skeleton), (last.texts = texts), (last.paths = out.paths), (last.ref = ref));
  return out.lits;
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
/** Wire form (DOM-DATA builds, T3): the item refs `r` of compact rows (region / `*` entries with a row template [9]) as
 * runs `rs` = `[first, step, count, …]` when that is shorter — per-row item entries are consecutive table entries (a
 * row's `D` tree each, the shape entry after the first), so 1000 refs become two runs. The DOM-DATA expand add-on
 * (`EXPAND_DOM`, resume-expand.ts `strided`) rewrites them back to `r` before the loader / runtime read them. */
function domStrided(b: readonly BindingEntry[]): void {
  for (const entry of b) {
    const rows = entry[9] ? (entry[8] as CompactRows | undefined) : undefined,
      r = rows?.r;
    if (r === undefined || r.length < 4) continue;
    const runs: number[] = [];
    for (let i = 0; i < r.length;) {
      const step = i + 1 < r.length ? r[i + 1]! - r[i]! : 0;
      let n = 1;
      while (i + n < r.length && r[i + n]! - r[i + n - 1]! === step) n++;
      runs.push(r[i]!, n > 1 ? step : 0, n);
      i += n;
    }
    if (JSON.stringify(runs).length < JSON.stringify(r).length) ((rows!.rs = runs), delete rows!.r);
  }
}
