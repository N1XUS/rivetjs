// Rivet addition (no HeroUI v3.2.6 counterpart): `ItemCardGroupCollection`, the interactive item card group (SHOWCASE-1
// 2026-10-27, user ruling: optional collection behaviour on the cdk GridList — same keyboard / a11y as cdk, not a
// reinterpretation). Its own export (not a prop switch of `ItemCardGroup`): the static group and `ItemCard` never import the
// GridList (measured +41 KB gz on item-card-group-list / -notification-preferences when one component dispatched).
// - Root = cdk `GridList` (`layout` "list" → GridList `stack`, "grid" → GridList `grid`: 2-D arrow keys) with the group's
//   `item-card-group*` classes; every cdk GridList prop passes through (`selectionMode`, `selectedKeys` value / Signal,
//   `onSelectionChange`, `selectionBehavior`, `disallowEmptySelection`, `disabledKeys`, `onAction`, `items` + function
//   child, `renderEmptyState`, `escapeKeyBehavior`, `autoFocus`, …).
// - Provides `ItemCardCollectionContext` `{ inCollection: true }` (plain data) and registers the row form
//   (`ITEM_CARD_ROW.Row = ItemCardRow`, in the body: before any row renders): every `ItemCard` inside renders as a
//   GridList row (`../item-card/item-card-row.tsx`). Rows carry `data-selected` / `data-focused` / `data-focus-visible` /
//   `data-disabled` (cdk) + `data-current` / `data-unread` (ItemCard); CSS `item-card-group.css` styles them.
// - No selection checkbox is added (a ui `Checkbox slot="selection"` placed in the card gets the row's state, cdk
//   GridListItem slot); `ItemCardGroup.Header` belongs outside (a grid has only rows): label with `aria-label` /
//   `aria-labelledby`.
import { GridList as GridListPrimitive } from "@rivetjs/cdk/grid-list";
import type { GridListProps as GridListPrimitiveProps } from "@rivetjs/cdk/grid-list";
import { Provider } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
import { itemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
import { splitLive } from "../../utils/live.tsx";
import { ITEM_CARD_ROW, ItemCardCollectionContext } from "../item-card/item-card-collection.ts";
import type { ItemCardCollectionContextValue } from "../item-card/item-card-collection.ts";
import { ItemCardRow } from "../item-card/item-card-row.tsx";

const IN_COLLECTION: ItemCardCollectionContextValue = { inCollection: true };

interface ItemCardGroupCollectionProps<T extends object = object> extends Omit<GridListPrimitiveProps<T>, "layout" | "class" | "style">, ItemCardGroupVariants {
  /** Grid columns (`layout="grid"`). @default 2 */
  columns?: 2 | 3 | 4;
  class?: string;
}

/** The interactive item card group: a cdk GridList whose `ItemCard`s are rows (selection, arrow keys, typeahead, row actions). */
function ItemCardGroupCollection<T extends object>(props: ItemCardGroupCollectionProps<T>): JSX.Element {
  ITEM_CARD_ROW.Row = ItemCardRow;
  const [local, rest] = splitLive(props, ["class", "layout", "variant", "columns"]);
  const layout = local.layout ?? "list";
  const cls = itemCardGroupVariants({ layout, variant: local.variant }).base({ class: local.class });
  const columns = local.columns;
  return (
    <Provider token={ItemCardCollectionContext} value={IN_COLLECTION}>
      {() => (
        <GridListPrimitive
          data-slot="item-card-group"
          data-layout={layout}
          {...(rest as GridListPrimitiveProps<T>)}
          layout={layout === "grid" ? "grid" : "stack"}
          class={cls}
          style={columns === undefined ? undefined : { "--item-card-group-columns": String(columns) }}
        />
      )}
    </Provider>
  );
}

export { ItemCardGroupCollection };
export type { ItemCardGroupCollectionProps };
