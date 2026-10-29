// DOM data on derived (DERIVED-C5, 2026-10-22), server half: only servers of resume builds with `resume.domData` on (the
// default; `false` opts out) reach this module — the compiler plugin serves
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
  if (slots === undefined) domSlotsOf.set(plan, (slots = _domSlots(plan)));
  return slots;
}
/** @internal A list plan's DOM slots (tape slot → DOM path), null when none. The compiler plugin asks it at build time
 * (`vite.ts` `domDataLists`) so a build with no such list keeps the switch off (no reader, no server encoder). */
export function _domSlots(plan: Pick<ListPlan, "fragments" | "attributes">): [slot: number, path: string][] | null {
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
  return out.length ? out : null;
}
type TapeList = {
  plan: ListPlan;
  tape: unknown[];
  rows: number;
  start: number;
  constructor: new (plan: ListPlan, tape: unknown[], rows: number, start?: number) => unknown;
};
function domList(dom: DomList[], items: readonly unknown[], plan: ListPlan, marked: ListPlan, value: unknown): unknown {
  const list = value as TapeList,
    slots = domSlots(plan);
  if (slots === null || list === null || typeof list !== "object" || list.plan !== marked || list.start !== 0 || list.rows !== items.length) return value;
  const n = dom.length,
    width = marked.attributes.length;
  dom.push({ items, tape: list.tape, width, slots, n, done: false });
  // Both halves share the tape (row 0 / rows 1..): no copy of the rows' captures (SSR-MEM: the slice was ~10 KB per
  // 100-row page, a tenth of the resumable bench page's allocation).
  const List = list.constructor;
  return [new List(firstPlan(marked, n), list.tape, 1), new List(marked, list.tape, list.rows, 1)];
}
// Row 0's plan per (marked plan, anchor number): one object per process, so the byte writers' per-plan caches (encoded
// fragments, the row emitter's table) hold across requests instead of re-encoding the row template per render.
const firstPlans = new WeakMap<ListPlan, ListPlan[]>();
function firstPlan(marked: ListPlan, n: number): ListPlan {
  let plans = firstPlans.get(marked);
  if (plans === undefined) firstPlans.set(marked, (plans = []));
  let plan = plans[n];
  if (plan === undefined) {
    const first = marked.fragments.slice();
    first[0] = "<!--r0" + n + "[-->" + first[0]!.slice(9);
    plan = plans[n] = { fragments: Object.freeze(first), attributes: marked.attributes, bytes: null, fixed: 0, rows: marked.rows };
  }
  return plan;
}
// The parser keeps a string as is (CR → LF, NUL, lone surrogates do not survive).
const KEPT = /[\r\0]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const shown = (v: unknown): boolean => (typeof v === "string" ? !KEPT.test(v) : typeof v === "number" && Number.isFinite(v) && !Object.is(v, -0));
/** Row 0's skeleton: DOM leaves → 1-based index into `paths` (`leaf` collects [tape slot] per index), others 0. */
function skeleton(value: unknown, tape: readonly unknown[], slots: DomList["slots"], paths: string[], leaf: number[], depth: number): unknown {
  if (typeof value === "string" || typeof value === "number") {
    if (!shown(value)) return 0;
    // A value several slots show (row 0 of `{ id: 0, values: [0, 1, …] }`: the id's attribute and the first value's text)
    // takes the first slot no earlier leaf took: the same slot for two leaves made every other row a misfit.
    let pick: readonly [number, string] | undefined;
    for (const entry of slots)
      if (tape[entry[0]] === value) {
        pick ??= entry;
        if (!leaf.includes(entry[0])) {
          pick = entry;
          break;
        }
      }
    if (pick === undefined) return 0;
    paths.push(typeof value === "number" ? "#" + pick[1] : pick[1]);
    leaf.push(pick[0]);
    return paths.length;
  }
  if (value === null || typeof value !== "object" || depth > 16) return 0;
  if (Array.isArray(value)) return value.map((v) => skeleton(v, tape, slots, paths, leaf, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype) return 0;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = skeleton((value as Record<string, unknown>)[key], tape, slots, paths, leaf, depth + 1);
  return out;
}
/** One row against the skeleton (`check`): its literals appended to `lits`, false when its shape or a DOM value differs. */
type Check = (value: unknown, base: number, lits: unknown[]) => boolean;
/**
 * The skeleton as a tree of closures, built once per list (ROWS-SSR: the generic walk with two `Object.keys` arrays per
 * object cost ~140 ns per bench row, more than the JSON it saves). A DOM leaf: the row's own tape value, of row 0's kind
 * (a `#` path parses a number), shown as written; a literal leaf: any non-object; an array: same length; a plain object:
 * the same keys in the same order.
 */
function checker(skel: unknown, tape: readonly unknown[], leaf: readonly number[], paths: readonly string[]): Check {
  if (typeof skel === "number") {
    if (skel === 0) return (value, _base, lits) => (value === null || typeof value !== "object") && (lits.push(value), true);
    const slot = leaf[skel - 1]!;
    return paths[skel - 1]!.charCodeAt(0) === 35
      ? (value, base) => value === tape[base + slot] && typeof value === "number" && value - value === 0 && !Object.is(value, -0)
      : (value, base) => value === tape[base + slot] && typeof value === "string" && !KEPT.test(value);
  }
  if (Array.isArray(skel)) {
    const kids = skel.map((s) => checker(s, tape, leaf, paths)),
      length = kids.length;
    return (value, base, lits) => {
      if (!Array.isArray(value) || value.length !== length) return false;
      for (let i = 0; i < length; i++) if (!kids[i]!(value[i], base, lits)) return false;
      return true;
    };
  }
  const keys = Object.keys(skel as object),
    kids = keys.map((key) => checker((skel as Record<string, unknown>)[key], tape, leaf, paths)),
    length = keys.length;
  return (value, base, lits) => {
    if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
    let i = 0;
    for (const key in value) {
      if (i === length || key !== keys[i] || !kids[i]!((value as Record<string, unknown>)[key], base, lits)) return false;
      i++;
    }
    return i === length;
  };
}
function encodeDom(record: number, list: DomList, path: (string | number)[]): DerivedDom | null {
  const paths: string[] = [],
    leaf: number[] = [],
    skel = skeleton(list.items[0], list.tape, list.slots, paths, leaf, 0);
  if (!paths.length) return null;
  const lits: unknown[] = [],
    whole: Record<number, unknown> = {},
    check = checker(skel, list.tape, leaf, paths);
  let kept = false;
  for (let r = 0; r < list.items.length; r++) {
    const mark = lits.length;
    if (!check(list.items[r], r * list.width, lits)) ((lits.length = mark), (whole[r] = list.items[r]), (kept = true));
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
