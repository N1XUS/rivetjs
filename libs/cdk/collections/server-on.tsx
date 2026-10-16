// Server half of the field slot probe: the default resolution of the cdk `#server` import and of
// `@rivetjs/cdk/slot-probe` (package.json). `.tsx`: server-compiled with its importers (one `slotProbing` instance).
// Browsers resolve `./server-off.ts` (`slotProbing` is the constant `false`, `probeSlots` a no-op), so DOM bundles fold
// every probe branch away: 0 bytes.
import { _wrapEffects, createRoot, provide, untrack, type Context } from "@rivetjs/reactivity";
import { _rUnrecorded } from "@rivetjs/runtime/resume-format";
import { _idScope, type IdScope } from "@rivetjs/runtime/id";
import { _probeTree } from "./components.tsx";

/**
 * Server: true while a field probes which of its slotted parts render (`probeSlots`; synchronous, module state). Parts
 * check it first: a hideable part that consumes a slot id (`Text` description / errorMessage, `ComboBoxValue`) marks it
 * (`probeSlot`) and renders nothing; Label / Input / FieldError, the ui wrappers and nested field owners return `null`
 * at once (their subtrees hold no slot of this field). Browser: the constant `false`.
 */
export let slotProbing = false;

/**
 * Rivet (server): run the field's `content` once with `values` (its context providers) and `slotProbing` on, before the
 * field renders the element whose `aria-describedby` names its parts (RA `useSlotId` drops a missing part after
 * hydration; a resumed page never re-renders). The parts that render mark their slot ids, so the owner writes
 * `slotIdRef(id, false)`. Isolation: untracked, unrecorded (no resume regions / ids), inside a throwaway root disposed
 * at the end (nothing the probe creates stays owned), effects inert (`_wrapEffects`: created, never run); a throw is
 * swallowed (the real render reports it). Field children therefore render twice on the server: keep them pure. Pass
 * the same providers as the real render (a part reading a missing context throws). Popover content is not probed
 * (its contexts are cleared there). Browser: a no-op.
 */
export function probeSlots(values: readonly (readonly [Context<any>, unknown])[], content: unknown): void {
  const previous = slotProbing;
  slotProbing = true;
  // Effects the probed children create are inert (their run is a no-op; server effects run once, in the real render).
  const wrap = _wrapEffects(inert);
  try {
    _rUnrecorded(() =>
      untrack(() =>
        createRoot((dispose) => {
          try {
            provideAll(values, 0, content);
          } catch {
            // A part that throws without the real render's surroundings: nothing more is marked; the real render that
            // follows reports a genuine error.
          } finally {
            dispose();
          }
        }),
      ),
    );
  } finally {
    _wrapEffects(wrap);
    slotProbing = previous;
  }
}

const noop = (): void => {};
const inert = (): (() => void) => noop;

/** Provides `values` from `i` on (nested `provide`s), then walks the content. */
function provideAll(values: readonly (readonly [Context<any>, unknown])[], i: number, content: unknown): void {
  if (i < values.length) provide(values[i]![0], values[i]![1], () => provideAll(values, i + 1, content));
  else _probeTree(content);
}

/** Server: reactive ids (`idSignal`) are registered per render id scope (`utils/id.ts`). Browser: the constant `false`. */
export const idScoping = true;
const scopedIds = new WeakMap<IdScope, Map<string, unknown>>();

/**
 * Server: the `idSignal` registry of the current render (`withIdScope`: the router opens one per request), or undefined
 * outside any scope (process-wide `rvs` ids: `utils/id.ts` keeps its module map). Id strings restart per scope, so
 * concurrent streaming renders share them; one registry per scope keeps a `mergeIds` of request B from changing request
 * A's ids. Held weakly by the scope object: dropped with the render.
 */
export function scopedIdUpdaters(): Map<string, unknown> | undefined {
  const scope = _idScope();
  if (!scope) return undefined;
  let map = scopedIds.get(scope);
  if (!map) scopedIds.set(scope, (map = new Map()));
  return map;
}
