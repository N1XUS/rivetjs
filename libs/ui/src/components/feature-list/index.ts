// Rivet addition (no HeroUI v3.2.6 counterpart): perks / plan features with a leading icon.
// `@rivetjs/ui/feature-list`: compound `FeatureList.*`, named parts, prop types, `featureListVariants`.
import { FeatureListItem, FeatureListRoot } from "./feature-list.tsx";
import type { FeatureListItemProps, FeatureListRootProps } from "./feature-list.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const FeatureList = Object.assign(FeatureListRoot, {
  Root: FeatureListRoot,
  Item: FeatureListItem,
});

export type FeatureList = {
  Props: FeatureListRootProps;
  RootProps: FeatureListRootProps;
  ItemProps: FeatureListItemProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { FeatureListRoot, FeatureListItem } from "./feature-list.tsx";
export type { FeatureListRootProps, FeatureListRootProps as FeatureListProps, FeatureListItemProps } from "./feature-list.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { featureListVariants } from "../../../styles/src/components/feature-list/index.ts";

export type { FeatureListVariants } from "../../../styles/src/components/feature-list/index.ts";
