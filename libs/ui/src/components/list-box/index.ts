// Ported from HeroUI v3.2.6 packages/react/src/components/list-box/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { ListBoxItem, ListBoxItemIndicator } from "../list-box-item/index.ts";
import type { ListBoxItemRootProps } from "../list-box-item/index.ts";
import { ListBoxSection } from "../list-box-section/index.ts";
import type { ListBoxSectionRootProps } from "../list-box-section/index.ts";
import { ListBoxRoot } from "./list-box.tsx";
import type { ListBoxRootProps } from "./list-box.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ListBox = Object.assign(ListBoxRoot, {
  Root: ListBoxRoot,
  Item: ListBoxItem,
  ItemIndicator: ListBoxItemIndicator,
  Section: ListBoxSection,
});

export type ListBox = {
  Props: ListBoxRootProps;
  RootProps: ListBoxRootProps;
  ItemProps: ListBoxItemRootProps;
  SectionProps: ListBoxSectionRootProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxRoot };

export type { ListBoxRootProps, ListBoxRootProps as ListBoxProps } from "./list-box.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { listboxVariants } from "../../../styles/src/components/list-box/index.ts";

export type { ListBoxVariants } from "../../../styles/src/components/list-box/index.ts";
