// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no list view). Feature set inspired by commercial UI kits' public List View
// docs (a single-column interactive list on GridList: variants primary / secondary, selection modes with automatic
// selection checkboxes, disabledKeys, onAction, renderEmptyState, virtualized + rowHeight; parts `Item` / `ItemContent` /
// `Title` / `Description` / `ItemAction`; classes `.list-view*`); independent implementation, Rivet-authored styles.
// - Root = cdk `GridList` (`layout="stack"`); `virtualized` wraps it in a cdk `CollectionVirtualizer` with `ListLayout`
//   (`rowSize` = `rowHeight`, default 48; the list needs a fixed height, e.g. `class="h-80"`).
// - `Item` = cdk `GridListItem`; with selection on (`selectionMode` "single" / "multiple") it renders a ui `Checkbox
//   slot="selection"` in `.list-view__selection-cell` before its children (GridList fills the checkbox's state / labels).
// - `Title` / `Description` / `ItemContent` / `ItemAction` = plain markup; put buttons / menus in `ItemAction` (Tab moves
//   into them: GridList focus mode "row" + child focus).
import { GridList as GridListPrimitive, GridListItem as GridListItemPrimitive } from "@rivetjs/cdk/grid-list";
import type {
  GridListItemProps as GridListItemPrimitiveProps,
  GridListItemRenderProps,
  GridListProps as GridListPrimitiveProps,
  GridListRenderProps,
} from "@rivetjs/cdk/grid-list";
import { CollectionVirtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ListViewVariants } from "../../../styles/src/components/list-view/index.ts";
import { listViewVariants } from "../../../styles/src/components/list-view/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { CheckboxRoot } from "../checkbox/checkbox.tsx";

const SLOTS = listViewVariants();

/* -------------------------------------------------------------------------------------------------
 * ListView Root
 * -----------------------------------------------------------------------------------------------*/
interface ListViewRootProps<T extends object = object> extends Omit<GridListPrimitiveProps<T>, "layout">, ListViewVariants {
  /** Render only the rows in view (cdk CollectionVirtualizer + ListLayout). Give the list a fixed height. */
  virtualized?: boolean;
  /** Row height in px for virtualization. @default 48 */
  rowHeight?: number;
  /** Viewport size of the server-rendered window when virtualized. @default { width: 800, height: 600 } */
  initialSize?: { width: number; height: number };
}

function ListViewRoot<T extends object>(props: ListViewRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "variant", "virtualized", "rowHeight", "initialSize"]);
  const variant = local.variant ?? "primary";
  const cls = composeTwRenderProps(local.class as never, listViewVariants({ variant }).base()) as string | ((values: GridListRenderProps) => string);
  // Built inside the virtualizer's JSX (not hoisted into a const): the list reads the virtualizer's context when it renders.
  if (!local.virtualized) return <GridListPrimitive data-slot="list-view" data-variant={variant} {...(rest as object)} layout="stack" class={cls as never} />;
  return (
    <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowSize: local.rowHeight ?? 48 }} initialSize={local.initialSize}>
      <GridListPrimitive data-slot="list-view" data-variant={variant} {...(rest as object)} layout="stack" class={cls as never} />
    </CollectionVirtualizer>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ListView Item
 * -----------------------------------------------------------------------------------------------*/
type ListViewItemProps<T extends object = object> = GridListItemPrimitiveProps<T> & { children?: Content | ((values: GridListItemRenderProps) => Content) };

function ListViewItem<T extends object>(props: ListViewItemProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "children"]);
  const children = local.children;
  const cls = composeTwRenderProps(local.class as never, SLOTS.item()) as string | ((values: GridListItemRenderProps) => string);
  return (
    <GridListItemPrimitive data-slot="list-view-item" {...(rest as object)} class={cls as never}>
      {(values: GridListItemRenderProps) => (
        <>
          {values.selectionMode !== "none" ? (
            <span class={SLOTS.selectionCell()} data-slot="list-view-selection-cell">
              <CheckboxRoot slot="selection" />
            </span>
          ) : null}
          {typeof children === "function" ? (children as (values: GridListItemRenderProps) => Content)(values) : children}
        </>
      )}
    </GridListItemPrimitive>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ListView ItemContent / Title / Description / ItemAction
 * -----------------------------------------------------------------------------------------------*/
type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class" | "children"> & { class?: string; children?: Content };

const ListViewItemContent = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.itemContent, local.class)} data-slot="list-view-item-content" {...rest}>
      {local.children}
    </div>
  );
};

const ListViewTitle = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <span class={composeSlotClassName(SLOTS.title, local.class)} data-slot="list-view-title" {...rest}>
      {local.children}
    </span>
  );
};

const ListViewDescription = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <span class={composeSlotClassName(SLOTS.description, local.class)} data-slot="list-view-description" {...rest}>
      {local.children}
    </span>
  );
};

const ListViewItemAction = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.itemAction, local.class)} data-slot="list-view-item-action" {...rest}>
      {local.children}
    </div>
  );
};

/** Wrapper for `renderEmptyState` content (`.list-view__empty-state`). */
const ListViewEmptyState = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.emptyState, local.class)} data-slot="list-view-empty-state" {...rest}>
      {local.children}
    </div>
  );
};

export { ListViewRoot, ListViewItem, ListViewItemContent, ListViewTitle, ListViewDescription, ListViewItemAction, ListViewEmptyState };
export type { ListViewRootProps, ListViewItemProps, DivProps as ListViewDivProps, SpanProps as ListViewSpanProps };
