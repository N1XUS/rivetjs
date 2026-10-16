// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no rating). Feature set inspired by HeroUI Pro's public
// Rating docs (sizes, read-only, fractional values); independent implementation on HeroUI tokens.
import "../../../out/rating.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const ratingVariants = tv({
  defaultVariants: {
    isReadOnly: false,
    size: "md",
  },
  slots: {
    base: "rating",
    fill: "rating__fill",
    item: "rating__item",
    star: "rating__star",
    value: "rating__value",
  },
  variants: {
    isReadOnly: {
      false: {},
      true: {base: "rating--readonly"},
    },
    size: {
      lg: {base: "rating--lg"},
      md: {base: "rating--md"},
      sm: {base: "rating--sm"},
    },
  },
});

export type RatingVariants = VariantProps<typeof ratingVariants>;
