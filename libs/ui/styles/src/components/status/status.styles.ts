// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no status dot): a status / presence / unread dot
// in the semantic colours (Chip / Badge names), three sizes and an optional CSS pulse, on HeroUI tokens.
import "../../../out/status.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const statusVariants = tv({
  base: "status",
  defaultVariants: {
    color: "default",
    size: "md",
  },
  variants: {
    color: {
      accent: "status--accent",
      danger: "status--danger",
      default: "status--default",
      success: "status--success",
      warning: "status--warning",
    },
    pulse: {
      true: "status--pulse",
    },
    size: {
      lg: "status--lg",
      md: "status--md",
      sm: "status--sm",
    },
  },
});

export type StatusVariants = VariantProps<typeof statusVariants>;
