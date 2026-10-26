// DOM data on derived (DERIVED-C5, 2026-10-22), server half: only servers of builds with
// `rivet({ resume: { domData: true } })` reach this module — the compiler plugin serves
// `dom-data-derived.ts` with `_derivedDom` from here (default: null), so other derived servers carry none of it.
import type { DerivedDom } from "./resume-format.ts";
import { rowTexts } from "./server-resume-paths.ts";
import type { ListPlan } from "./server.ts";

// A list written from one tape whose row template shows values as an element's whole text (or a plain attribute) marks
// its first row `<!--r0<n>[-->` (the derived client's row scan accepts digits; the leading 0 keeps it apart from row
// hook ids) and is registered here. At the flush, a record's props holding such a list's items array (by identity) send
// it as a `d` entry instead: an item skeleton from row 0 (key paths → the row's DOM text paths, `rowTexts`), each row
// checked against its tape (a row whose shape or values differ ships whole), the other leaves as literals. The browser
// rebuilds the array from the rows below the anchor (`dom-derived.ts` "DOM data").
export interface DomList {
  items: readonly unknown[];
  tape: readonly unknown[];
  width: number;
  /** Tape slot (within a row) → its DOM path below the row root (`tag:i.j`, `…@name` for an attribute). */
  slots: readonly (readonly [slot: number, path: string])[];
  n: number;
  done: boolean;
}
type PlanEntry = ListPlan["attributes"][number];
const domSlotsOf = new WeakMap<ListPlan, readonly (readonly [number, string])[] | null>();
// Attributes written as given (no boolean / URL / class / style rewriting): their value is the DOM's.
const PLAIN_ATTRIBUTE = /^(?:data-[a-z0-9_.:-]+|id|title|alt|name|placeholder|aria-label|aria-description|aria-valuetext)$/;
function domSlots(plan: ListPlan): readonly (readonly [number, string])[] | null {
  let slots = domSlotsOf.get(plan);
  if (slots !== undefined) return slots;
  // A flattened child plan's bounds (`OPEN` / `CLOSE`, numbers) hold nothing: the fragments around them join.
  const fragments = [plan.fragments[0]!],
    entries: (PlanEntry | null)[] = [],
    at: number[] = [];
  for (let i = 0; i < plan.attributes.length; i++) {
    const entry = plan.attributes[i]!;
    if (typeof entry === "number") fragments[fragments.length - 1] += plan.fragments[i + 1]!;
    else (entries.push(entry), at.push(i), fragments.push(plan.fragments[i + 1]!));
  }
  const out: [number, string][] = [];
  for (const [f, path] of rowTexts(fragments, entries) ?? []) {
    const entry = entries[f] as { name: string } | null;
    if (entry === null) out.push([at[f]!, path]);
    else if (PLAIN_ATTRIBUTE.test(entry.name)) out.push([at[f]!, path + entry.name]);
  }
  domSlotsOf.set(plan, (slots = out.length ? out : null));
  return slots;
}
type TapeList = { plan: ListPlan; tape: unknown[]; rows: number; constructor: new (plan: ListPlan, tape: unknown[], rows: number) => unknown };
function domList(dom: DomList[], items: readonly unknown[], plan: ListPlan, marked: ListPlan, value: unknown): unknown {
  const list = value as TapeList,
    slots = domSlots(plan);
  if (slots === null || list === null || typeof list !== "object" || list.plan !== marked || list.rows !== items.length) return value;
  const n = dom.length,
    width = marked.attributes.length,
    first = marked.fragments.slice();
  first[0] = "<!--r0" + n + "[-->" + first[0]!.slice(9);
  dom.push({ items, tape: list.tape, width, slots, n, done: false });
  const List = list.constructor,
    rows = [
      new List({ fragments: Object.freeze(first), attributes: marked.attributes, bytes: null, fixed: 0, rows: marked.rows }, list.tape.slice(0, width), 1),
      new List(marked, list.tape.slice(width), list.rows - 1),
    ];
  return rows;
}
// The parser keeps a string as is (CR → LF, NUL, lone surrogates do not survive).
const KEPT = /[\r\0]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const shown = (v: unknown): boolean => (typeof v === "string" ? !KEPT.test(v) : typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0));
/** Row 0's skeleton: DOM leaves → 1-based index into `paths` (`leaf` collects [tape slot] per index), others 0. */
function skeleton(value: unknown, tape: readonly unknown[], slots: DomList["slots"], paths: string[], leaf: number[], depth: number): unknown {
  if (typeof value === "string" || typeof value === "number") {
    if (!shown(value)) return 0;
    for (const [slot, path] of slots)
      if (tape[slot] === value) {
        paths.push(typeof value === "number" ? "#" + path : path);
        leaf.push(slot);
        return paths.length;
      }
    return 0;
  }
  if (value === null || typeof value !== "object" || depth > 16) return 0;
  if (Array.isArray(value)) return value.map((v) => skeleton(v, tape, slots, paths, leaf, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype) return 0;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = skeleton((value as Record<string, unknown>)[key], tape, slots, paths, leaf, depth + 1);
  return out;
}
/** Row `value` against the skeleton: its literals appended to `lits`, false when its shape or a DOM value differs. */
function fits(
  skel: unknown,
  value: unknown,
  tape: readonly unknown[],
  base: number,
  leaf: readonly number[],
  paths: readonly string[],
  lits: unknown[],
): boolean {
  if (typeof skel === "number") {
    if (skel === 0) {
      if (value !== null && typeof value === "object") return false;
      return (lits.push(value), true);
    }
    // The row's own tape value, of row 0's kind (a `#` path parses a number).
    return value === tape[base + leaf[skel - 1]!] && shown(value) && (typeof value === "number") === (paths[skel - 1]!.charCodeAt(0) === 35);
  }
  if (Array.isArray(skel)) {
    if (!Array.isArray(value) || value.length !== skel.length) return false;
    for (let i = 0; i < skel.length; i++) if (!fits(skel[i], value[i], tape, base, leaf, paths, lits)) return false;
    return true;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Object.keys(skel as object),
    own = Object.keys(value);
  if (keys.length !== own.length) return false;
  for (let i = 0; i < keys.length; i++)
    if (keys[i] !== own[i] || !fits((skel as Record<string, unknown>)[keys[i]!], (value as Record<string, unknown>)[keys[i]!], tape, base, leaf, paths, lits))
      return false;
  return true;
}
function encodeDom(record: number, list: DomList, path: (string | number)[]): DerivedDom | null {
  const paths: string[] = [],
    leaf: number[] = [],
    skel = skeleton(list.items[0], list.tape, list.slots, paths, leaf, 0);
  if (!paths.length) return null;
  const lits: unknown[] = [],
    whole: Record<number, unknown> = {};
  let kept = false;
  for (let r = 0; r < list.items.length; r++) {
    const mark = lits.length;
    if (!fits(skel, list.items[r], list.tape, r * list.width, leaf, paths, lits)) ((lits.length = mark), (whole[r] = list.items[r]), (kept = true));
  }
  list.done = true;
  const entry: DerivedDom = [record, list.n, path, list.items.length, skel, paths, lits];
  if (kept) entry.push(whole);
  return entry;
}
/** `props` with the registered lists' arrays it holds replaced by 0 (their `d` entries pushed), or itself. */
function domProps(dom: DomList[], record: number, value: unknown, path: (string | number)[], d: DerivedDom[], depth: number): unknown {
  if (value === null || typeof value !== "object" || depth > 32) return value;
  if (Array.isArray(value)) {
    for (const list of dom)
      if (list.items === value && !list.done) {
        const entry = encodeDom(record, list, path.slice());
        if (entry) return (d.push(entry), 0);
      }
  }
  let copy: Record<string | number, unknown> | unknown[] | null = null;
  const keys = Array.isArray(value) ? null : Object.keys(value);
  const length = keys ? keys.length : (value as unknown[]).length;
  for (let i = 0; i < length; i++) {
    const key = keys ? keys[i]! : i,
      child = (value as Record<string | number, unknown>)[key];
    if (child === null || typeof child !== "object") continue;
    path.push(key);
    const next = domProps(dom, record, child, path, d, depth + 1);
    path.pop();
    if (next !== child) ((copy ??= Array.isArray(value) ? value.slice() : { ...(value as object) }), ((copy as Record<string | number, unknown>)[key] = next));
  }
  return copy ?? value;
}

/** What `server-derived.ts` calls (through the `dom-data-derived.ts` switch). */
export const _derivedDom = { list: domList, props: domProps };
