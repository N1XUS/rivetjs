// Rivet addition (no HeroUI v3.2.6 counterpart): key / value rows (order summaries, totals, specs).
// `@rivetjs/ui/description-list`: compound `DescriptionList.*`, named parts, prop types, `descriptionListVariants`.
import { DescriptionListDetails, DescriptionListItem, DescriptionListRoot, DescriptionListTerm } from "./description-list.tsx";
import type { DescriptionListDetailsProps, DescriptionListItemProps, DescriptionListRootProps, DescriptionListTermProps } from "./description-list.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DescriptionList = Object.assign(DescriptionListRoot, {
  Root: DescriptionListRoot,
  Item: DescriptionListItem,
  Term: DescriptionListTerm,
  Details: DescriptionListDetails,
});

export type DescriptionList = {
  Props: DescriptionListRootProps;
  RootProps: DescriptionListRootProps;
  ItemProps: DescriptionListItemProps;
  TermProps: DescriptionListTermProps;
  DetailsProps: DescriptionListDetailsProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { DescriptionListRoot, DescriptionListItem, DescriptionListTerm, DescriptionListDetails } from "./description-list.tsx";
export type {
  DescriptionListRootProps,
  DescriptionListRootProps as DescriptionListProps,
  DescriptionListItemProps,
  DescriptionListTermProps,
  DescriptionListDetailsProps,
} from "./description-list.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { descriptionListVariants } from "../../../styles/src/components/description-list/index.ts";

export type { DescriptionListVariants } from "../../../styles/src/components/description-list/index.ts";
