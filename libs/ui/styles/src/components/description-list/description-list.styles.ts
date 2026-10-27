// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no description list): key / value rows (order
// summaries, totals, specs) on HeroUI tokens.
import "../../../out/description-list.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const descriptionListVariants = tv({
  slots: {
    base: "description-list",
    details: "description-list__details",
    item: "description-list__item",
    term: "description-list__term",
  },
  variants: {
    isEmphasized: {
      true: {item: "description-list__item--emphasized"},
    },
  },
});

export type DescriptionListVariants = VariantProps<typeof descriptionListVariants>;
