// Rivet addition (no HeroUI v3.2.6 counterpart): list row card; feature set inspired by HeroUI Pro's public Item Card docs,
// independent implementation (see `item-card.tsx`).
import { ItemCardAction, ItemCardContent, ItemCardDescription, ItemCardIcon, ItemCardIndicator, ItemCardRoot, ItemCardTitle } from "./item-card.tsx";
import type { ItemCardPartProps, ItemCardRootProps, ItemCardTextProps } from "./item-card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ItemCard = Object.assign(ItemCardRoot, {
  Root: ItemCardRoot,
  Icon: ItemCardIcon,
  Content: ItemCardContent,
  Title: ItemCardTitle,
  Description: ItemCardDescription,
  Action: ItemCardAction,
  Indicator: ItemCardIndicator,
});

export type ItemCard = {
  Props: ItemCardRootProps;
  RootProps: ItemCardRootProps;
  PartProps: ItemCardPartProps;
  TextProps: ItemCardTextProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ItemCardRoot, ItemCardIcon, ItemCardContent, ItemCardTitle, ItemCardDescription, ItemCardAction, ItemCardIndicator } from "./item-card.tsx";
export { ItemCardCollectionContext } from "./item-card-collection.ts";
export type { ItemCardRootProps, ItemCardRootProps as ItemCardProps, ItemCardPartProps, ItemCardTextProps } from "./item-card.tsx";
export type { ItemCardCollectionContextValue } from "./item-card-collection.ts";
export type { ItemCardRowProps } from "./item-card-row.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { itemCardVariants } from "../../../styles/src/components/item-card/index.ts";

export type { ItemCardVariants } from "../../../styles/src/components/item-card/index.ts";
