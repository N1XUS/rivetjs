// Ported from HeroUI v3.2.6 packages/react/src/components/table/table.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components/Table` → `@rivetjs/cdk/table` (render props are accessors:
//   `({ sortDirection }) => sortDirection()`); `Collection` from `@rivetjs/cdk/collections/components`; `@heroui/styles` → vendored
//   `styles/`.
// - `TableContext` carries plain data `{ inTable, variant }` instead of the tv `slots` (functions do not serialize on resume): a
//   resumable token (`rv-ui-table`, same `{}` default); parts read the slots from a module-level memo (`slotsOf`), `undefined`
//   outside a `Table` (the part then gets only the caller's `class`, = upstream). Only the root's `base` slot depends on the
//   variant, so the parts' classes never change with it.
// - The root's element is created inside the provider (`content()` thunk: Rivet JSX builds nodes eagerly).
// - the composed class is a local (a plain value for the cdk part): a live `class` goes in as a render-prop function (`renderClass`).
// - `SortableColumnHeader`: `sortDirection` takes the value or the cdk render-prop accessor (`sortDirection={sortDirection}`);
//   default indicator = lucide `ChevronUp` (upstream inline svg) with the slot class, `data-direction` and `data-slot`; a custom
//   `indicator` is not cloned (no `cloneElement`): it renders inside a `span` that carries the slot class / `data-direction` /
//   `data-slot` (a function `indicator` is called with the direction).
// - Rivet (identity spec §4.2): auto form. A root with `columns` or an accessible name (`aria-label` / `aria-labelledby`)
//   renders `Table.ScrollContainer` > `Table.Content` itself (the cdk Table props given to the root go to the Content, `class`
//   stays on the root `div`); with `columns` + `items` it also renders the header (`Table.Column` per column, a
//   `Table.SortableColumnHeader` for `allowsSorting`) and the body (`children` = a row renderer `(item) => <Table.Row>…`, default
//   one `Table.Cell` per column with `item[column.id]`) and `footer` as a `Table.Footer`. The form is decided once at render
//   (`columns` / `items` stay live); the compound form is unchanged. No Virtualizer path (the cdk `TableLayout` is a cdk
//   Virtualizer layout; wiring it into `Table.Content` stays the `table-virtualization` example's explicit form).
import type {
  CellProps,
  ColumnProps,
  ColumnResizerProps,
  ResizableTableContainerProps,
  RowProps,
  TableBodyProps,
  TableHeaderProps,
  TableLoadMoreItemProps,
  TableProps,
} from "@rivetjs/cdk/table";
import {
  Cell as CellPrimitive,
  Column as ColumnPrimitive,
  ColumnResizer as ColumnResizerPrimitive,
  ResizableTableContainer as ResizableTableContainerPrimitive,
  Row as RowPrimitive,
  Table as TablePrimitive,
  TableBody as TableBodyPrimitive,
  TableHeader as TableHeaderPrimitive,
  TableLoadMoreItem as TableLoadMoreItemPrimitive,
} from "@rivetjs/cdk/table";
import { Collection as CollectionPrimitive } from "@rivetjs/cdk/collections/components";
import type { Key } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";
import { ChevronUp } from "lucide";
import { cx } from "tailwind-variants";

import type { TableVariants } from "../../../styles/src/components/table/index.ts";
import { tableVariants } from "../../../styles/src/components/table/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Table Context
 * -----------------------------------------------------------------------------------------------*/
interface TableContext {
  /** `true` inside a `Table` (the variant may be `undefined` = default). */
  inTable?: boolean;
  variant?: TableVariants["variant"];
}

const TableContext = resumableContext(createContext<TableContext>({}, { id: "rv-ui-table" }));

type TableSlots = ReturnType<typeof tableVariants>;
const SLOTS: Record<string, TableSlots> = {};
const slotsFor = (variant: TableVariants["variant"]): TableSlots => (SLOTS[variant ?? "default"] ??= tableVariants({ variant }));
/** Upstream `use(TableContext).slots`: `undefined` outside a `Table`. */
const slotsOf = (context: TableContext): TableSlots | undefined => (context.inTable ? slotsFor(context.variant) : undefined);

/** A cdk part's `class`: the composed string, or a render-prop function when the caller's `class` is live. */
type ClassOf = () => string | ((values: never) => string);
const liveClass = (local: object, classOf: ClassOf): unknown =>
  hasLiveProp(local, ["class"]) ? (values: unknown) => renderClass(classOf(), values) : classOf();

/* -------------------------------------------------------------------------------------------------
 * Table Root
 * -----------------------------------------------------------------------------------------------*/
/** Rivet auto form: one column of `Table` `columns`. */
interface TableColumnDef {
  id: Key;
  /** Header content. */
  name: Content;
  isRowHeader?: boolean;
  /** Renders a `Table.SortableColumnHeader` (sort with the root's `sortDescriptor` / `onSortChange`). */
  allowsSorting?: boolean;
  textValue?: string;
}

/** cdk Table props a root in the auto form passes to its `Table.Content`. */
const CONTENT_KEYS = [
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "selectionMode",
  "selectionBehavior",
  "selectedKeys",
  "defaultSelectedKeys",
  "onSelectionChange",
  "disallowEmptySelection",
  "disabledKeys",
  "disabledBehavior",
  "sortDescriptor",
  "onSortChange",
  "expandedKeys",
  "defaultExpandedKeys",
  "onExpandedChange",
  "treeColumn",
  "onRowAction",
  "onCellAction",
  "keyboardNavigationBehavior",
  "escapeKeyBehavior",
  "shouldSelectOnPressUp",
  "disallowTypeAhead",
] as const;
type TableAutoContentProps = Pick<TableProps, Exclude<(typeof CONTENT_KEYS)[number], "aria-label" | "aria-labelledby" | "aria-describedby">>;

interface TableRootBaseProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  class?: string;
  /** Visual variant. */
  variant?: TableVariants["variant"];
}

/** Compound form: the parts. */
interface TableCompoundProps<E extends keyof JSX.IntrinsicElements = "div"> extends TableRootBaseProps<E> {
  children?: Content;
}

/** Rivet auto form (decided once: `columns`, `aria-label` or `aria-labelledby` on the root): cdk Table props go to `Table.Content`. */
interface TableAutoBaseProps extends TableRootBaseProps, Partial<TableAutoContentProps> {
  /** `Table.Footer` content after the scroll container. */
  footer?: Content;
}

/** Auto form without data: an accessible name; `children` = the header + body. */
type TableNamedProps = TableAutoBaseProps & { columns?: undefined; items?: undefined; children?: Content } & (
    { "aria-label": string } | { "aria-labelledby": string }
  );

/** Auto form with data: `columns` + `items`. */
interface TableAutoProps<T extends object = object> extends TableAutoBaseProps {
  /** The columns (header + default cells). */
  columns: Iterable<TableColumnDef>;
  /** The rows (`Table.Body` `items`). */
  items?: Iterable<T>;
  /** Row renderer (`(item) => <Table.Row>…`); default: one `Table.Cell` per column with `item[column.id]`. */
  children?: (item: T) => Content;
}

type TableRootProps<E extends keyof JSX.IntrinsicElements = "div", T extends object = object> = TableCompoundProps<E> | TableNamedProps | TableAutoProps<T>;

type TableRootDivProps = (TableCompoundProps | TableNamedProps | TableAutoProps) &
  Omit<JSX.IntrinsicElements["div"], keyof TableAutoBaseProps | "children" | "columns" | "items">;
type DivRest = Omit<JSX.IntrinsicElements["div"], "children" | keyof TableAutoContentProps>;

// Separate signatures: the compound one generic over the element (as upstream), the data one over the row type; one
// signature generic over both (or carrying the cdk Table props) made TS give up on `<Table variant><Table.ScrollContainer>`
// ("union type that is too complex to represent", TS2590).
function TableRoot<T extends object = object>(props: TableAutoProps<T> & DivRest): JSX.Element;
function TableRoot<E extends keyof JSX.IntrinsicElements = "div">(props: TableCompoundProps<E> & JSX.IntrinsicElements[E]): JSX.Element;
function TableRoot(props: TableNamedProps & DivRest): JSX.Element;
function TableRoot(props: TableRootDivProps): JSX.Element {
  const [local, others] = splitLive(props as TableRootDivProps & { columns?: Iterable<TableColumnDef>; items?: Iterable<object>; footer?: Content }, [
    "children",
    "class",
    "columns",
    "footer",
    "items",
    "variant",
  ]);
  const auto = local.columns !== undefined || others["aria-label"] !== undefined || others["aria-labelledby"] !== undefined;
  const [contentProps, rest] = auto ? splitLive(others, CONTENT_KEYS as never) : [{}, others];
  const contextValue: TableContext = hasLiveProp(local, ["variant"])
    ? {
        inTable: true,
        get variant() {
          return local.variant;
        },
      }
    : { inTable: true, variant: local.variant };

  const children = local.children;
  const body = (): Content => {
    if (local.columns === undefined) return children as Content;
    const row =
      typeof children === "function" && !isSlot(children)
        ? (children as (item: object) => Content)
        : (item: object) => (
            <TableRow columns={local.columns}>
              {(column: TableColumnDef) => <TableCell>{(item as Record<PropertyKey, unknown>)[column.id] as Content}</TableCell>}
            </TableRow>
          );
    return (
      <>
        <TableHeader columns={local.columns}>
          {(column: TableColumnDef) => (
            // `children` as a prop: a ternary JSX child would compile to an accessor, not the render function.
            <TableColumn
              allowsSorting={column.allowsSorting}
              children={
                column.allowsSorting
                  ? ({ sortDirection }: { sortDirection: () => TableSortDirection | undefined }) => (
                      <TableSortableColumnHeader sortDirection={sortDirection}>{column.name}</TableSortableColumnHeader>
                    )
                  : column.name
              }
              id={column.id}
              isRowHeader={column.isRowHeader}
              textValue={column.textValue}
            />
          )}
        </TableHeader>
        <TableBody items={local.items as Iterable<object>}>{row}</TableBody>
      </>
    );
  };
  const content = () => (
    <dom.div class={slotsFor(local.variant).base({ class: local.class })} data-slot="table" {...(rest as JSX.IntrinsicElements["div"])}>
      {auto ? (
        <>
          <TableScrollContainer>
            <TableContent {...(contentProps as TableContentProps)}>{body()}</TableContent>
          </TableScrollContainer>
          {local.footer !== undefined && <TableFooter>{local.footer}</TableFooter>}
        </>
      ) : (
        (children as Content)
      )}
    </dom.div>
  );

  return (
    <Provider token={TableContext} value={contextValue}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Table Scroll Container
 * -----------------------------------------------------------------------------------------------*/
interface TableScrollContainerProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type TableScrollContainerDivProps = TableScrollContainerProps & Omit<JSX.IntrinsicElements["div"], keyof TableScrollContainerProps>;

const TableScrollContainer = <E extends keyof JSX.IntrinsicElements = "div">(props: TableScrollContainerProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as TableScrollContainerDivProps, ["class"]);
  const context = useContext(TableContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.scrollContainer, local.class)} data-slot="table-scroll-container" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Content
 * -----------------------------------------------------------------------------------------------*/
interface TableContentProps extends TableProps {}

const TableContent = (props: TableContentProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "keyboardNavigationBehavior"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.content()));

  return (
    <TablePrimitive
      class={cls as never}
      data-slot="table-content"
      keyboardNavigationBehavior={local.keyboardNavigationBehavior ?? "tab"}
      {...(rest as TableProps)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Table Header
 * -----------------------------------------------------------------------------------------------*/
interface TableHeaderPartProps<T extends object = object> extends TableHeaderProps<T> {}

const TableHeader = <T extends object = object>(props: TableHeaderPartProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as TableHeaderPartProps, ["class"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.header()));

  return <TableHeaderPrimitive class={cls as never} data-slot="table-header" {...(rest as TableHeaderProps<object>)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Column
 * -----------------------------------------------------------------------------------------------*/
interface TableColumnProps extends ColumnProps {}

const TableColumn = (props: TableColumnProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.column()));

  return <ColumnPrimitive class={cls as never} data-slot="table-column" {...(rest as ColumnProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Body
 * -----------------------------------------------------------------------------------------------*/
interface TableBodyPartProps<T extends object = object> extends TableBodyProps<T> {}

const TableBody = <T extends object = object>(props: TableBodyPartProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as TableBodyPartProps, ["class"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.body()));

  return <TableBodyPrimitive class={cls as never} data-slot="table-body" {...(rest as TableBodyProps<object>)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Row
 * -----------------------------------------------------------------------------------------------*/
interface TableRowProps<T extends object = object> extends RowProps<T> {}

const TableRow = <T extends object = object>(props: TableRowProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as TableRowProps, ["class"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.row()));

  return <RowPrimitive class={cls as never} data-slot="table-row" {...(rest as RowProps<object>)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Cell
 * -----------------------------------------------------------------------------------------------*/
interface TableCellProps extends CellProps {}

const TableCell = (props: TableCellProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.cell()));

  return <CellPrimitive class={cls as never} data-slot="table-cell" {...(rest as CellProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Footer
 * -----------------------------------------------------------------------------------------------*/
interface TableFooterProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type TableFooterDivProps = TableFooterProps & Omit<JSX.IntrinsicElements["div"], keyof TableFooterProps>;

const TableFooter = <E extends keyof JSX.IntrinsicElements = "div">(props: TableFooterProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as TableFooterDivProps, ["class"]);
  const context = useContext(TableContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.footer, local.class)} data-slot="table-footer" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Resizable Container
 * -----------------------------------------------------------------------------------------------*/
interface TableResizableContainerProps extends ResizableTableContainerProps {}

const TableResizableContainer = (props: TableResizableContainerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);

  return (
    <ResizableTableContainerPrimitive
      class={cx("table__resizable-container", local.class) ?? undefined}
      data-slot="table-resizable-container"
      {...(rest as ResizableTableContainerProps)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Table Column Resizer
 * -----------------------------------------------------------------------------------------------*/
interface TableColumnResizerProps extends ColumnResizerProps {}

const TableColumnResizer = (props: TableColumnResizerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(TableContext);
  const cls = liveClass(local, () => composeTwRenderProps(local.class as never, slotsOf(context)?.columnResizer()));

  return <ColumnResizerPrimitive class={cls as never} data-slot="table-column-resizer" {...(rest as ColumnResizerProps)} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Load More Item
 * -----------------------------------------------------------------------------------------------*/
interface TableLoadMoreItemPartProps extends TableLoadMoreItemProps {}

const TableLoadMoreItem = (props: TableLoadMoreItemPartProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const context = useContext(TableContext);

  return (
    <TableLoadMoreItemPrimitive
      class={composeSlotClassName(slotsOf(context)?.loadMore, local.class)}
      data-slot="table-load-more"
      {...(rest as TableLoadMoreItemProps)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * Table Load More Content
 * -----------------------------------------------------------------------------------------------*/
interface TableLoadMoreContentProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

type TableLoadMoreContentDivProps = TableLoadMoreContentProps & Omit<JSX.IntrinsicElements["div"], keyof TableLoadMoreContentProps>;

const TableLoadMoreContent = <E extends keyof JSX.IntrinsicElements = "div">(props: TableLoadMoreContentProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as TableLoadMoreContentDivProps, ["class"]);
  const context = useContext(TableContext);

  return <dom.div class={composeSlotClassName(slotsOf(context)?.loadMoreContent, local.class)} data-slot="table-load-more-content" {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Table Sortable Column Header
 * -----------------------------------------------------------------------------------------------*/
type TableSortDirection = "ascending" | "descending";

interface TableSortableColumnHeaderProps extends Omit<JSX.IntrinsicElements["span"], "children"> {
  /** Label content of the column header. */
  children?: Content;
  class?: string;
  /**
   * Current sort direction for the column. Pass the `sortDirection` received from `Table.Column`'s render-prop callback (the
   * accessor itself or its value).
   */
  sortDirection?: TableSortDirection | (() => TableSortDirection | undefined);
  /**
   * Whether to render the sort indicator icon when a direction is set.
   * @default true
   */
  showIndicator?: boolean;
  /**
   * Custom indicator content. When provided, overrides the default chevron. It renders inside a `span` with the indicator class,
   * `data-direction` and `data-slot`; a function receives the current direction.
   */
  indicator?: Content | ((direction: TableSortDirection) => Content);
}

const TableSortableColumnHeader = (props: TableSortableColumnHeaderProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "indicator", "showIndicator", "sortDirection"]);
  const context = useContext(TableContext);
  const direction = (): TableSortDirection | undefined => {
    const d = local.sortDirection;
    return typeof d === "function" ? d() : d;
  };
  const indicatorClass = () => slotsOf(context)?.sortableColumnIndicator();

  const indicator = () => {
    const d = direction();
    if (local.showIndicator === false || !d) return null;
    const custom = local.indicator;
    if (custom === undefined) {
      return <Icon icon={ChevronUp} size={16} class={indicatorClass()} data-direction={d} data-slot="table-sortable-column-indicator" />;
    }
    return (
      <span class={indicatorClass()} data-direction={d} data-slot="table-sortable-column-indicator">
        {typeof custom === "function" && !isSlot(custom) ? (custom as (direction: TableSortDirection) => Content)(d) : (custom as Content)}
      </span>
    );
  };

  return (
    <span
      class={composeSlotClassName(slotsOf(context)?.sortableColumnHeader, local.class)}
      data-direction={direction()}
      data-slot="table-sortable-column-header"
      {...rest}
    >
      {local.children}
      {indicator()}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
// Re-export Collection for dynamic cell rendering within rows. Users wrap their dynamic cells in <Table.Collection items={columns}>
// when they need to render additional static cells (e.g. checkbox, drag handle) alongside dynamic column-based cells.
const TableCollection = CollectionPrimitive;

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
  TableRootDivProps,
  TableScrollContainerProps,
  TableScrollContainerDivProps,
  TableContentProps,
  TableHeaderPartProps as TableHeaderProps,
  TableColumnProps,
  TableColumnResizerProps,
  TableBodyPartProps as TableBodyProps,
  TableRowProps,
  TableCellProps,
  TableFooterProps,
  TableFooterDivProps,
  TableLoadMoreItemPartProps as TableLoadMoreItemProps,
  TableLoadMoreContentProps,
  TableLoadMoreContentDivProps,
  TableResizableContainerProps,
  TableSortableColumnHeaderProps,
  TableSortDirection,
};
