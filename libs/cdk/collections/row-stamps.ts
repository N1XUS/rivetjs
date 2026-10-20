// Server baseline of built-collection rows on a resumed page (ROW-RERENDER, 2026-10-20). A resumed page adopts the server's
// rows of a keyed `For` over collection keys (`renderNodes`): an unchanged key keeps its server row, which never re-renders
// (the server rendered the node untracked; `renderNodeAt`'s `sameRender` cut-off exists only for browser-created rows). The
// server records one stamp per row — a 24-bit hash of the node's render inputs, 4 characters — with the For's region
// (`_regionState`); the browser re-checks each adopted row's node against that set and re-creates the rows whose node no
// longer renders like the server's (`resumedKeys` in `components.tsx`).
import type { CollectionNodeClass } from "./base.ts";
import type { Key, Node } from "./types.ts";

// 64 JSON / HTML-safe characters (no quote, backslash, `<`, `&`).
const DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Characters per row stamp (24 bits). */
export const STAMP = 4;

let h = 0,
  budget = 0;
const ch = (c: number): void => void (h = Math.imul(h ^ c, 16777619));
const str = (s: string): void => {
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  ch(0);
};
const isPlain = (v: object): boolean => {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
// Data the server and the browser see alike (resume-decoded values): primitives, arrays, plain objects, dates. Functions
// (slots, render functions, handlers: the server and browser compile them differently) and class instances count by kind only;
// nesting below `depth` by kind and length. `budget` bounds the work per node (a tree node's value holds its subtree).
function feed(v: unknown, depth: number): void {
  if (--budget < 0) return;
  switch (typeof v) {
    case "string":
      (ch(1), str(v));
      return;
    case "number":
    case "bigint":
      (ch(2), str(String(v)));
      return;
    case "boolean":
      ch(v ? 3 : 4);
      return;
    case "undefined":
      ch(5);
      return;
    case "function":
      ch(6);
      return;
    case "object":
      break;
    default:
      ch(7);
      return;
  }
  if (v === null) return ch(8);
  if (Array.isArray(v)) {
    (ch(9), str(String(v.length)));
    if (depth > 0) for (let i = 0; i < v.length; i++) feed(v[i], depth - 1);
    return;
  }
  if (v instanceof Date) return (ch(10), str(String(v.getTime())));
  if (!isPlain(v)) return ch(11);
  ch(12);
  if (depth > 0) for (const k in v) (str(k), feed((v as Record<string, unknown>)[k], depth - 1));
}

function node(n: Node<unknown>): void {
  const live = (n.constructor as CollectionNodeClass<unknown>).liveProps;
  (str(n.type), feed(n.key, 0), feed(n.textValue, 0), feed(n["aria-label"], 0), feed(n.rendered, 0));
  const props = n.props as Record<string, unknown> | undefined;
  if (props) for (const k in props) if (!live?.includes(k)) (str(k), feed(props[k], 2));
  const value = n.value as unknown;
  if (live && value !== null && typeof value === "object" && isPlain(value)) {
    ch(12);
    for (const k in value) if (!live.includes(k)) (str(k), feed((value as Record<string, unknown>)[k], 2));
  } else feed(value, 3);
}

/**
 * The row stamp of a built node: a 24-bit hash of what `sameRender` compares (type, key, text, `rendered`, props, value), as
 * 4 characters. A section's stamp covers its child nodes too (`children`): its rows are a For the section part creates in
 * its body (ListBoxSection), which a resumed page never re-runs, so a changed child re-creates the section row.
 */
export function stamp(n: Node<unknown> | null | undefined, children?: Iterable<Node<unknown>> | null): string {
  h = 0x811c9dc5;
  if (n) {
    budget = 256;
    node(n);
    if (children) for (const child of children) ((budget = 256), node(child));
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return DIGITS[h & 63]! + DIGITS[(h >>> 6) & 63]! + DIGITS[(h >>> 12) & 63]! + DIGITS[(h >>> 18) & 63]!;
}

/** The set of stamps in a baseline string. */
export function stampSet(base: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + STAMP <= base.length; i += STAMP) set.add(base.slice(i, i + STAMP));
  return set;
}

/** A row key the browser re-created (its node changed since the server render): a fresh For key for the same collection key. */
export interface RowBox {
  readonly k: Key;
}
/** The collection key of a `For` row key (`resumedKeys` boxes the keys of rows it re-creates). */
export const rowKey = (key: Key | RowBox): Key => (typeof key === "object" ? key.k : key);
