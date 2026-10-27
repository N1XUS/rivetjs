// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no item card group). Feature set inspired by HeroUI Pro's public Item
// Card Group docs (item cards as one divided list surface or a 2 / 3 column grid, optional section header, five surface
// variants); independent implementation, Rivet-authored styles on HeroUI tokens.
// - `layout="list"`: the group is the surface (its `variant`), the `ItemCard`s inside become transparent rows with hairline
//   dividers (CSS). `layout="grid"`: the cards keep their own variant; `columns` sets `--item-card-group-columns` (one
//   column below 40rem).
// - `role="group"`, labelled by its `ItemCardGroup.Title` when the caller gives the title an `id` and the group
//   `aria-labelledby` (no generated ids: pure markup, no state, no script).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
import { itemCardGroupVariants } from "../../../styles/src/components/item-card-group/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = itemCardGroupVariants();

interface ItemCardGroupRootProps extends Omit<JSX.IntrinsicElements["div"], "class">, ItemCardGroupVariants {
  /** Grid columns (`layout="grid"`). @default 2 */
  columns?: 2 | 3 | 4;
  class?: string;
}

const ItemCardGroupRoot = (props: ItemCardGroupRootProps): JSX.Element => {
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
  DivProps as ItemCardGroupHeaderProps,
  HeadingProps as ItemCardGroupTitleProps,
  ParagraphProps as ItemCardGroupDescriptionProps,
};
