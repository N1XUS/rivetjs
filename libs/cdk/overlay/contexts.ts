// Ported from React Aria Components (Dialog.tsx `OverlayTriggerStateContext`, Popover.tsx
// `PopoverContext`, OverlayArrow.tsx `OverlayArrowContext`), Apache-2.0, © Adobe.
// The overlay contexts that trigger components (DialogTrigger, MenuTrigger, Select, ComboBox,
// DatePicker, PreviewTrigger, SubmenuTrigger) provide and Popover / OverlayArrow consume.
// Rivet:
// - one tiny module (no component code): a trigger that provides `PopoverContext` does not pull the
//   Popover component in (importing popover/index.tsx would register its own module state).
// - `OverlayArrowContext` carries the placement and RA's `arrowProps.style` offset as signals (they
//   change after positioning); the arrow's own `style` wins over them, as in RAC.
import { createContext, type Context, type Signal } from "@rivetjs/reactivity";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import type { ContextValue } from "../slots/index.tsx";
import type { PlacementAxis } from "./position.ts";
import type { OverlayTriggerState } from "../state/overlays.ts";
import type { PopoverProps } from "../popover/index.tsx";

/** The overlay trigger state of the nearest DialogTrigger / MenuTrigger / Select / … (RAC `OverlayTriggerStateContext`). */
export const OverlayTriggerStateContext = createContext<OverlayTriggerState | null>(null);

/** What a trigger component passes to its `<Popover>` (RAC `PopoverContextValue`). */
export interface PopoverContextValue extends Omit<PopoverProps, "children" | "ref"> {
  id?: string;
  /** Contexts to clear (provided as `null`) for the popover's children (RAC: ComboBox clears its field contexts). */
  clearContexts?: readonly Context<any>[];
  /** The trigger's id signal: a user `id` on the Popover replaces the generated one (RA mergeIds; Rivet). */
  idRef?: Signal<string>;
}

/** Props from the nearest trigger component for its Popover (RAC `PopoverContext`). Popover clears it for its children. */
export const PopoverContext = createContext<ContextValue<PopoverContextValue, HTMLElement>>(null);

/** What Popover / Tooltip pass to an `<OverlayArrow>` inside them (RAC `OverlayArrowContext`). */
export interface OverlayArrowContextValue {
  /** The placement of the overlay relative to the trigger (after flipping); null until positioned. */
  placement: Signal<PlacementAxis | null> | PlacementAxis | null;
  /** The arrow element ref the overlay positions (RAC: the context `ref`). */
  ref?: Ref<HTMLDivElement>;
  /** RA `arrowProps.style` (`left` / `top` in px) as a signal; the arrow's own `style` wins. */
  offset?: Signal<ArrowOffset | null>;
}

/** The arrow's cross-axis offset within the overlay (RA `arrowProps.style`). */
export interface ArrowOffset {
  left?: number;
  top?: number;
}

/** RAC `OverlayArrowContext` (default placement "bottom"). */
export const OverlayArrowContext = createContext<ContextValue<OverlayArrowContextValue, HTMLDivElement>>({ placement: "bottom" });
