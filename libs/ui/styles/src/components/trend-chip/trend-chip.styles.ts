// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no trend chip). Feature set inspired by HeroUI Pro's
// public TrendChip docs (trend up / down / neutral, sizes); independent implementation on HeroUI tokens.
import "../../../out/trend-chip.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const trendChipVariants = tv({
  defaultVariants: {
    size: "md",
    tone: "neutral",
    variant: "soft",
  },
  slots: {
    base: "trend-chip",
    icon: "trend-chip__icon",
  },
  variants: {
    size: {
      md: {base: "trend-chip--md"},
      sm: {base: "trend-chip--sm"},
    },
    tone: {
      negative: {base: "trend-chip--negative"},
      neutral: {base: "trend-chip--neutral"},
      positive: {base: "trend-chip--positive"},
    },
    variant: {
      ghost: {base: "trend-chip--ghost"},
      soft: {base: "trend-chip--soft"},
    },
  },
});

export type TrendChipVariants = VariantProps<typeof trendChipVariants>;
