// Boundaries tail v2 decoder (ZERO S2, 2026-10-25): reads the wire format of `server-tail.ts` in place — records by name
// index, runs of stateless records expanded on the fly (never materialised as a list). No imports: the full (`dom-derived`)
// and the lite (`dom-lite`) runtimes share it without pulling in the values codec; `resume-format.ts` re-exports it.
import type { BoundaryTail, TailRecord, TailRun } from "./resume-format.ts";

const NO_VALUES: unknown[] = [];
/** Every record of a tail in id order: `fn(id, parent, flags, name index, keyed values, props)`. */
export function eachRecord(
  t: BoundaryTail,
  fn: (id: number, parent: number, flags: number, name: number, signals: unknown[], props: object | undefined) => void,
): void {
  for (const e of t.b) {
    if (e[3] !== -1) fn(e[0], e[1], e[2], e[3], (e[4] as unknown[] | undefined) ?? NO_VALUES, e[5]);
    else {
      const tmpl = (e as TailRun)[5],
        period = tmpl.length;
      for (let j = 0, id = e[0], count = (e as TailRun)[4] * period; j < count; j++, id++) {
        const slot = tmpl[j % period]!;
        fn(id, slot[0] < 0 ? id + slot[0] : slot[0], slot[1], slot[2], NO_VALUES, undefined);
      }
    }
  }
}
/** The record with id `id` (binary search over the entries' first ids; a run's member is built on the fly), else undefined. */
export function recAt(t: BoundaryTail, id: number): TailRecord | undefined {
  const b = t.b;
  let lo = 0,
    hi = b.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (b[mid]![0] <= id) lo = mid + 1;
    else hi = mid - 1;
  }
  const e = b[hi];
  if (!e) return undefined;
  if (e[3] !== -1) return e[0] === id ? (e as TailRecord) : undefined;
  const tmpl = (e as TailRun)[5],
    j = id - e[0];
  if (j >= (e as TailRun)[4] * tmpl.length) return undefined;
  const slot = tmpl[j % tmpl.length]!;
  return [id, slot[0] < 0 ? id + slot[0] : slot[0], slot[1], slot[2]];
}
/** Name of names-table entry `i`. */
export const nameOf = (t: BoundaryTail, i: number): string => t.n[i]![0];
/** Chunk URL of names-table entry `i` as written (short form: the loader resolves it), else undefined. */
export const urlOf = (t: BoundaryTail, i: number): string | undefined => {
  const u = t.n[i]![1];
  return u < 0 ? undefined : t.u![u];
};
