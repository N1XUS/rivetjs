// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 OSS has no data grid). Feature set inspired by HeroUI Pro's
// public DataGrid docs; independent implementation (no Pro source, styles or class names). tv() slots of @rivetjs/ui/data-grid in
// the vendored format: the table parts reuse the vendored `table*` classes (HeroUI OSS `table.css`), the grid-only parts are
// `data-grid*` BEM classes (`styles/components/data-grid.css`).
// Rivet: the stylesheets of the classes these slots compose (TWEAKS.md TW-122), in components/index.css order.
import "../../../out/table.css";
import "../../../out/data-grid.css";
import "../../../out/checkbox.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const dataGridVariants = tv({
  defaultVariants: {
    variant: "primary",
  },
  slots: {
    base: "table-root data-grid",
    body: "table__body",
    cell: "table__cell data-grid__cell",
    checkbox: "checkbox checkbox--primary data-grid__checkbox",
    column: "table__column data-grid__column",
    columnResizer: "table__column-resizer",
    content: "table__content data-grid__content",
    dragHandle: "data-grid__drag-handle",
    dropIndicator: "data-grid__drop-indicator",
    empty: "data-grid__empty",
    expandButton: "data-grid__expand",
    footer: "table__footer",
    header: "table__header",
    loadMore: "table__load-more",
    loadMoreContent: "table__load-more-content",
    row: "table__row data-grid__row",
    scrollContainer: "table__scroll-container data-grid__scroll-container",
    sortIndicator: "table__sortable-column-indicator data-grid__sort-indicator",
  },
  variants: {
    variant: {
      primary: {
        base: "table-root--primary",
      },
      secondary: {
        base: "table-root--secondary",
      },
    },
  },
});

export type DataGridVariants = VariantProps<typeof dataGridVariants>;
