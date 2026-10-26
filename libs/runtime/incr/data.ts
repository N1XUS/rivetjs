// Data memo of incremental renders (lane INCR2): long arrays of deeply frozen JSON data (rows from an immutable store) are
// checked as data (`isData`) and encoded into the tail (`encodeTail`) once per element, not once per request. Frozen is
// forever: an element that was deeply frozen data when stored is the same data whenever the same object comes back. Keyed by
// the array's first element; the array of a later request is compared element by element (identity) with the stored one;
// elements that differ are checked / encoded alone. Only renders whose options carry an incr cache use it.
import { _incrOn, _onDataArray, isData } from "../server-derived.ts";
import { _onTailRecords } from "../server-tail.ts";
import { escapeJSON } from "../resume-format.ts";

const MIN = 64;
interface Memo {
  items: unknown[];
  /** The array's escaped JSON (null: not built yet) and where each element's starts in it (`at[n]` = its end + 1). */
  json: string | null;
  at: Int32Array | null;
  /** Elements changed since `json` was built (spliced in at the next encode). */
  dirty: number[];
  bytes: number;
  /** Lookups it answered (a memo nothing looked up again is not worth encoding per element). */
  hits: number;
}
/** Memos made since the last lookup any memo answered: past a few, only every 8th array gets one (data rebuilt per request). */
let streak = 0;
const memos = new Map<unknown, Memo>();
let held = 0;
const MAX_MEMOS = 256,
  MAX_BYTES = 16 * 1024 * 1024;

/** `value` (data) is deeply frozen: frozen, and so is every object in it. */
function deepFrozen(value: unknown, depth: number): boolean {
  if (typeof value !== "object" || value === null) return true;
  if (!Object.isFrozen(value) || depth > 64) return false;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!deepFrozen(value[i], depth + 1)) return false;
    return true;
  }
  for (const key in value) if (!deepFrozen((value as Record<string, unknown>)[key], depth + 1)) return false;
  return true;
}
function store(first: unknown, memo: Memo): void {
  const old = memos.get(first);
  if (old !== undefined) ((held -= old.bytes), memos.delete(first));
  // At most a few memos nothing looked up yet (data rebuilt per request makes one per render).
  let unhit = 0;
  for (const [key, m] of memos) if (m.hits === 0 && ++unhit >= 4) (memos.delete(key), (held -= m.bytes));
  memos.set(first, memo);
  held += memo.bytes;
  for (const [key, m] of memos) {
    if (memos.size <= MAX_MEMOS && held <= MAX_BYTES) break;
    if (m === memo) continue;
    memos.delete(key);
    held -= m.bytes;
  }
}
const frozenObject = (value: unknown): boolean => typeof value === "object" && value !== null && Object.isFrozen(value);

/** `isData(value)` of a long array, or undefined (walk it): answers from the memo of its first element. */
function dataArray(value: readonly unknown[], depth: number): boolean | undefined {
  const first = value[0];
  if (!frozenObject(first) || !_incrOn()) return undefined;
  const n = value.length;
  const memo = memos.get(first);
  if (memo !== undefined && memo.items.length === n) {
    const items = memo.items;
    let changed = 0;
    for (let i = 0; i < n; i++) if (value[i] !== items[i]) changed++;
    if (changed === 0) return (memo.hits++, (streak = 0), true);
    if (4 * changed <= n) {
      let frozen = true;
      for (let i = 0; i < n; i++) {
        const v = value[i];
        if (v === items[i]) continue;
        if (v === undefined || !isData(v, depth + 1)) return false;
        if (frozen && deepFrozen(v, depth + 1)) {
          items[i] = v;
          memo.dirty.push(i);
        } else frozen = false;
      }
      memo.hits++;
      streak = 0;
      if (!frozen) (memos.delete(first), (held -= memo.bytes));
      return true;
    }
  }
  if (streak++ > 4 && streak % 8 !== 0) return undefined;
  let frozen = true;
  for (let i = 0; i < n; i++) {
    const v = value[i];
    if (v === undefined || !isData(v, depth + 1)) return false;
    if (frozen) frozen = deepFrozen(v, depth + 1);
  }
  if (frozen) store(first, { items: value.slice(), json: null, at: null, dirty: [], bytes: n * 16, hits: 0 });
  return true;
}

/** The escaped JSON of a long frozen array held by the memo, else null. */
function arrayJson(value: readonly unknown[]): string | null {
  const memo = memos.get(value[0]);
  if (memo === undefined || memo.hits === 0 || memo.items.length !== value.length) return null;
  const items = memo.items;
  for (let i = 0; i < value.length; i++) if (value[i] !== items[i]) return null;
  const n = items.length;
  if (memo.json === null || 8 * memo.dirty.length > n) {
    // Whole: element by element (their offsets), joined.
    const parts: string[] = new Array(n),
      at = new Int32Array(n + 1);
    let offset = 1;
    for (let i = 0; i < n; i++) {
      at[i] = offset;
      offset += (parts[i] = JSON.stringify(items[i])).length + 1;
    }
    at[n] = offset;
    memo.json = escapeJSON("[" + parts.join(",") + "]");
    // (Escaping lengthens only text with `<` / U+2028 / U+2029: offsets then come from the escaped parts.)
    if (memo.json.length !== offset) {
      offset = 1;
      for (let i = 0; i < n; i++) ((at[i] = offset), (offset += escapeJSON(parts[i]!).length + 1));
      at[n] = offset;
    }
    memo.at = at;
    memo.dirty.length = 0;
  } else if (memo.dirty.length) {
    // Splice the changed elements into the stored JSON (slices of it between them), then move the offsets after each.
    const dirty = memo.dirty.sort((x, y) => x - y),
      at = memo.at!,
      json = memo.json,
      deltas: number[] = [];
    let out = "",
      from = 0,
      prev = -1;
    for (const i of dirty) {
      if (i === prev) continue;
      prev = i;
      const part = escapeJSON(JSON.stringify(items[i])),
        end = at[i + 1]! - 1;
      out += json.slice(from, at[i]!) + part;
      deltas.push(i, part.length - (end - at[i]!));
      from = end;
    }
    memo.json = out + json.slice(from);
    for (let j = 0, d = 0, shift = 0; j <= n; j++) {
      at[j]! += shift;
      if (d < deltas.length && deltas[d] === j) ((shift += deltas[d + 1]!), (d += 2));
    }
    dirty.length = 0;
  }
  const bytes = memo.json.length;
  const old = memo.bytes;
  memo.bytes = n * 24 + 2 * bytes;
  if (memos.get(value[0]) === memo) held += memo.bytes - old;
  return memo.json;
}

// Placeholders: a per-process random tag no data guesses.
const TAG = "\u0001rvi" + Math.random().toString(36).slice(2) + "_";
/** `value` with its stored long arrays (objects ≤ 3 levels down) replaced by placeholders, or `value` itself. */
function substitute(value: unknown, depth: number, out: string[]): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    if (value.length < MIN || !frozenObject(value[0])) return value;
    const json = arrayJson(value);
    if (json === null) return value;
    out.push(json);
    return TAG + (out.length - 1) + "\u0001";
  }
  if (depth >= 3) return value;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  let copy: Record<string, unknown> | null = null;
  for (const key in value) {
    const v = (value as Record<string, unknown>)[key],
      s = substitute(v, depth + 1, out);
    if (s === v) continue;
    if (copy === null) {
      copy = {};
      for (const k in value) copy[k] = (value as Record<string, unknown>)[k];
    }
    copy[key] = s;
  }
  return copy ?? value;
}

/** Install the data memo's `isData` / tail hooks (`createIncrCache` does). */
export function installDataMemo(): void {
  _onDataArray(dataArray);
  _onTailRecords(tailRecords);
}
function tailRecords(b: unknown[][]): { b: unknown[]; fill(json: string): string } | null {
  if (!_incrOn()) return null;
  let out: string[] | null = null,
    records: unknown[] | null = null;
  for (let i = 0; i < b.length; i++) {
    const record = b[i]!;
    if (record.length !== 6) continue;
    const parts: string[] = out ?? [];
    const props = substitute(record[5], 0, parts);
    if (props === record[5]) continue;
    out = parts;
    records ??= b.slice();
    const copy = record.slice();
    copy[5] = props;
    records[i] = copy;
  }
  if (records === null) return null;
  const json = out!;
  return {
    b: records,
    fill(text: string): string {
      for (let i = 0; i < json.length; i++) {
        const mark = JSON.stringify(TAG + i + "\u0001"),
          at = text.indexOf(mark);
        text = text.slice(0, at) + json[i] + text.slice(at + mark.length);
      }
      return text;
    },
  };
}
