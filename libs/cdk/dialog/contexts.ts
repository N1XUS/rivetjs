// Ported from packages/react-aria-components/src/Dialog.tsx (`DialogContext`), Apache-2.0, © Adobe.
// Rivet: its own tiny module so Modal / Popover / Sheet can provide it without importing the Dialog
// component (`aria-labelledby` may be an accessor). `OverlayTriggerStateContext` lives in `../overlay/contexts.ts`.
import { createContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import type { ContextValue } from "../slots/index.tsx";
import type { DialogProps } from "./index.tsx";

export type { DialogProps };

/** What a parent passes to its `<Dialog>`: Dialog props, `aria-labelledby` as a value or an accessor. */
export interface DialogContextValue extends Omit<DialogProps, "aria-labelledby"> {
  "aria-labelledby"?: string | (() => string | undefined);
  /** @private DialogTrigger's overlay id (RA mergeIds target): a Dialog with its own `id` sets it, so `aria-controls` follows. */
  idRef?: Signal<string>;
}

/** Props for the nearest `<Dialog>` from a parent (RAC `DialogContext`). */
export const DialogContext = createContext<ContextValue<DialogContextValue, HTMLElement>>(null);
