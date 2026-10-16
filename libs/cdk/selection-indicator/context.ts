// Ported from react-spectrum packages/react-aria-components/src/SelectionIndicator.tsx (`SelectionIndicatorContext`), Apache-2.0, © Adobe.
// Its own module: Tabs / RadioGroup / ToggleButton provide it on every page, so their chunks carry this
// token only, never the SelectionIndicator / SharedElement code.
import { createContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import type { SharedElementRenderProps } from "../shared-element-transition/index.tsx";

/** What an item provides (RAC `ContextValue<SelectionIndicatorProps>`); a SelectionIndicator's own props win. */
export interface SelectionIndicatorContextValue {
  /** Whether the item is selected: an accessor (no item re-render) or a boolean. */
  isSelected?: boolean | (() => boolean);
  class?: string | ((values: SharedElementRenderProps) => string | undefined);
  style?: Record<string, string | number | undefined> | ((values: SharedElementRenderProps) => Record<string, string | number | undefined> | undefined);
}

/** RAC `SelectionIndicatorContext`: items provide `{ isSelected }`. */
export const SelectionIndicatorContext = resumableContext(
  createContext<SelectionIndicatorContextValue>({ isSelected: false }, { id: "rv-selection-indicator" }),
);
