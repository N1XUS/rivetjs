// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no file tree). Feature set scoped from
// public docs of commercial UI kits (sizes sm / md / lg, guide lines, drag and drop, `.file-tree__*` parts); independent implementation on HeroUI tokens.
import "../../../out/file-tree.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const fileTreeVariants = tv({
  defaultVariants: {
    size: "md",
  },
  slots: {
    base: "file-tree",
    content: "file-tree__content",
    dragHandle: "file-tree__drag-handle",
    dropIndicator: "file-tree__drop-indicator",
    icon: "file-tree__icon",
    indent: "file-tree__indent",
    indicator: "file-tree__indicator",
    indicatorIcon: "file-tree__indicator-icon",
    item: "file-tree__item",
    section: "file-tree__section",
    sectionHeader: "file-tree__section-header",
    selectionCell: "file-tree__selection-cell",
    title: "file-tree__title",
  },
  variants: {
    size: {
      lg: {base: "file-tree--lg"},
      md: {base: "file-tree--md"},
      sm: {base: "file-tree--sm"},
    },
  },
});

export type FileTreeVariants = VariantProps<typeof fileTreeVariants>;
