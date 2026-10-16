// Rivet addition (no HeroUI v3.2.6 counterpart): iOS context-menu style item preview — a list item lifts into a panel on a long
// press / right click / Shift+F10 (see `item-morph.tsx`; behaviour `@rivetjs/cdk/morph/item`).
import { ItemMorphClose, ItemMorphRoot } from "./item-morph.tsx";
import type { ItemMorphCloseProps, ItemMorphRootProps } from "./item-morph.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ItemMorph = Object.assign(ItemMorphRoot, {
  Root: ItemMorphRoot,
  Close: ItemMorphClose,
});

export type ItemMorph = {
  Props: ItemMorphRootProps;
  RootProps: ItemMorphRootProps;
  CloseProps: ItemMorphCloseProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ItemMorphRoot, ItemMorphClose, ItemMorphContext, useItemMorph, useItemMorphPanel } from "./item-morph.tsx";
export type { ItemMorphRootProps, ItemMorphRootProps as ItemMorphProps, ItemMorphCloseProps, UseItemMorphPanelReturn } from "./item-morph.tsx";
export { itemMorphProps, openItemMorph, closeItemMorph, isItemMorphOpen, ITEM_MORPH_THRESHOLD } from "@rivetjs/cdk/morph/item";
export type { ItemMorphOptions, ItemMorphTrigger, ItemMorph as ItemMorphState } from "@rivetjs/cdk/morph/item";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { itemMorphVariants } from "../../../styles/src/components/item-morph/index.ts";

export type { ItemMorphVariants } from "../../../styles/src/components/item-morph/index.ts";
