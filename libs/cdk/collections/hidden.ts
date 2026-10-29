// Ported from react-aria-components Hidden.tsx (`HiddenContext`, `useIsHidden`), Apache-2.0, © Adobe.
// Rivet: split from `components.tsx` so hideable parts (Text, Label, Input, TextArea, Keyboard) and overlays (Popover,
// Dialog, Tooltip, …: `isHidden`) can ask whether they render in the collection build pass without importing the
// collection builder (zero-cost; BIG-UI: the builder chunk was ~5 KB gz on every overlay page).
// `components.tsx` provides `HiddenContext` (true) around every build pass. The server field slot probe flag
// (`slotProbing`) lives in `./server-on.tsx` (cdk `#server` import: the constant `false` in browsers).
import { createContext, useContext, type Owner } from "@rivetjs/reactivity";
import type { CollectionNodeSpec } from "./base.ts";
import type { Key } from "./types.ts";

/** RAC `HiddenContext`: true while content renders in build mode (the hidden collection tree). */
export const HiddenContext = createContext(false);

/** RAC `useIsHidden` for hideable parts (`createHideableComponent`): render nothing while true. */
export function isHiddenPart(): boolean {
  return useContext(HiddenContext);
}

/** Build scope (internal, synchronous; never resumed): where parts register their node specs (`components.tsx`). */
export interface BuildScope {
  readonly specs: CollectionNodeSpec<any>[];
  readonly parentKey: Key | null;
  /** Ordinal of the next id-less part under this parent (`generatedId`). */
  readonly ids: { n: number };
  /** The build's observer (shared by the nested scopes of one build; cleared when the build ends). */
  readonly run: BuildRun;
  /** `probeCollection` (an id probe): collection roots merge their own id and register nothing. */
  readonly probe?: true;
}
export interface BuildRun {
  o: object | null;
  /** Specs registered and not yet claimed by a retention segment (`components.tsx` `segment`); absent in probes. */
  log?: CollectionNodeSpec<any>[];
  /** The build's segment roots that own something (eager JSX props' bindings), released with the build. */
  held?: { owner: Owner; refs: number }[];
}
/** The collection build pass (`components.tsx` provides it). */
export const BuildContext = createContext<BuildScope | null>(null);

/** RAC `useIsHidden`: whether the caller renders in build mode (render nothing visible, register only). */
export function isHidden(): boolean {
  return useContext(HiddenContext) || useContext(BuildContext) != null;
}

/** Whether the caller renders inside `probeCollection`: a collection root merges the context id and renders nothing. */
export function isCollectionProbe(): boolean {
  return useContext(BuildContext)?.probe === true;
}
