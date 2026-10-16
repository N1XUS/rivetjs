// Ported from HeroUI v3.2.6 packages/react/src/components/combo-box/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { ComboBoxInputGroup, ComboBoxItem, ComboBoxPopover, ComboBoxRoot, ComboBoxTrigger, ComboBoxValue } from "./combo-box.tsx";
import type {
  ComboBoxInputGroupProps,
  ComboBoxItemProps,
  ComboBoxPopoverProps,
  ComboBoxRootProps,
  ComboBoxTriggerProps,
  ComboBoxValueProps,
} from "./combo-box.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ComboBox = Object.assign(ComboBoxRoot, {
  Root: ComboBoxRoot,
  InputGroup: ComboBoxInputGroup,
  Value: ComboBoxValue,
  Trigger: ComboBoxTrigger,
  Popover: ComboBoxPopover,
  Item: ComboBoxItem,
});

export type ComboBox<T extends object = object, M extends "single" | "multiple" = "single"> = {
  Props: ComboBoxRootProps<T, M>;
  RootProps: ComboBoxRootProps<T, M>;
  InputGroupProps: ComboBoxInputGroupProps;
  ValueProps: ComboBoxValueProps<T>;
  TriggerProps: ComboBoxTriggerProps;
  PopoverProps: ComboBoxPopoverProps;
  ItemProps: ComboBoxItemProps<T>;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ComboBoxRoot, ComboBoxInputGroup, ComboBoxValue, ComboBoxTrigger, ComboBoxPopover, ComboBoxItem };

export type {
  ComboBoxRootProps,
  ComboBoxRootProps as ComboBoxProps,
  ComboBoxInputGroupProps,
  ComboBoxValueProps,
  ComboBoxValueRenderProps,
  ComboBoxTriggerProps,
  ComboBoxPopoverProps,
  ComboBoxItemProps,
} from "./combo-box.tsx";

/* -------------------------------------------------------------------------------------------------
 * Context
 * -----------------------------------------------------------------------------------------------*/
export { ComboBoxContext } from "./combo-box.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { comboBoxVariants } from "../../../styles/src/components/combo-box/index.ts";

export type { ComboBoxVariants } from "../../../styles/src/components/combo-box/index.ts";
