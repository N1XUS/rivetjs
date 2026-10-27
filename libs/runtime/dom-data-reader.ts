// DOM data on derived (DERIVED-C5), browser reader — its own chunk (DOMDATA-DEFAULT v2): the derived runtime
// (`dom-derived.ts` "DOM data", behind the `DOM_DATA` switch) imports it when a tail has `d` entries (the tail's `D` URL,
// manifest `domData`), so a page without them never fetches it and a build without a qualifying list has neither.
//
// A tail `d` entry stands for a list items array of a record's props that the server left out: its rows are the page's
// rows after the list's anchor (`<!--r0<n>[-->`), each item rebuilt from the entry's skeleton. Each top-level key holding a
// page value is an accessor that reads its value from the row's DOM the first time (then a plain data property); the
// rest are literals. Everything still unread is read in idle slices after start, and before rows move or a unit renders
// in the browser (`realFor`, `client`: `sweep`) or the runtime writes into a row (`readRow`): read on first use, the rest
// at idle.
import type { DerivedDom } from "./resume-format.ts";
import { DEV } from "#dev";

type Records = ReadonlyMap<number, { props: unknown }>;
const R_OPEN = /^r\d*\[$/;
let anchors: Map<number, Comment> | null = null,
  unread: Record<string, unknown>[] | null = null,
  doc: Document | null = null;
const domRows = new Map<number, (Element | null)[]>();
// Row k's root = the first element inside its `<!--r…[-->` … `<!--]-->` group (balance as `closeAt` counts it: row
// openers up, `]` down), the groups in a run from the anchor. One pass over the siblings, no regex per node.
const rowOpen = (d: string): boolean => d.charCodeAt(0) === 114 && d.charCodeAt(d.length - 1) === 91 && R_OPEN.test(d);
function rowRoots(n: number): (Element | null)[] {
  let roots = domRows.get(n);
  if (roots) return roots;
  if (anchors === null) {
    anchors = new Map();
    const walk = doc!.createTreeWalker(doc!, 128);
    for (let c = walk.nextNode() as Comment | null; c; c = walk.nextNode() as Comment | null) {
      const d = c.data;
      if (d.charCodeAt(0) === 114 && d.charCodeAt(1) === 48 && d.length > 3) {
        const m = /^r0(\d+)\[$/.exec(d);
        if (m) anchors.set(+m[1]!, c);
      }
    }
  }
  roots = [];
  let depth = 0,
    root: Element | null = null;
  for (let x: Node | null = anchors.get(n) ?? null; x; x = x.nextSibling) {
    if (x.nodeType === 8) {
      const d = (x as Comment).data;
      if (rowOpen(d)) {
        if (depth++ === 0) root = null;
      } else if (depth === 0) break;
      else if (d === "]" && --depth === 0) roots.push(root);
    } else if (depth === 0) break;
    else if (root === null && x.nodeType === 1) root = x as Element;
  }
  domRows.set(n, roots);
  return roots;
}
// `tag:i.j` below the row root by element child index (the server's `rowTexts` path; tag checked): its whole text, with
// `@name` its attribute, `#…` the number it spells.
type DomPath = [number: boolean, tag: string, steps: number[], attribute: string | null];
const parsedPaths = new Map<string, DomPath>();
function domText(n: number, k: number, path: string): string | number {
  let p = parsedPaths.get(path);
  if (p === undefined) {
    const number = path.charCodeAt(0) === 35,
      at = path.indexOf("@"),
      steps = path.slice(+number, at < 0 ? undefined : at).split(/[:.]/);
    parsedPaths.set(path, (p = [number, steps[0]!, steps.slice(1).filter(Boolean).map(Number), at < 0 ? null : path.slice(at + 1)]));
  }
  let node: Element | null | undefined = rowRoots(n)[k];
  for (let i = 0; node && i < p[2].length; i++) node = node.children[p[2][i]!];
  const value = !node || node.localName !== p[1] ? null : p[3] === null ? node.textContent : node.getAttribute(p[3]);
  if (value === null)
    throw Error(DEV ? DEV.hint("Rivet resume: DOM-backed data has no <" + p[1] + "> at " + path + " in row " + k, "drift") : "Missing resume DOM data");
  return p[0] ? +value : value;
}
const zeros = (skel: unknown): number =>
  typeof skel === "number" ? +(skel === 0) : skel !== null && typeof skel === "object" ? Object.values(skel).reduce((a: number, v) => a + zeros(v), 0) : 0;
const paged = (skel: unknown): boolean => (typeof skel === "number" ? skel > 0 : skel !== null && typeof skel === "object" && Object.values(skel).some(paged));
function fill(skel: unknown, n: number, k: number, paths: string[], lits: unknown[], at: { i: number }): unknown {
  if (typeof skel === "number") return skel === 0 ? lits[at.i++] : domText(n, k, paths[skel - 1]!);
  if (Array.isArray(skel)) return skel.map((x) => fill(x, n, k, paths, lits, at));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(skel as object)) set(out, key, fill((skel as Record<string, unknown>)[key], n, k, paths, lits, at));
  return out;
}
const ROW = Symbol();
const own = (o: object, key: string, value: unknown): void =>
  void Object.defineProperty(o, key, { value, writable: true, enumerable: true, configurable: true });
// A plain store (a `__proto__` key defines the own property, as JSON.parse does).
const set = (o: Record<string, unknown>, key: string, value: unknown): void => (key === "__proto__" ? own(o, key, value) : void (o[key] = value));
function domEntry(recs: Records, [id, n, path, count, skel, paths, lits, whole]: DerivedDom): void {
  let host = recs.get(id)?.props as Record<string | number, unknown> | null | undefined;
  for (let i = 0; host && i < path.length - 1; i++) host = host[path[i]!] as Record<string | number, unknown> | null;
  if (!host || typeof host !== "object") return;
  // Per top-level key of an object skeleton: its sub-skeleton, its literals' offset within the row, whether the page holds part of it.
  const keys =
      skel !== null && typeof skel === "object" && !Array.isArray(skel)
        ? Object.keys(skel).map(
            (key, i, all) =>
              [
                key,
                (skel as Record<string, unknown>)[key],
                all.slice(0, i).reduce((a, x) => a + zeros((skel as Record<string, unknown>)[x]), 0),
                paged((skel as Record<string, unknown>)[key]),
              ] as const,
          )
        : null,
    width = zeros(skel),
    items: unknown[] = new Array(count);
  // One accessor pair per page-held key, shared by every item (the items keep one shape: monomorphic reads); the item's
  // row is its non-enumerable `ROW` symbol, the value cached per row on first read (written values too).
  const pairs =
    keys &&
    keys.map(([key, sub, offset, lazy]) => {
      if (!lazy) return null;
      const cache: unknown[] = new Array(count),
        known = new Uint8Array(count);
      return {
        configurable: true,
        enumerable: true,
        get(this: Record<symbol, number>): unknown {
          const k = this[ROW]!;
          if (!known[k]) ((known[k] = 1), (cache[k] = fill(sub, n, k, paths, lits, { i: bases[k]! + offset })));
          return cache[k];
        },
        set(this: Record<symbol, number>, value: unknown): void {
          const k = this[ROW]!;
          ((known[k] = 1), (cache[k] = value));
        },
      };
    });
  // Row k's first literal (rows kept whole take none).
  const bases = new Uint32Array(count);
  for (let k = 0, base = 0; k < count; k++) {
    if (whole && k in whole) {
      items[k] = whole[k];
      continue;
    }
    if (keys === null) items[k] = fill(skel, n, k, paths, lits, { i: base });
    else {
      const item: Record<string | symbol, unknown> = {};
      for (let j = 0; j < keys.length; j++) {
        const [key, sub, offset] = keys[j]!;
        if (pairs![j] === null) set(item as Record<string, unknown>, key, fill(sub, n, k, paths, lits, { i: base + offset }));
        else Object.defineProperty(item, key, pairs![j]!);
      }
      Object.defineProperty(item, ROW, { value: k });
      bases[k] = base;
      items[k] = item;
      (unread ??= []).push(item as Record<string, unknown>);
    }
    base += width;
  }
  host[path[path.length - 1]!] = items;
}
// One row's item read now (all its page-held keys): before the runtime writes into the row, whatever branch its own run
// or a writer takes (`{masked() ? "***" : row().label}` would otherwise read the label after the write).
export function readRow(item: unknown): void {
  if (item !== null && typeof item === "object" && ROW in item) for (const key in item) void (item as Record<string, unknown>)[key];
}
export function sweep(): void {
  const all = unread;
  unread = null;
  if (all) for (const item of all) for (const key in item) void item[key];
}
// The idle read: 16 items per idle callback (a 1000-row page reads for ~9 ms at 4x CPU in all). Idle periods also come
// while the first input waits for its chunks: a longer slice there delayed that input's DOM update (+8 ms at 4x).
type Idle = (fn: (deadline?: { timeRemaining(): number }) => void) => number;
let sweeping = false;
function idleSweep(deadline?: { timeRemaining(): number }): void {
  const all = unread;
  if (!all) return void (sweeping = false);
  let i = 0;
  while (i < all.length && i < 16 && (!deadline || deadline.timeRemaining() > 1)) for (const key in all[i++]!) void all[i - 1]![key];
  all.splice(0, i);
  if (unread !== all) return void (sweeping = false);
  if (all.length) (((window.requestIdleCallback as Idle | undefined) || setTimeout) as Idle)(idleSweep);
  else ((unread = null), (sweeping = false));
}

/** The tail's (or a patch's) `d` entries: each rebuilds its items array in its record's props; the rest read at idle. */
export function entries(d: readonly DerivedDom[], recs: Records, page: Document): void {
  doc = page;
  for (const entry of d) domEntry(recs, entry);
  if (unread && !sweeping) ((sweeping = true), (((window.requestIdleCallback as Idle | undefined) || setTimeout) as Idle)(idleSweep));
}
