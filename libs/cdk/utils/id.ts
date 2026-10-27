// SSR-stable unique ids: `createId` / `withIdScope` re-export `@rivetjs/runtime/id` (server `rv…`,
// browser `rvc…`). Plus react-aria's id utilities.
// Ported from react-spectrum packages/react-aria/src/utils/useId.ts (Apache-2.0, © Adobe):
// `useId`, `mergeIds`, `useSlotId`.
//
// Rivet: `useId` supplies document uniqueness. Cross-part IDREF roots use `resumedId()`
// (the date fields' keyed signal helper) so an adopt run reuses the server value. React re-renders components
// whose id lost a `mergeIds`; Rivet components that need that read an `idSignal()` (reactive id),
// which `mergeIds` updates the same way the original updates its `idsUpdaterMap` refs.
import { signal, type Signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";
import { idScoping, scopedIdUpdaters } from "#server";
import { resumedId } from "./resumed-id.tsx";
export { resumedId } from "./resumed-id.tsx";
export { createId, withIdScope } from "@rivetjs/runtime/id";

/** If a default is not provided, generate an id (react-aria `useId`). */
export function useId(defaultId?: string): string {
  return defaultId || createId();
}

// id → reactive ids holding it (react-aria `idsUpdaterMap`). Never serialized. Dead entries (collected signals) are
// pruned lazily and amortized: a list when it doubles, the map when it doubles past `SWEEP` — a `FinalizationRegistry`
// registration per id cost ~1 µs per reactive id (and weak cell work in every GC); `mergeIds` only ever sees live refs
// either way (`live`).
// Server: one registry per render id scope (`scopedIdUpdaters`, cdk `#server`): ids restart per request (`rv` + n), so
// concurrent streaming renders share id strings and a module-wide map let request B's `mergeIds` flip request A's
// input id. Outside any scope (process-wide `rvs` ids) and in browsers: this module map (`idScoping` is the constant
// `false` there, so the lookup folds away: 0 DOM bytes).
type Updaters = Map<string, WeakRef<Signal<string>>[]>;
const updaters: Updaters = new Map();
const SWEEP = 1024;
let sweepAt = SWEEP;
const registry = (): Updaters => (idScoping && (scopedIdUpdaters() as Updaters | undefined)) || updaters;

/**
 * A reactive id (`useId` whose value `mergeIds` can change): `defaultId` or a new id. Bindings
 * reading it update when a `mergeIds` call merges this id into another one.
 */
export function idSignal(defaultId?: string): Signal<string> {
  const id = defaultId || resumedId();
  const value = signal(id);
  const map = registry();
  const refs = map.get(id);
  if (refs) {
    refs.push(new WeakRef(value));
    // Same id re-created over and over (a fixed `id` prop remounted): prune its list at powers of two.
    if (refs.length >= 8 && (refs.length & (refs.length - 1)) === 0) prune(map, id, refs);
  } else {
    map.set(id, [new WeakRef(value)]);
    if (map === updaters && updaters.size >= sweepAt) {
      for (const [key, list] of updaters) prune(updaters, key, list);
      sweepAt = Math.max(SWEEP, updaters.size * 2);
    }
  }
  return value;
}

function prune(map: Updaters, id: string, refs: WeakRef<Signal<string>>[]): void {
  let n = 0;
  for (let i = 0; i < refs.length; i++) if (refs[i]!.deref() !== undefined) refs[n++] = refs[i]!;
  if (n === 0) map.delete(id);
  else refs.length = n;
}

/** Forget the reactive ids registered for `id` (react-aria's cleanup when the id unmounts). */
export function releaseId(id: string): void {
  registry().delete(id);
}

/**
 * Merges two ids. Equal → that id. Otherwise the reactive ids (`idSignal`) holding `idA` switch to
 * `idB` (result `idB`), else those holding `idB` switch to `idA` (result `idA`), else `idB`.
 */
export function mergeIds(idA: string, idB: string): string {
  if (idA === idB) return idA;
  const setA = live(idA);
  if (setA) {
    for (const ref of setA) ref.set(idB);
    return idB;
  }
  const setB = live(idB);
  if (setB) {
    for (const ref of setB) ref.set(idA);
    return idA;
  }
  return idB;
}

function live(id: string): Signal<string>[] | undefined {
  const list = registry()
    .get(id)
    ?.map((ref) => ref.deref())
    .filter((s): s is Signal<string> => !!s);
  return list?.length ? list : undefined;
}

/**
 * react-aria `useSlotId`: `id` when an element with that id is rendered in `root`'s document, else
 * undefined — so `aria-describedby={slotId}` never points at a missing element. Rivet: call it in a
 * client effect / handler after the slot rendered (server: returns `id`, as the server renders the
 * slot in the same pass and React's first render does the same).
 */
export function useSlotId(id: string, root?: Node | null): string | undefined {
  const doc = root ? (root.ownerDocument ?? (root as Document)) : typeof document === "undefined" ? undefined : document;
  if (!doc) return id;
  return doc.getElementById(id) ? id : undefined;
}
