// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public
// Composed Chart docs; independent implementation. The shared chart rules (palette, legend, polar layers, tooltip) come from chart.css.
import "../../../out/chart.css";
import "../../../out/composed-chart.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const composedChartVariants = tv({
  slots: {
    base: "composed-chart",
    slot: "composed-chart__slot",
  },
});

export type ComposedChartVariants = VariantProps<typeof composedChartVariants>;
