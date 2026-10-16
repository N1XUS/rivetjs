// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no text shimmer). Feature set inspired by HeroUI Pro's
// public TextShimmer docs; independent implementation on HeroUI tokens.
import "../../../out/text-shimmer.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const textShimmerVariants = tv({
  slots: {
    base: "text-shimmer",
  },
});

export type TextShimmerVariants = VariantProps<typeof textShimmerVariants>;
