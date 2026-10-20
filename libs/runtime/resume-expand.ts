// Inline expand add-on, shipped only on pages whose state has compact row templates (region entry [8] / [9], For rows
// with handlers or bindings), before the state script. Serialized with String(expand), so it must be self-contained:
// browser globals only. The loader expands the state with `document.$rx` when parsing, the stream add-on each patch.
// `strided` (below): the DOM-DATA builds' part of it (`EXPAND_DOM` = this add-on, then that one).
import type { BindingEntry, CompactRows, HandlerEntry, LoaderDocument, ResumeState, RowTemplate } from "./resume-format.ts";

export function expand(): void {
  const d = document as LoaderDocument;
  // Expand list row templates (region entry [8] compact rows, [9] template) of `list` into per-row
  // handler and binding entries appended to `list`. Row item/index captures (-2/-3) become const refs
  // (≤ -10, into `s.k`): the server table stays index-aligned with streamed patches. Entries are
  // copied with slice() and patched in place (no rest/spread destructuring: half the cold time).
  d.$rx = (s: ResumeState, list: BindingEntry[]): void => {
    const t = s.t,
      K = (s.k ??= []);
    for (const region of list.slice())
      for (
        let R = region[8] as CompactRows, tpl = region[9] as RowTemplate | undefined, items = (tpl && (R.a != null ? t[R.a] : R.r)) as number[], k = 0;
        tpl && k < items.length;
        k++
      ) {
        const id = R.ids ? R.ids[k]! : R.i! + k * R.d!,
          index = -9 - K.push(items[k]!, [k]),
          item = index + 1,
          // Copy of entry `e` with its refs at `i` mapped (row item -2 / index -3 → const refs).
          map = <E extends unknown[]>(e: E, i: number): E => (
            ((e = e.slice() as E)[i] = (e[i] as number[]).map((r) => (r == -2 ? item : r == -3 ? index : r))),
            e
          );
        for (const o in tpl.e) {
          const h: Record<string, HandlerEntry> = (s.e[id + +o] = {});
          for (const type in tpl.e[o]) h[type] = map(tpl.e[o]![type]!, 1);
        }
        for (const entry of tpl.b) {
          const b = map(entry as unknown[], 3) as unknown as BindingEntry;
          b[0] += id;
          b.push(id);
          list.push(b);
        }
      }
  };
}

/**
 * DOM-DATA builds (`resume.domData`): compact rows' strided item refs (`CompactRows.rs`, runs `first, step, count`) back
 * to `r`, before the expand add-on's `$rx` (which it wraps; shipped right after it in one script, `EXPAND_DOM`) reads
 * them. Other builds never write `rs`: they ship `EXPAND` alone.
 */
export function strided(): void {
  const d = document as LoaderDocument,
    next = d.$rx!;
  d.$rx = (s: ResumeState, list: BindingEntry[], p?: unknown): void => {
    for (const region of list) {
      const R = region[9] && (region[8] as CompactRows),
        S = R && R.rs;
      if (S) {
        const r: number[] = (R.r = []);
        for (let i = 0; i < S.length; i += 3) for (let k = 0; k < S[i + 2]!; k++) r.push(S[i]! + k * S[i + 1]!);
      }
    }
    (next as (s: ResumeState, list: BindingEntry[], p?: unknown) => void)(s, list, p);
  };
}
