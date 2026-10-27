// Rivet addition (no HeroUI v3.2.6 counterpart): list row card; feature set inspired by HeroUI Pro's public Item Card docs,
// independent implementation (see `item-card.tsx`).
import { ItemCardAction, ItemCardContent, ItemCardDescription, ItemCardIcon, ItemCardRoot, ItemCardTitle } from "./item-card.tsx";
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
export { ItemCardRoot, ItemCardIcon, ItemCardContent, ItemCardTitle, ItemCardDescription, ItemCardAction } from "./item-card.tsx";
export type { ItemCardRootProps, ItemCardRootProps as ItemCardProps, ItemCardPartProps, ItemCardTextProps } from "./item-card.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { itemCardVariants } from "../../../styles/src/components/item-card/index.ts";

export type { ItemCardVariants } from "../../../styles/src/components/item-card/index.ts";
