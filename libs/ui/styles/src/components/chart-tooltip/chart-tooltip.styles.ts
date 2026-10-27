// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public
// Chart Tooltip docs (`.chart-tooltip__*` parts, dot / line indicators); independent implementation.
import "../../../out/chart-tooltip.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chartTooltipVariants = tv({
  slots: {
    base: "chart-tooltip",
    header: "chart-tooltip__header",
    indicator: "chart-tooltip__indicator",
    item: "chart-tooltip__item",
    label: "chart-tooltip__label",
    value: "chart-tooltip__value",
  },
});

export type ChartTooltipVariants = VariantProps<typeof chartTooltipVariants>;
