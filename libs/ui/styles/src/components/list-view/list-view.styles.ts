// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no list view). Feature set inspired by HeroUI Pro's
// public List View docs (variants primary / secondary, `.list-view__*` parts); independent implementation on HeroUI tokens.
import "../../../out/list-view.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const listViewVariants = tv({
  defaultVariants: {
    variant: "primary",
  },
  slots: {
    base: "list-view",
    description: "list-view__description",
    emptyState: "list-view__empty-state",
    item: "list-view__item",
    itemAction: "list-view__item-action",
    itemContent: "list-view__item-content",
    selectionCell: "list-view__selection-cell",
    title: "list-view__title",
  },
  variants: {
    variant: {
      primary: {base: "list-view--primary"},
      secondary: {base: "list-view--secondary"},
    },
  },
});

export type ListViewVariants = VariantProps<typeof listViewVariants>;
