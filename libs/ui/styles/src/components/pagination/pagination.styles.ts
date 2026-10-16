// Ported from HeroUI v3.2.6 packages/styles/src/components/pagination/pagination.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/pagination.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const paginationVariants = tv({
  defaultVariants: {
    size: "md",
  },
  slots: {
    base: "pagination",
    content: "pagination__content",
    ellipsis: "pagination__ellipsis",
    item: "pagination__item",
    link: "pagination__link",
    summary: "pagination__summary",
  },
  variants: {
    size: {
      lg: {
        base: "pagination--lg",
      },
      md: {
        base: "pagination--md",
      },
      sm: {
        base: "pagination--sm",
      },
    },
  },
});

export type PaginationVariants = VariantProps<typeof paginationVariants>;
