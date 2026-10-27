// Rivet addition (no HeroUI v3.2.6 counterpart): single-column interactive list on `@rivetjs/cdk/grid-list`; feature set
// inspired by HeroUI Pro's public List View docs, independent implementation (see `list-view.tsx`).
import { ListViewDescription, ListViewEmptyState, ListViewItem, ListViewItemAction, ListViewItemContent, ListViewRoot, ListViewTitle } from "./list-view.tsx";
import type { ListViewDivProps, ListViewItemProps, ListViewRootProps, ListViewSpanProps } from "./list-view.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const ListView = Object.assign(ListViewRoot, {
  Root: ListViewRoot,
  Item: ListViewItem,
  ItemContent: ListViewItemContent,
  Title: ListViewTitle,
  Description: ListViewDescription,
  ItemAction: ListViewItemAction,
  EmptyState: ListViewEmptyState,
});

export type ListView = {
  Props: ListViewRootProps;
  RootProps: ListViewRootProps;
  ItemProps: ListViewItemProps;
  DivProps: ListViewDivProps;
  SpanProps: ListViewSpanProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { ListViewRoot, ListViewItem, ListViewItemContent, ListViewTitle, ListViewDescription, ListViewItemAction, ListViewEmptyState } from "./list-view.tsx";
export type { ListViewRootProps, ListViewRootProps as ListViewProps, ListViewItemProps, ListViewDivProps, ListViewSpanProps } from "./list-view.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { listViewVariants } from "../../../styles/src/components/list-view/index.ts";

export type { ListViewVariants } from "../../../styles/src/components/list-view/index.ts";
