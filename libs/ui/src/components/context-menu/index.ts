// Rivet addition (no HeroUI v3.2.6 counterpart): right-click / long-press menu; feature set inspired by commercial UI kits' public
// Context Menu docs, independent implementation (see `context-menu.tsx`). Item / ItemIndicator / Section / SubmenuTrigger /
// SubmenuIndicator are the Dropdown parts.
import { DropdownItem, DropdownItemIndicator, DropdownSection, DropdownSubmenuIndicator, DropdownSubmenuTrigger } from "../dropdown/dropdown.tsx";
import type {
  DropdownItemIndicatorProps,
  DropdownItemProps,
  DropdownSectionProps,
  DropdownSubmenuIndicatorProps,
  DropdownSubmenuTriggerProps,
} from "../dropdown/dropdown.tsx";
import { ContextMenuMenu, ContextMenuPopover, ContextMenuRoot, ContextMenuSeparator, ContextMenuTrigger } from "./context-menu.tsx";
import type {
  ContextMenuMenuProps,
  ContextMenuPopoverProps,
  ContextMenuRootProps,
  ContextMenuSeparatorProps,
  ContextMenuTriggerProps,
} from "./context-menu.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ContextMenu = Object.assign(ContextMenuRoot, {
  Root: ContextMenuRoot,
  Trigger: ContextMenuTrigger,
  Popover: ContextMenuPopover,
  Menu: ContextMenuMenu,
  Item: DropdownItem,
  ItemIndicator: DropdownItemIndicator,
  Section: DropdownSection,
  SubmenuTrigger: DropdownSubmenuTrigger,
  SubmenuIndicator: DropdownSubmenuIndicator,
  Separator: ContextMenuSeparator,
});

export type ContextMenu = {
  Props: ContextMenuRootProps;
  RootProps: ContextMenuRootProps;
  TriggerProps: ContextMenuTriggerProps;
  PopoverProps: ContextMenuPopoverProps;
  MenuProps: ContextMenuMenuProps;
  ItemProps: DropdownItemProps;
  ItemIndicatorProps: DropdownItemIndicatorProps;
  SectionProps: DropdownSectionProps;
  SubmenuTriggerProps: DropdownSubmenuTriggerProps;
  SubmenuIndicatorProps: DropdownSubmenuIndicatorProps;
  SeparatorProps: ContextMenuSeparatorProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ContextMenuRoot, ContextMenuTrigger, ContextMenuPopover, ContextMenuMenu, ContextMenuSeparator } from "./context-menu.tsx";
export type {
  ContextMenuRootProps,
  ContextMenuRootProps as ContextMenuProps,
  ContextMenuTriggerProps,
  ContextMenuPopoverProps,
  ContextMenuMenuProps,
  ContextMenuSeparatorProps,
} from "./context-menu.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { contextMenuVariants } from "../../../styles/src/components/context-menu/index.ts";

export type { ContextMenuVariants } from "../../../styles/src/components/context-menu/index.ts";
