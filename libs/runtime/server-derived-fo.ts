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
 * The shell tail's fetch-ahead URLs: the runtime, the chunks of `foRecords` (tail `m` by name), the islands' chunks, and
 * the static import closure of each (manifest `deps`); empty when nothing can become live and no island hydrates.
 */
export function foUrls(tail: FlushTail, runtime: string, deps: Record<string, string[]> | undefined, islands: readonly string[]): string[] {
  const records = foRecords(tail);
  if (!records.length && !islands.length) return [];
  const urls = new Set<string>(),
    m = tail.m,
    names = new Set<string>();
  for (const r of records) names.add(r[3]);
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
