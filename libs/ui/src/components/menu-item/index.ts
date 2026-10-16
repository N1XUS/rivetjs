// Ported from HeroUI v3.2.6 packages/react/src/components/menu-item/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { MenuItemIndicator, MenuItemRoot, MenuItemSubmenuIndicator } from "./menu-item.tsx";
import type { MenuItemIndicatorSpanProps, MenuItemRootProps, MenuItemSubmenuIndicatorSpanProps } from "./menu-item.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const MenuItem = Object.assign(MenuItemRoot, {
  Root: MenuItemRoot,
  Indicator: MenuItemIndicator,
  SubmenuIndicator: MenuItemSubmenuIndicator,
});

export type MenuItem = {
  Props: MenuItemRootProps;
  RootProps: MenuItemRootProps;
  IndicatorProps: MenuItemIndicatorSpanProps;
  SubmenuIndicatorProps: MenuItemSubmenuIndicatorSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { MenuItemRoot, MenuItemIndicator, MenuItemSubmenuIndicator };

export type { MenuItemRootProps, MenuItemRootProps as MenuItemProps, MenuItemIndicatorProps, MenuItemSubmenuIndicatorProps } from "./menu-item.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { menuItemVariants } from "../../../styles/src/components/menu-item/index.ts";
export type { MenuItemVariants } from "../../../styles/src/components/menu-item/index.ts";
