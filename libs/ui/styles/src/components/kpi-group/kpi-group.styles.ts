// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no KPI group). Feature set inspired by HeroUI Pro's
// public KPI Group docs (KPI cards on one shared surface, horizontal / vertical, separators); independent implementation on
// HeroUI tokens.
import "../../../out/kpi.css";
import "../../../out/kpi-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const kpiGroupVariants = tv({
  defaultVariants: {
    orientation: "horizontal",
  },
  slots: {
    base: "kpi-group",
    separator: "kpi-group__separator",
  },
  variants: {
    orientation: {
      horizontal: {base: "kpi-group--horizontal"},
      vertical: {base: "kpi-group--vertical"},
    },
  },
});

export type KpiGroupVariants = VariantProps<typeof kpiGroupVariants>;
