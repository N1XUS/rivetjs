// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no item card). Feature set inspired by HeroUI Pro's public Item Card
// docs (a row with a leading icon, title + description and a trailing action such as a Switch or Select; five surface
// variants; pressable); independent implementation, Rivet-authored styles on HeroUI tokens.
// - `ItemCard` takes `render` (the `dom.div` contract): render an `<a>` / `<button>` for a pressable card (hover / pressed
//   tints + focus ring come from CSS on `a` / `button` / `[data-pressable]`).
// - Pure markup: no state, no script (a Switch / Select inside brings its own behaviour).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { ItemCardVariants } from "../../../styles/src/components/item-card/index.ts";
import { itemCardVariants } from "../../../styles/src/components/item-card/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = itemCardVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class"> & { class?: string };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

interface ItemCardRootProps extends DivProps, ItemCardVariants, DOMRenderProps<"div", undefined> {}

const ItemCardRoot = (props: ItemCardRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "variant"]);
  return <dom.div class={itemCardVariants({ variant: local.variant }).base({ class: local.class })} data-slot="item-card" {...rest} />;
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

export { ItemCardRoot, ItemCardIcon, ItemCardContent, ItemCardTitle, ItemCardDescription, ItemCardAction };
export type { ItemCardRootProps, DivProps as ItemCardPartProps, SpanProps as ItemCardTextProps };
