// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 and HeroUI Pro have no masonry / bento). Masonry +
// Bento slots on HeroUI tokens (`components/masonry.css`).
import "../../../out/masonry.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const masonryVariants = tv({
  slots: {
    base: "masonry",
    empty: "masonry__empty",
    grid: "masonry__grid",
    item: "masonry__item",
    loader: "masonry__loader",
  },
});

export const bentoVariants = tv({
  slots: {
    base: "bento",
    empty: "bento__empty",
    grid: "bento__grid",
    item: "bento__item",
    loader: "bento__loader",
  },
});

export type MasonryVariants = VariantProps<typeof masonryVariants>;
export type BentoVariants = VariantProps<typeof bentoVariants>;
