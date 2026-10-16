// Ported from HeroUI v3.2.6 packages/react/src/components/list-box-item/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { ListBoxItemIndicator, ListBoxItemRoot } from "./list-box-item.tsx";
import type { ListBoxItemIndicatorSpanProps, ListBoxItemRootProps } from "./list-box-item.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ListBoxItem = Object.assign(ListBoxItemRoot, {
  Root: ListBoxItemRoot,
  Indicator: ListBoxItemIndicator,
});

export type ListBoxItem = {
  Props: ListBoxItemRootProps;
  RootProps: ListBoxItemRootProps;
  IndicatorProps: ListBoxItemIndicatorSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ListBoxItemRoot, ListBoxItemIndicator };

export type { ListBoxItemRootProps, ListBoxItemRootProps as ListBoxItemProps, ListBoxItemIndicatorProps } from "./list-box-item.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { listboxItemVariants } from "../../../styles/src/components/list-box-item/index.ts";
export type { ListBoxItemVariants } from "../../../styles/src/components/list-box-item/index.ts";
