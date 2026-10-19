// Inline repeat add-on, shipped only on pages whose state writes repeated handler / binding entries (encoder `rr`:
// collections — table rows and cells, list items — record the same entries per element, differing only in their
// captures), before the state script. Serialized with String(repeat), so it must be self-contained: browser globals only.
// The loader decodes the state with `document.$rx` when parsing, the stream add-on each patch (`p`: the patch, merged).
//
// Wire forms (resume-format `EntryRecord.R`, `RepeatedHandlers` / `RepeatedBinding`): a table entry `{R: [back, floor
// offset, delta, …]}` is the entry `back` earlier (floors `index + offset`), `e[id]` = `[back, floor, delta, …]` the
// handlers of element `id - back`, a binding `[-1 - back, node delta, region delta?, floor, delta, …]` the binding
// `back` entries earlier in the same list; their refs relocated: a ref takes the delta of the last floor ≤ it (none:
// unchanged). Table entries are rewritten in place into their base's wire form (compact recipe, `{o}` / `{w, o}`; a
// `{y}` base resolved first), so the table decoder never sees `R` and pages without repeats pay no decoder bytes.
// Decoded before the expand add-on's row templates: this add-on calls a previously installed `$rx` (the expand add-on)
// after its own; the expand add-on replaces `$rx`, so the server ships it first (shell: EXPAND then REPEAT; a patch that
// first needs EXPAND after REPEAT shipped re-ships REPEAT after it, `Stream.addon`).
import type { BindingEntry, EntryRecord, HandlerEntry, LoaderDocument, ResumeState, StatePatch } from "./resume-format.ts";

export function repeat(): void {
  const d = document as LoaderDocument,
    next = d.$rx;
  d.$rx = (s: ResumeState, list: BindingEntry[], p: StatePatch | ResumeState = s): void => {
    let m: number[];
    const move = (r: number): number => {
      let k = m.length;
      while ((k -= 2) >= 0 && r < m[k]!);
      return k < 0 ? r : r + m[k + 1]!;
    };
    // A wire entry with its refs relocated (`m`): a compact recipe's list past the head and numeric `q`, an object's
    // value refs (bases are compact recipes or objects: the encoder relocates plain recipes only).
    const moved = (x: EntryRecord): EntryRecord => {
      const n = { ...x },
        l = (x.f || x.c || x.k) as unknown as number[] | undefined;
      if (l) (n as Record<string, unknown>)[x.f ? "f" : x.c ? "c" : "k"] = l.map((r, j) => (j ? move(r) : r));
      if (typeof x.q == "number") n.q = move(x.q);
      if (x.o) n.o = x.o.map((v, j) => (x.w! > -1 || j & 1 ? move(v as number) : v));
      return n;
    };
    const t = s.t as EntryRecord[];
    for (let i = (p as StatePatch).t0 || 0, R, x; i < t.length; i++)
      if ((R = t[i]?.R)) {
        x = t[i - R[0]!]!;
        // A `{y}` base: its base's entry, refs past it moved by the distance (resume-format `repeated`).
        if (x.y! > -1) ((m = [x.y! + 1, i - R[0]! - x.y!]), (x = moved(t[x.y!]!)));
        m = R.slice(1);
        for (let k = 0; k < m.length; k += 2) m[k] += i;
        t[i] = moved(x);
      }
    for (const id in p.e) {
      const v = p.e[id] as unknown as number[];
      if (Array.isArray(v)) {
        const from = s.e[+id - v[0]!]!,
          h: Record<string, HandlerEntry> = {};
        m = v.slice(1);
        for (const type in from) (h[type] = from[type]!.slice() as HandlerEntry)[1] = from[type]![1].map(move);
        s.e[id] = p.e[id] = h;
      }
    }
    list.map((v, j) => {
      if (v[0] < -1) {
        const a = list[j + v[0] + 1]!,
          b = (list[j] = a.slice() as BindingEntry),
          odd = v.length & 1;
        m = (v as unknown as number[]).slice(2 + odd);
        b[0] += v[1] as number;
        b[6] += v[1 + odd] as number;
        b[3] = a[3].map(move);
        b[4] = a[4].map(move);
      }
    });
    next?.(s, list, p);
  };
}
