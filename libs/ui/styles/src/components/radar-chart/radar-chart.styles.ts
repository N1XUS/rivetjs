// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no charts). Feature set inspired by HeroUI Pro's public
// Radar Chart docs; independent implementation. The shared chart rules (palette, legend, polar layers, tooltip) come from chart.css.
import "../../../out/chart.css";
import "../../../out/radar-chart.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const radarChartVariants = tv({
  slots: {
    base: "radar-chart",
    hit: "radar-chart__hit",
    shape: "radar-chart__shape",
    tick: "radar-chart__tick",
    vertex: "radar-chart__vertex",
  },
});

export type RadarChartVariants = VariantProps<typeof radarChartVariants>;
