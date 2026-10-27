// Rivet addition (no HeroUI v3.2.6 counterpart): item cards as a list or grid; feature set inspired by HeroUI Pro's public
// Item Card Group docs, independent implementation (see `item-card-group.tsx`).
import { ItemCardGroupDescription, ItemCardGroupHeader, ItemCardGroupRoot, ItemCardGroupTitle } from "./item-card-group.tsx";
import type { ItemCardGroupDescriptionProps, ItemCardGroupHeaderProps, ItemCardGroupRootProps, ItemCardGroupTitleProps } from "./item-card-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ItemCardGroup = Object.assign(ItemCardGroupRoot, {
  Root: ItemCardGroupRoot,
  Header: ItemCardGroupHeader,
  Title: ItemCardGroupTitle,
  Description: ItemCardGroupDescription,
});

export type ItemCardGroup = {
  Props: ItemCardGroupRootProps;
  RootProps: ItemCardGroupRootProps;
  HeaderProps: ItemCardGroupHeaderProps;
  TitleProps: ItemCardGroupTitleProps;
  DescriptionProps: ItemCardGroupDescriptionProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ItemCardGroupRoot, ItemCardGroupHeader, ItemCardGroupTitle, ItemCardGroupDescription } from "./item-card-group.tsx";
export type {
  ItemCardGroupRootProps,
  ItemCardGroupRootProps as ItemCardGroupProps,
  ItemCardGroupStaticProps,
  ItemCardGroupHeaderProps,
  ItemCardGroupTitleProps,
  ItemCardGroupDescriptionProps,
} from "./item-card-group.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { itemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";

export type { ItemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
