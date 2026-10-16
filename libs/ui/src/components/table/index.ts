// Ported from HeroUI v3.2.6 packages/react/src/components/table/index.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `ComponentProps<typeof TableX>` → the parts' prop types (default-element types for the generic dom parts);
// `@heroui/styles` → vendored `styles/`.
import type {
  TableBodyProps,
  TableCellProps,
  TableColumnDef,
  TableColumnProps,
  TableColumnResizerProps,
  TableContentProps,
  TableFooterDivProps,
  TableHeaderProps,
  TableLoadMoreContentDivProps,
  TableLoadMoreItemProps,
  TableResizableContainerProps,
  TableRootDivProps,
  TableRowProps,
  TableScrollContainerDivProps,
  TableSortableColumnHeaderProps,
} from "./table.tsx";
import {
  TableBody,
  TableCell,
  TableCollection,
  TableColumn,
  TableColumnResizer,
  TableContent,
  TableFooter,
  TableHeader,
  TableLoadMoreContent,
  TableLoadMoreItem,
  TableResizableContainer,
  TableRoot,
  TableRow,
  TableScrollContainer,
  TableSortableColumnHeader,
} from "./table.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Table = Object.assign(TableRoot, {
  Body: TableBody,
  Cell: TableCell,
  Collection: TableCollection,
  Column: TableColumn,
  ColumnResizer: TableColumnResizer,
  Content: TableContent,
  Footer: TableFooter,
  Header: TableHeader,
  LoadMore: TableLoadMoreItem,
  LoadMoreContent: TableLoadMoreContent,
  ResizableContainer: TableResizableContainer,
  Root: TableRoot,
  Row: TableRow,
  ScrollContainer: TableScrollContainer,
  SortableColumnHeader: TableSortableColumnHeader,
});

export type Table = {
  Props: TableRootDivProps;
  RootProps: TableRootDivProps;
  ScrollContainerProps: TableScrollContainerDivProps;
  ContentProps: TableContentProps;
  HeaderProps: TableHeaderProps;
  ColumnProps: TableColumnProps;
  /** Rivet auto form: one entry of the root's `columns`. */
  ColumnDef: TableColumnDef;
  ColumnResizerProps: TableColumnResizerProps;
  BodyProps: TableBodyProps;
  RowProps: TableRowProps;
  CellProps: TableCellProps;
  FooterProps: TableFooterDivProps;
  LoadMoreProps: TableLoadMoreItemProps;
  LoadMoreContentProps: TableLoadMoreContentDivProps;
  ResizableContainerProps: TableResizableContainerProps;
  SortableColumnHeaderProps: TableSortableColumnHeaderProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  TableRoot,
  TableScrollContainer,
  TableContent,
  TableHeader,
  TableColumn,
  TableColumnResizer,
  TableBody,
  TableRow,
  TableCell,
  TableFooter,
  TableCollection,
  TableLoadMoreItem,
  TableLoadMoreContent,
  TableResizableContainer,
  TableSortableColumnHeader,
};

export type {
  TableColumnDef,
  TableRootProps,
  TableRootProps as TableProps,
  TableScrollContainerProps,
  TableContentProps,
  TableHeaderProps,
  TableColumnProps,
  TableColumnResizerProps,
  TableBodyProps,
  TableRowProps,
  TableCellProps,
  TableFooterProps,
  TableLoadMoreItemProps,
  TableLoadMoreContentProps,
  TableResizableContainerProps,
  TableSortableColumnHeaderProps,
  TableSortDirection,
} from "./table.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { tableVariants } from "../../../styles/src/components/table/index.ts";

export type { TableVariants } from "../../../styles/src/components/table/index.ts";
