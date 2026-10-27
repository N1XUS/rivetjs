// Rivet addition (no HeroUI v3.2.6 counterpart): an `ItemCard` inside an `ItemCardGroupCollection` (the interactive group,
// SHOWCASE-1 2026-10-27, user ruling: mail list = ItemCardGroup + ItemCard with optional collection behaviour) is a row of
// the group's cdk `GridList`: same `item-card*` classes and parts, GridList keyboard / selection / action behaviour.
// - Only the collection path imports the cdk grid list: a static group / card never reaches this module's code at
//   runtime (pure markup, 0 JS).
// - `ItemCardCollectionContext` (`item-card-collection.ts`) `{ inCollection: true }` is provided by the collection group; a
//   row resets it for its children (a card nested in a row's content is a plain card again).
// - `isCurrent` → `aria-current="true"` + `data-current` (value, accessor or live expression; the accessor is built in the
//   body so it resumes). Unread / new marks are content: the caller renders `ItemCard.Indicator` while they apply.
import { GridListItem as GridListItemPrimitive } from "@rivetjs/cdk/grid-list";
import type { GridListItemProps as GridListItemPrimitiveProps, GridListItemRenderProps } from "@rivetjs/cdk/grid-list";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemCardVariants } from "../../../styles/src/components/item-card/index.ts";
import { itemCardVariants } from "../../../styles/src/components/item-card/index.ts";
import { accessorIfLive, splitLive } from "../../utils/live.tsx";
import { ItemCardCollectionContext } from "./item-card-collection.ts";
import type { ItemCardCollectionContextValue } from "./item-card-collection.ts";

const NO_COLLECTION: ItemCardCollectionContextValue = {};

/** Row-only props of an `ItemCard` inside an `ItemCardGroupCollection` (the cdk `GridListItem` props). */
interface ItemCardRowProps<T extends object = object> extends Omit<GridListItemPrimitiveProps<T>, "class" | "children" | "render" | "style">, ItemCardVariants {
  class?: string;
  style?: GridListItemPrimitiveProps<T>["style"];
  /** The open / playing / current item (value or accessor): `aria-current="true"` + `data-current`. */
  isCurrent?: boolean | (() => boolean);
  children?: Content;
}

function ItemCardRow<T extends object>(props: ItemCardRowProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, ["class", "variant", "isCurrent", "children"]);
  // A live prop (`isCurrent={open() === id}`) arrives as a getter: read it through an accessor so the binding tracks it.
  const isCurrent = accessorIfLive(local, "isCurrent");
  // In the body: the accessor closes over component locals, so it resumes.
  const current =
    typeof isCurrent === "function"
      ? () => {
          const v: unknown = isCurrent();
          return (typeof v === "function" ? v() : v) ? "true" : undefined;
        }
      : isCurrent
        ? "true"
        : undefined;
  const cls = itemCardVariants({ variant: local.variant }).base({ class: local.class });
  const children = local.children;
  return (
    <GridListItemPrimitive
      data-slot="item-card"
      data-current={current as never}
      {...(rest as GridListItemPrimitiveProps<T>)}
      class={cls}
      render={(attrs: Record<string, any>) => <div {...attrs} aria-current={current as never} />}
    >
      {(_values: GridListItemRenderProps) => (
        <Provider token={ItemCardCollectionContext} value={NO_COLLECTION}>
          {children as never}
        </Provider>
      )}
    </GridListItemPrimitive>
  );
}

export { ItemCardRow };
export type { ItemCardRowProps };
