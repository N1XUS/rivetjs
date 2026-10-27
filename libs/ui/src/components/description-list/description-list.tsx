// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no description list). A `dl` of key / value rows for order
// summaries, totals and specs (Rivet-authored, SHOWCASE-2: the storefront's order summary / totals were hand-built rows).
// - `DescriptionList` = `dl`, `.Item` = `div` row (a `dl` may group a `dt` + `dd` pair in a `div`), `.Term` = `dt`,
//   `.Details` = `dd`. `.Item isEmphasized` = a total row (bold, term in the foreground colour).
// - Pure markup: no state, no script.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { descriptionListVariants } from "../../../styles/src/components/description-list/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = descriptionListVariants();
const EMPHASIZED = descriptionListVariants({ isEmphasized: true });

type Props<E extends keyof JSX.IntrinsicElements> = Omit<JSX.IntrinsicElements[E], "class"> & { class?: string };

type DescriptionListRootProps = Props<"dl">;

const DescriptionListRoot = (props: DescriptionListRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <dl class={composeSlotClassName(SLOTS.base, local.class)} data-slot="description-list" {...rest}>
      {local.children}
    </dl>
  );
};

interface DescriptionListItemProps extends Props<"div"> {
  /** A total row: bold, the term in the foreground colour. */
  isEmphasized?: boolean;
}

const DescriptionListItem = (props: DescriptionListItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isEmphasized"]);
  return (
    <div
      class={composeSlotClassName((local.isEmphasized ? EMPHASIZED : SLOTS).item, local.class)}
      data-slot="description-list-item"
      data-emphasized={local.isEmphasized ? "" : undefined}
      {...rest}
    >
      {local.children}
    </div>
  );
};

const DescriptionListTerm = (props: Props<"dt">): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <dt class={composeSlotClassName(SLOTS.term, local.class)} data-slot="description-list-term" {...rest}>
      {local.children}
    </dt>
  );
};

const DescriptionListDetails = (props: Props<"dd">): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <dd class={composeSlotClassName(SLOTS.details, local.class)} data-slot="description-list-details" {...rest}>
      {local.children}
    </dd>
  );
};

export { DescriptionListRoot, DescriptionListItem, DescriptionListTerm, DescriptionListDetails };
export type { DescriptionListRootProps, DescriptionListItemProps };
export type DescriptionListTermProps = Props<"dt">;
export type DescriptionListDetailsProps = Props<"dd">;
