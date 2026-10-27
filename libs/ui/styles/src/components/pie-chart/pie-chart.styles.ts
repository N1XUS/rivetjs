// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public
// Pie Chart docs; independent implementation. The shared chart rules (palette, legend, polar layers, tooltip) come from chart.css.
import "../../../out/chart.css";
import "../../../out/pie-chart.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const pieChartVariants = tv({
  slots: {
    base: "pie-chart",
    leader: "pie-chart__leader",
  },
});

export type PieChartVariants = VariantProps<typeof pieChartVariants>;
