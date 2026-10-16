// Ported from HeroUI v3.2.6 packages/styles/src/components/meter/meter.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/meter.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const meterVariants = tv({
  defaultVariants: {
    color: "accent",
    size: "md",
  },
  slots: {
    base: "meter",
    fill: "meter__fill",
    output: "meter__output",
    track: "meter__track",
  },
  variants: {
    color: {
      accent: {
        base: "meter--accent",
      },
      danger: {
        base: "meter--danger",
      },
      default: {
        base: "meter--default",
      },
      success: {
        base: "meter--success",
      },
      warning: {
        base: "meter--warning",
      },
    },
    size: {
      lg: {
        base: "meter--lg",
      },
      md: {
        base: "meter--md",
      },
      sm: {
        base: "meter--sm",
      },
    },
  },
});

export type MeterVariants = VariantProps<typeof meterVariants>;
