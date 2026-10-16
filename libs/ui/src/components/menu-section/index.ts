// Ported from HeroUI v3.2.6 packages/react/src/components/menu-section/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → `MenuSectionRootProps`; `@heroui/styles` → vendored `styles/`.
import { MenuSectionRoot } from "./menu-section.tsx";
import type { MenuSectionRootProps } from "./menu-section.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const MenuSection = MenuSectionRoot;

export type MenuSection = {
  Props: MenuSectionRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { MenuSectionRoot };

export type { MenuSectionRootProps, MenuSectionRootProps as MenuSectionProps } from "./menu-section.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { menuSectionVariants } from "../../../styles/src/components/menu-section/index.ts";

export type { MenuSectionVariants } from "../../../styles/src/components/menu-section/index.ts";
