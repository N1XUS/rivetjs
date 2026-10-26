// Fetch-ahead gating of the derived model (ZERO R6a, server only, pure): which records' chunks the shell tail's `data-fo`
// modulepreloads. The loader boots the runtime and loads chunks only for records that can become live (D5 listening
// records, triggers, the document click listeners) and what adopting one needs — so only those are fetched ahead; a page
// whose records listen to nothing and have no trigger fetches nothing ahead (no runtime either).
import type { BoundaryRecord, FlushTail } from "./resume-format.ts";

/** Record flags (`BoundaryRecord[2]`, `server-derived.ts`). */
const INDEPENDENT = 1,
  LOAD = 32,
  IDLE = 64,
  VISIBLE = 128,
  MOD = 512;

/**
 * The records of a shell flush whose chunks are fetched ahead, in tail order: the live ones — a name with listened types
 * (tail `e`), a `load` / `idle` / `visible` trigger, a document click listener (`g`) — and, transitively, what the browser
 * adopts with or before one (`dom-derived.ts` `need`): a dependent record's parent chain, the records whose keyed signals
 * it read (wake-list sources), the readers its own keys wake, and the `MOD` records (any unnamed signal write wakes them).
 * Without D5 facts (no `e`): every record (today's fetch-ahead).
 */
export function foRecords(tail: FlushTail): readonly BoundaryRecord[] {
  const e = tail.e,
    all = tail.b;
  if (!e) return all;
  const byId = new Map<number, BoundaryRecord>(),
    sources = new Map<number, number[]>(),
    readers = new Map<number, number[]>();
  for (const r of all) byId.set(r[0], r);
  for (const key in tail.w) {
    const src = +key.slice(0, key.indexOf("."));
    for (const reader of tail.w[key]!) {
      (sources.get(reader) ?? sources.set(reader, []).get(reader)!).push(src);
      (readers.get(src) ?? readers.set(src, []).get(src)!).push(reader);
    }
  }
  const kept = new Set<number>(),
    stack: number[] = [];
  const keep = (id: number): void => void (byId.has(id) && !kept.has(id) && (kept.add(id), stack.push(id)));
  let mod = false;
  for (const r of all) if (e[r[3]] || r[2] & (LOAD | IDLE | VISIBLE)) keep(r[0]);
  for (const [id] of tail.g ?? []) keep(id);
  while (stack.length) {
    const r = byId.get(stack.pop()!)!;
    if (!(r[2] & INDEPENDENT) && r[1] >= 0) keep(r[1]);
    for (const id of sources.get(r[0]) ?? []) keep(id);
    for (const id of readers.get(r[0]) ?? []) keep(id);
    if (!mod && kept.size) {
      mod = true;
      for (const m of all) if (m[2] & MOD) keep(m[0]);
    }
  }
  return kept.size === all.length ? all : all.filter((r) => kept.has(r[0]));
}

/**
 * The names of `foRecords` (what `foUrls` fetches): a name every instance of which listens (tail `e` is by name) is kept
 * whole, so once every name of the flush has listened types the closure can add nothing — the common large page (500
 * listening cards, a table's cells) answers in one pass with no id maps (ZERO REGRESS: the closure's maps cost a 500-card
 * page ~12 % of its server time).
 */
export function foNames(tail: FlushTail): Set<string> {
  const e = tail.e,
    names = new Set<string>();
  let all = !!e;
  for (const r of tail.b) if ((names.add(r[3]), all) && !e![r[3]]) all = false;
  if (all || !e) return names;
  names.clear();
  const list = tail.b;
  if (list.length > 31) {
    for (const r of foRecords(tail)) names.add(r[3]);
    return names;
  }
  // A small flush (a routed page: Root, App, layout, page): the same closure over a bit mask of record indexes, no maps.
  const len = list.length,
    w = tail.w,
    at = (id: number): number => {
      for (let i = 0; i < len; i++) if (list[i]![0] === id) return 1 << i;
      return 0;
    };
  let mask = 0;
  for (let i = 0; i < len; i++) if (e[list[i]![3]] || list[i]![2] & (LOAD | IDLE | VISIBLE)) mask |= 1 << i;
  for (const [id] of tail.g ?? []) mask |= at(id);
  for (let before = -1; before !== mask;) {
    before = mask;
    for (let i = len; i--;) if (mask & (1 << i) && !(list[i]![2] & INDEPENDENT) && list[i]![1] > 0) mask |= at(list[i]![1]);
    for (const key in w) {
      const source = at(+key.slice(0, key.indexOf("."))),
        readers = w[key]!;
      let any = 0;
      for (let j = 0; j < readers.length; j++) any |= at(readers[j]!);
      // A kept reader keeps its source; a kept source keeps its readers.
      if (mask & any) mask |= source;
      if (mask & source) mask |= any;
    }
    if (mask) for (let i = 0; i < len; i++) if (list[i]![2] & MOD) mask |= 1 << i;
  }
  for (let i = 0; i < len; i++) if (mask & (1 << i)) names.add(list[i]![3]);
  return names;
}

/**
 * The shell tail's fetch-ahead URLs: the runtime, the chunks of `foRecords` (tail `m` by name), the islands' chunks, and
 * the static import closure of each (manifest `deps`); empty when nothing can become live and no island hydrates.
 */
export function foUrls(tail: FlushTail, runtime: string, deps: Record<string, string[]> | undefined, islands: readonly string[]): string[] {
  return urlsOf(foNames(tail), tail.m, runtime, deps, islands);
}

/** `foUrls` of the names `foNames` answered (`m`: chunk URL by name). */
export function urlsOf(
  names: ReadonlySet<string>,
  m: Record<string, string> | undefined,
  runtime: string,
  deps: Record<string, string[]> | undefined,
  islands: readonly string[],
): string[] {
  if (!names.size && !islands.length) return [];
  const urls = new Set<string>();
  const add = (url: string | undefined): void => {
    if (url === undefined || urls.has(url)) return;
    urls.add(url);
    for (const dep of deps?.[url] ?? []) urls.add(dep);
  };
  add(runtime);
  if (m) for (const name of names) add(m[name]);
  for (const url of islands) add(url);
  return [...urls];
}
