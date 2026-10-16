// Ported from HeroUI v3.2.6 packages/styles/src/components/progress-circle/progress-circle.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/progress-circle.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const progressCircleVariants = tv({
  defaultVariants: {
    color: "accent",
    size: "md",
  },
  slots: {
    base: "progress-circle",
    fillCircle: "progress-circle__fill-circle",
    track: "progress-circle__track",
    trackCircle: "progress-circle__track-circle",
  },
  variants: {
    color: {
      accent: {
        base: "progress-circle--accent",
      },
      danger: {
        base: "progress-circle--danger",
      },
      default: {
        base: "progress-circle--default",
      },
      success: {
        base: "progress-circle--success",
      },
      warning: {
        base: "progress-circle--warning",
      },
    },
    size: {
      lg: {
        base: "progress-circle--lg",
      },
      md: {
        base: "progress-circle--md",
      },
      sm: {
        base: "progress-circle--sm",
      },
    },
  },
});

export type ProgressCircleVariants = VariantProps<typeof progressCircleVariants>;
