// Ported from HeroUI v3.2.6 packages/react/src/components/list-box-section/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → `ListBoxSectionRootProps`; `@heroui/styles` → vendored `styles/`.
import { ListBoxSectionRoot } from "./list-box-section.tsx";
import type { ListBoxSectionRootProps } from "./list-box-section.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ListBoxSection = ListBoxSectionRoot;

export type ListBoxSection = {
  Props: ListBoxSectionRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxSectionRoot };

export type { ListBoxSectionRootProps, ListBoxSectionRootProps as ListBoxSectionProps } from "./list-box-section.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { listboxSectionVariants } from "../../../styles/src/components/list-box-section/index.ts";

export type { ListBoxSectionVariants } from "../../../styles/src/components/list-box-section/index.ts";
