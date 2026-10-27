// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no trend chip). Feature set inspired by HeroUI Pro's
// public TrendChip docs (trend up / down / neutral, sizes, variants, prefix / suffix / indicator); independent
// implementation on HeroUI tokens.
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
    indicator: "trend-chip__indicator",
    prefix: "trend-chip__prefix",
    suffix: "trend-chip__suffix",
  },
  variants: {
    size: {
      lg: {base: "trend-chip--lg"},
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
      primary: {base: "trend-chip--primary"},
      secondary: {base: "trend-chip--secondary"},
      soft: {base: "trend-chip--soft"},
      tertiary: {base: "trend-chip--tertiary"},
    },
  },
});

export type TrendChipVariants = VariantProps<typeof trendChipVariants>;
