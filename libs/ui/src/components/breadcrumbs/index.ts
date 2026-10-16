// Ported from HeroUI v3.2.6 packages/react/src/components/breadcrumbs/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof X>` → the part prop types; `@heroui/styles` → vendored `styles/`.
import { BreadcrumbsItem, BreadcrumbsRoot } from "./breadcrumbs.tsx";
import type { BreadcrumbsItemAllProps, BreadcrumbsRootProps } from "./breadcrumbs.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Breadcrumbs = Object.assign(BreadcrumbsRoot, {
  Root: BreadcrumbsRoot,
  Item: BreadcrumbsItem,
});

export type Breadcrumbs = {
  Props: BreadcrumbsRootProps;
  RootProps: BreadcrumbsRootProps;
  ItemProps: BreadcrumbsItemAllProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { BreadcrumbsRoot, BreadcrumbsItem };

export type {
  BreadcrumbsRootProps,
  BreadcrumbsRootProps as BreadcrumbsProps,
  BreadcrumbsItemData,
  BreadcrumbsItemProps,
  BreadcrumbsItemRenderProps,
  BreadcrumbsOverflowItem,
} from "./breadcrumbs.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { breadcrumbsVariants } from "../../../styles/src/components/breadcrumbs/index.ts";

export type { BreadcrumbsVariants } from "../../../styles/src/components/breadcrumbs/index.ts";
