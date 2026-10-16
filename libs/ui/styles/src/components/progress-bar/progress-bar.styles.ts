// Ported from HeroUI v3.2.6 packages/styles/src/components/progress-bar/progress-bar.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/progress-bar.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const progressBarVariants = tv({
  defaultVariants: {
    color: "accent",
    size: "md",
  },
  slots: {
    base: "progress-bar",
    fill: "progress-bar__fill",
    output: "progress-bar__output",
    track: "progress-bar__track",
  },
  variants: {
    color: {
      accent: {
        base: "progress-bar--accent",
      },
      danger: {
        base: "progress-bar--danger",
      },
      default: {
        base: "progress-bar--default",
      },
      success: {
        base: "progress-bar--success",
      },
      warning: {
        base: "progress-bar--warning",
      },
    },
    size: {
      lg: {
        base: "progress-bar--lg",
      },
      md: {
        base: "progress-bar--md",
      },
      sm: {
        base: "progress-bar--sm",
      },
    },
  },
});

export type ProgressBarVariants = VariantProps<typeof progressBarVariants>;
