// Ported from HeroUI v3.2.6 packages/react/src/components/menu/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { MenuItem, MenuItemIndicator } from "../menu-item/index.ts";
import type { MenuItemRootProps } from "../menu-item/index.ts";
import { MenuSection } from "../menu-section/index.ts";
import type { MenuSectionRootProps } from "../menu-section/index.ts";
import { MenuRoot } from "./menu.tsx";
import type { MenuRootProps } from "./menu.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Menu = Object.assign(MenuRoot, {
  Root: MenuRoot,
  Item: MenuItem,
  ItemIndicator: MenuItemIndicator,
  Section: MenuSection,
});

export type Menu<T extends object = object> = {
  Props: MenuRootProps<T>;
  RootProps: MenuRootProps<T>;
  ItemProps: MenuItemRootProps;
  SectionProps: MenuSectionRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { MenuRoot };

export type { MenuRootProps, MenuRootProps as MenuProps } from "./menu.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { menuVariants } from "../../../styles/src/components/menu/index.ts";

export type { MenuVariants } from "../../../styles/src/components/menu/index.ts";
