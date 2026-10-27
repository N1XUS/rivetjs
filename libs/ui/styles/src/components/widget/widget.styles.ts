// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no dashboard widget). Feature set inspired by HeroUI
// Pro's public Widget docs (tinted shell, header with title / description / legend, raised content area, footer);
// independent implementation on HeroUI tokens.
import "../../../out/widget.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const widgetVariants = tv({
  slots: {
    base: "widget",
    content: "widget__content",
    description: "widget__description",
    footer: "widget__footer",
    header: "widget__header",
    legend: "widget__legend",
    legendItem: "widget__legend-item",
    legendItemDot: "widget__legend-item-dot",
    legendItemLabel: "widget__legend-item-label",
    title: "widget__title",
  },
});

export type WidgetVariants = VariantProps<typeof widgetVariants>;
