// Ported from react-aria-components `ToggleButtonGroup` contexts (packages/react-aria-components/src/ToggleButtonGroup.tsx), Apache-2.0, © Adobe.
// Rivet: the two contexts live in their own module so `ToggleButton` (which consumes `ToggleGroupStateContext`)
// does not pull the group component; both registered for resume (`rv-toggle-button-group`, `rv-toggle-group-state`).
import { createContext } from "@rivetjs/reactivity";
import type { ToggleGroupState } from "../state/toggle-group.ts";
import type { ContextValue } from "../slots/index.tsx";
import type { ToggleButtonGroupProps } from "./index.tsx";

/** RAC `ToggleButtonGroupContext`: props for a `ToggleButtonGroup` (slots supported). */
export const ToggleButtonGroupContext = createContext<ContextValue<ToggleButtonGroupProps, HTMLDivElement>>({});

/** RAC `ToggleGroupStateContext`: the group state, read by each `ToggleButton` with an `id`. */
export const ToggleGroupStateContext = createContext<ToggleGroupState | null>(null);
