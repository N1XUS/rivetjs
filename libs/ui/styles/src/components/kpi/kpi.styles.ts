// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no KPI). Feature set inspired by HeroUI Pro's public
// KPI docs (title, icon, formatted value, trend, chart, footer); independent implementation on HeroUI tokens.
import "../../../out/kpi.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const kpiVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    actions: "kpi__actions",
    base: "kpi",
    body: "kpi__body",
    chart: "kpi__chart",
    content: "kpi__content",
    description: "kpi__description",
    footer: "kpi__footer",
    header: "kpi__header",
    icon: "kpi__icon",
    progress: "kpi__progress",
    progressBar: "kpi__progress-bar",
    separator: "kpi__separator",
    title: "kpi__title",
    value: "kpi__value",
  },
  variants: {
    variant: {
      default: {base: "kpi--default"},
      secondary: {base: "kpi--secondary"},
      transparent: {base: "kpi--transparent"},
    },
  },
});

export type KpiVariants = VariantProps<typeof kpiVariants>;
