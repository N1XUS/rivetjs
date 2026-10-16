// Ported from HeroUI v3.2.6 packages/styles/src/components/alert/alert.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/alert.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const alertVariants = tv({
  defaultVariants: {
    status: "default",
  },
  slots: {
    base: "alert",
    content: "alert__content",
    description: "alert__description",
    indicator: "alert__indicator",
    title: "alert__title",
  },
  variants: {
    status: {
      accent: {
        base: "alert--accent",
      },
      danger: {
        base: "alert--danger",
      },
      default: {
        base: "alert--default",
      },
      success: {
        base: "alert--success",
      },
      warning: {
        base: "alert--warning",
      },
    },
  },
});

export type AlertVariants = VariantProps<typeof alertVariants>;
