// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 and HeroUI Pro have no masonry / bento grid). Masonry (Pinterest
// columns) and Bento (span tiles) in the HeroUI visual language: rounded item surfaces, accent focus ring, selected
// ring, loader + empty state slots; Rivet-authored styles on HeroUI tokens (`styles/components/masonry.css`).
// - Behaviour, placement and resumability = `@rivetjs/cdk/masonry` (server-exact inline CSS, measured / virtualized
//   modes, RA GridList keys + selection): each component here is the cdk component with the BEM classes of its slots.
// - Data-driven like the cdk: `items` + a render function child; put any ui component (Card, image, …) in it.
import {
  Bento as CdkBento,
  Masonry as CdkMasonry,
  type BentoProps as CdkBentoProps,
  type MasonryItemState,
  type MasonryProps as CdkMasonryProps,
} from "@rivetjs/cdk/masonry";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { bentoVariants, masonryVariants } from "../../../styles/src/components/masonry/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

/** Module-level slots (tv slot functions are pure; no variants). */
const masonrySlots = masonryVariants();
const bentoSlots = bentoVariants();

type ItemClass = string | ((state: MasonryItemState) => string | undefined) | undefined;

type SlotFn = (options?: { class?: string | undefined }) => string;

// @rivet-class-join itemClassOf(1)
/** The item slot class merged with the user's `itemClass` (string, or a per-item function → one per item). */
function itemClassOf(slot: SlotFn, user: ItemClass): ItemClass {
  if (typeof user !== "function") return composeSlotClassName(slot, user);
  const compose = { fn: (state: MasonryItemState) => slot({ class: user(state) }) };
  return compose.fn;
}

const CLASS_KEYS = ["class", "gridClass", "itemClass", "loaderClass", "emptyClass"] as const;

/* -------------------------------------------------------------------------------------------------
 * Masonry
 * -----------------------------------------------------------------------------------------------*/
type MasonryProps<T> = CdkMasonryProps<T>;

function Masonry<T>(props: MasonryProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, CLASS_KEYS);
  return (
    <CdkMasonry
      data-slot="masonry"
      {...(rest as CdkMasonryProps<T>)}
      class={composeSlotClassName(masonrySlots.base, local.class)}
      gridClass={composeSlotClassName(masonrySlots.grid, local.gridClass)}
      itemClass={itemClassOf(masonrySlots.item, local.itemClass)}
      loaderClass={composeSlotClassName(masonrySlots.loader, local.loaderClass)}
      emptyClass={composeSlotClassName(masonrySlots.empty, local.emptyClass)}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * Bento
 * -----------------------------------------------------------------------------------------------*/
type BentoProps<T> = CdkBentoProps<T>;

function Bento<T>(props: BentoProps<T>): JSX.Element {
  const [local, rest] = splitLive(props, CLASS_KEYS);
  return (
    <CdkBento
      data-slot="bento"
      {...(rest as CdkBentoProps<T>)}
      class={composeSlotClassName(bentoSlots.base, local.class)}
      gridClass={composeSlotClassName(bentoSlots.grid, local.gridClass)}
      itemClass={itemClassOf(bentoSlots.item, local.itemClass)}
      loaderClass={composeSlotClassName(bentoSlots.loader, local.loaderClass)}
      emptyClass={composeSlotClassName(bentoSlots.empty, local.emptyClass)}
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { Masonry, Bento };
export type { MasonryProps, BentoProps };
