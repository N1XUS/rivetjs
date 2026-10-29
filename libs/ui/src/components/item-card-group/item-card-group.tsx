// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no item card group). Feature set inspired by commercial UI kits' public Item
// Card Group docs (item cards as one divided list surface or a 2 / 3 column grid, optional section header, five surface
// variants); independent implementation, Rivet-authored styles on HeroUI tokens.
// - `layout="list"`: the group is the surface (its `variant`), the `ItemCard`s inside become transparent rows with hairline
//   dividers (CSS). `layout="grid"`: the cards keep their own variant; `columns` sets `--item-card-group-columns` (one
//   column below 40rem).
// - `role="group"`, labelled by its `ItemCardGroup.Title` when the caller gives the title an `id` and the group
//   `aria-labelledby` (no generated ids: pure markup, no state, no script).
// - The interactive form is `ItemCardGroupCollection` (`@rivetjs/ui/item-card-group-collection`, SHOWCASE-1 2026-10-27: cdk GridList,
//   roving focus, arrow keys, typeahead, selection, row actions), a separate export so this group stays markup-only and
//   never imports the GridList. Dev builds warn when this group gets a collection prop.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
import { itemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { DEV } from "#dev";

const SLOTS = itemCardGroupVariants();

interface ItemCardGroupStaticProps extends Omit<JSX.IntrinsicElements["div"], "class">, ItemCardGroupVariants {
  /** Grid columns (`layout="grid"`). @default 2 */
  columns?: 2 | 3 | 4;
  class?: string;
}

/** Markup-only group (`div role="group"`); the interactive form is `ItemCardGroupCollection`. */
type ItemCardGroupRootProps = ItemCardGroupStaticProps;

const ItemCardGroupRoot = (props: ItemCardGroupRootProps): JSX.Element => {
  if (DEV && ["selectionMode", "selectedKeys", "onSelectionChange", "onAction", "items", "renderEmptyState"].some((key) => key in props))
    console.warn("[rivet:ui] ItemCardGroup is markup only: use ItemCardGroupCollection for selection, onAction or items.");
  const [local, rest] = splitLive(props, ["children", "class", "layout", "variant", "columns"]);
  return (
    <div
      role="group"
      class={itemCardGroupVariants({ layout: local.layout, variant: local.variant }).base({ class: local.class })}
      data-slot="item-card-group"
      data-layout={local.layout ?? "list"}
      style={{ "--item-card-group-columns": local.columns === undefined ? undefined : String(local.columns) }}
      {...rest}
    >
      {local.children}
    </div>
  );
};

type DivProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string };
type HeadingProps = Omit<JSX.IntrinsicElements["h3"], "class"> & { class?: string };
type ParagraphProps = Omit<JSX.IntrinsicElements["p"], "class"> & { class?: string };

const ItemCardGroupHeader = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <div class={composeSlotClassName(SLOTS.header, local.class)} data-slot="item-card-group-header" {...rest}>
      {local.children}
    </div>
  );
};

const ItemCardGroupTitle = (props: HeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <h3 class={composeSlotClassName(SLOTS.title, local.class)} data-slot="item-card-group-title" {...rest}>
      {local.children}
    </h3>
  );
};

const ItemCardGroupDescription = (props: ParagraphProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <p class={composeSlotClassName(SLOTS.description, local.class)} data-slot="item-card-group-description" {...rest}>
      {local.children}
    </p>
  );
};

export { ItemCardGroupRoot, ItemCardGroupHeader, ItemCardGroupTitle, ItemCardGroupDescription };
export type {
  ItemCardGroupRootProps,
  ItemCardGroupStaticProps,
  DivProps as ItemCardGroupHeaderProps,
  HeadingProps as ItemCardGroupTitleProps,
  ParagraphProps as ItemCardGroupDescriptionProps,
};
