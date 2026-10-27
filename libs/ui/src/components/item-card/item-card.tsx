// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no item card). Feature set inspired by HeroUI Pro's public Item Card
// docs (a row with a leading icon, title + description and a trailing action such as a Switch or Select; five surface
// variants; pressable); independent implementation, Rivet-authored styles on HeroUI tokens.
// - `ItemCard` takes `render` (the `dom.div` contract): render an `<a>` / `<button>` for a pressable card (hover / pressed
//   tints + focus ring come from CSS on `a` / `button` / `[data-pressable]`).
// - Pure markup: no state, no script (a Switch / Select inside brings its own behaviour).
// - `isCurrent` → `aria-current="true"` + `data-current` (value or accessor).
// - `ItemCard.Indicator` = a slot (user ruling 2026-10-27: "with slots instead of custom css and prop"): a layout-only `span`
//   holding any content (a Badge count, an icon); with no children it renders a `Status` dot. The caller renders it while
//   it applies (`{unread() ? <ItemCard.Indicator /> : null}`) and styles the emphasis itself (title class).
// - Inside an `ItemCardGroupCollection` (the interactive group) the card renders as a cdk `GridListItem` row
//   (`item-card-row.tsx`, registered through `item-card-collection.ts`: this module never imports the GridList): `id` is the
//   item key, `textValue` / `isDisabled` / `onAction` / `href` are row props, `render` is ignored.
import { useContext } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemCardVariants } from "../../../styles/src/components/item-card/index.ts";
import { itemCardVariants } from "../../../styles/src/components/item-card/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";
import { StatusRoot } from "../status/status.tsx";
import { ITEM_CARD_ROW, ItemCardCollectionContext } from "./item-card-collection.ts";

const SLOTS = itemCardVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

interface ItemCardRootProps extends DivProps, ItemCardVariants, DOMRenderProps<"div", undefined> {
  /** The open / playing / current item (value or accessor): `aria-current="true"` + `data-current`. */
  isCurrent?: boolean | (() => boolean);
  /** Collection mode (inside an `ItemCardGroupCollection`): typeahead / accessible text of the row. */
  textValue?: string;
  /** Collection mode: the row is disabled. */
  isDisabled?: boolean;
  /** Collection mode: the row's action (the group's `onAction` gets the key too). */
  onAction?: () => void;
  /** Collection mode: the row is a link (cdk GridListItem `href`). */
  href?: string;
}

// A value, an accessor or a live prop (read in the attribute expression, so the binding tracks it). Module level, no
// component-body closure: a card with no / literal flags stays plain server markup (no resume boundary).
const flag = (v: boolean | (() => boolean) | undefined): "true" | undefined => ((typeof v === "function" ? v() : v) ? "true" : undefined);

const ItemCardRoot = (props: ItemCardRootProps): JSX.Element => {
  // Collection mode: the row form, registered by `ItemCardGroupCollection` (this module never imports the GridList).
  const Row = useContext(ItemCardCollectionContext).inCollection ? ITEM_CARD_ROW.Row : undefined;
  if (Row) return <Row {...props} />;
  const [local, rest] = splitLive(props, ["class", "variant", "isCurrent", "textValue", "isDisabled", "onAction", "href"]);
  return (
    <dom.div
      class={itemCardVariants({ variant: local.variant }).base({ class: local.class })}
      data-slot="item-card"
      aria-current={flag(local.isCurrent) as never}
      data-current={flag(local.isCurrent) as never}
      {...rest}
    />
  );
};

const divPart =
  (slot: "icon" | "content" | "action", dataSlot: string) =>
  (props: DivProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <div class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </div>
    );
  };

const spanPart =
  (slot: "title" | "description", dataSlot: string) =>
  (props: SpanProps): JSX.Element => {
    const [local, rest] = splitLive(props, ["children", "class"]);
    return (
      <span class={composeSlotClassName(SLOTS[slot], local.class)} data-slot={dataSlot} {...rest}>
        {local.children}
      </span>
    );
  };

const ItemCardIcon = divPart("icon", "item-card-icon");
const ItemCardContent = divPart("content", "item-card-content");
const ItemCardAction = divPart("action", "item-card-action");
const ItemCardTitle = spanPart("title", "item-card-title");
const ItemCardDescription = spanPart("description", "item-card-description");
/**
 * The indicator slot (unread, new, a count): any content in the indicator position, a `Status` dot (accent) without
 * children. Render it only while it applies; name a dot or icon with `aria-label` (e.g. "Unread": `role="img"`).
 */
const ItemCardIndicator = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span class={composeSlotClassName(SLOTS.indicator, local.class)} data-slot="item-card-indicator" role={rest["aria-label"] ? "img" : undefined} {...rest}>
      {local.children ?? <StatusRoot color="accent" />}
    </span>
  );
};

export { ItemCardRoot, ItemCardIcon, ItemCardContent, ItemCardTitle, ItemCardDescription, ItemCardAction, ItemCardIndicator };
export type { ItemCardRootProps, DivProps as ItemCardPartProps, SpanProps as ItemCardTextProps };
