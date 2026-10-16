// Ported from HeroUI v3.2.6 packages/react/src/components/dropdown/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import {
  DropdownItem,
  DropdownItemIndicator,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownSection,
  DropdownSubmenuIndicator,
  DropdownSubmenuTrigger,
  DropdownTrigger,
} from "./dropdown.tsx";
import type {
  DropdownItemIndicatorProps,
  DropdownItemProps,
  DropdownMenuProps,
  DropdownPopoverProps,
  DropdownRootProps,
  DropdownSectionProps,
  DropdownSubmenuIndicatorProps,
  DropdownSubmenuTriggerProps,
  DropdownTriggerProps,
} from "./dropdown.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Dropdown = Object.assign(DropdownRoot, {
  Root: DropdownRoot,
  Trigger: DropdownTrigger,
  Popover: DropdownPopover,
  Menu: DropdownMenu,
  Section: DropdownSection,
  Item: DropdownItem,
  ItemIndicator: DropdownItemIndicator,
  SubmenuIndicator: DropdownSubmenuIndicator,
  SubmenuTrigger: DropdownSubmenuTrigger,
});

export type Dropdown<T extends object = object> = {
  Props: DropdownRootProps;
  RootProps: DropdownRootProps;
  TriggerProps: DropdownTriggerProps;
  PopoverProps: DropdownPopoverProps;
  MenuProps: DropdownMenuProps<T>;
  SectionProps: DropdownSectionProps;
  ItemProps: DropdownItemProps;
  ItemIndicatorProps: DropdownItemIndicatorProps;
  SubmenuIndicatorProps: DropdownSubmenuIndicatorProps;
  SubmenuTriggerProps: DropdownSubmenuTriggerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  DropdownItem,
  DropdownItemIndicator,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownSection,
  DropdownSubmenuIndicator,
  DropdownSubmenuTrigger,
  DropdownTrigger,
};

export type {
  DropdownItemIndicatorProps,
  DropdownItemProps,
  DropdownMenuProps,
  DropdownPopoverProps,
  DropdownRootProps,
  DropdownRootProps as DropdownProps,
  DropdownSectionProps,
  DropdownSubmenuIndicatorProps,
  DropdownSubmenuTriggerProps,
  DropdownTriggerProps,
} from "./dropdown.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { dropdownVariants } from "../../../styles/src/components/dropdown/index.ts";

export type { DropdownVariants } from "../../../styles/src/components/dropdown/index.ts";
