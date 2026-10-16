// Ported from HeroUI v3.2.6 packages/react/src/components/pagination/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof PaginationX>` → the default-element prop types (`PaginationRootNavProps`, …); `@heroui/styles` →
// vendored `styles/`.
import type {
  PaginationContentUlProps,
  PaginationEllipsisSpanProps,
  PaginationItemLiProps,
  PaginationLinkProps,
  PaginationNextIconSpanProps,
  PaginationNextProps,
  PaginationPreviousIconSpanProps,
  PaginationPreviousProps,
  PaginationRootNavProps,
  PaginationSummaryDivProps,
} from "./pagination.tsx";
import {
  paginationRange,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationNextIcon,
  PaginationPrevious,
  PaginationPreviousIcon,
  PaginationRoot,
  PaginationSummary,
} from "./pagination.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Pagination = Object.assign(PaginationRoot, {
  Content: PaginationContent,
  Ellipsis: PaginationEllipsis,
  Item: PaginationItem,
  Link: PaginationLink,
  Next: PaginationNext,
  NextIcon: PaginationNextIcon,
  Previous: PaginationPrevious,
  PreviousIcon: PaginationPreviousIcon,
  Root: PaginationRoot,
  Summary: PaginationSummary,
});

export type Pagination = {
  ContentProps: PaginationContentUlProps;
  EllipsisProps: PaginationEllipsisSpanProps;
  ItemProps: PaginationItemLiProps;
  LinkProps: PaginationLinkProps;
  NextIconProps: PaginationNextIconSpanProps;
  NextProps: PaginationNextProps;
  PreviousIconProps: PaginationPreviousIconSpanProps;
  PreviousProps: PaginationPreviousProps;
  Props: PaginationRootNavProps;
  RootProps: PaginationRootNavProps;
  SummaryProps: PaginationSummaryDivProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  paginationRange,
  PaginationRoot,
  PaginationSummary,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationPreviousIcon,
  PaginationNext,
  PaginationNextIcon,
  PaginationEllipsis,
};

export type {
  PaginationRangeItem,
  PaginationRootProps,
  PaginationRootProps as PaginationProps,
  PaginationSummaryProps,
  PaginationContentProps,
  PaginationItemProps,
  PaginationLinkProps,
  PaginationPreviousProps,
  PaginationPreviousIconProps,
  PaginationNextProps,
  PaginationNextIconProps,
  PaginationEllipsisProps,
} from "./pagination.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { paginationVariants } from "../../../styles/src/components/pagination/index.ts";

export type { PaginationVariants } from "../../../styles/src/components/pagination/index.ts";
