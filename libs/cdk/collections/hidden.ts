// Ported from react-aria-components Hidden.tsx (`HiddenContext`, `useIsHidden`), Apache-2.0, © Adobe.
// Rivet: split from `components.tsx` so hideable parts (Text, Label, Input, TextArea, Keyboard) can ask
// whether they render in the collection build pass without importing the collection builder (zero-cost).
// `components.tsx` provides `HiddenContext` (true) around every build pass. The server field slot probe flag
// (`slotProbing`) lives in `./server-on.tsx` (cdk `#server` import: the constant `false` in browsers).
import { createContext, useContext } from "@rivetjs/reactivity";

/** RAC `HiddenContext`: true while content renders in build mode (the hidden collection tree). */
export const HiddenContext = createContext(false);

/** RAC `useIsHidden` for hideable parts (`createHideableComponent`): render nothing while true. */
export function isHiddenPart(): boolean {
  return useContext(HiddenContext);
}
