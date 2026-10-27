// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public
// Radial Chart docs; independent implementation. The shared chart rules (palette, legend, polar layers, tooltip) come from chart.css.
import "../../../out/chart.css";
import "../../../out/radial-chart.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const radialChartVariants = tv({
  slots: {
    base: "radial-chart",
    track: "radial-chart__track",
  },
});

export type RadialChartVariants = VariantProps<typeof radialChartVariants>;
