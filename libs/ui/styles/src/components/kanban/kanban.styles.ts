// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no kanban). Feature set inspired by HeroUI Pro's public
// Kanban docs (`.kanban__*` parts, sizes sm / md / lg); independent implementation.
import "../../../out/kanban.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const kanbanVariants = tv({
  defaultVariants: {
    size: "md",
  },
  slots: {
    base: "kanban",
    card: "kanban__card",
    cardContent: "kanban__card-content",
    cardGroup: "kanban__card-group",
    cardList: "kanban__card-list",
    column: "kanban__column",
    columnActions: "kanban__column-actions",
    columnBody: "kanban__column-body",
    columnCount: "kanban__column-count",
    columnHeader: "kanban__column-header",
    columnIndicator: "kanban__column-indicator",
    columnTitle: "kanban__column-title",
    dragHandle: "kanban__drag-handle",
    dropIndicator: "kanban__drop-indicator",
    empty: "kanban__empty",
    scrollShadow: "kanban__scroll-shadow",
  },
  variants: {
    size: {
      lg: {base: "kanban--lg"},
      md: {base: "kanban--md"},
      sm: {base: "kanban--sm"},
    },
  },
});

export type KanbanVariants = VariantProps<typeof kanbanVariants>;
