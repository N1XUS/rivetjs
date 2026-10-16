// Ported from HeroUI v3.2.6 packages/styles/src/components/chip/chip.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/chip.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const chipVariants = tv({
  defaultVariants: {
    color: "default",
    variant: "secondary",
  },
  slots: {
    base: "chip",
    label: "chip__label",
  },
  variants: {
    color: {
      accent: {
        base: "chip--accent",
      },
      danger: {
        base: "chip--danger",
      },
      default: {
        base: "chip--default",
      },
      success: {
        base: "chip--success",
      },
      warning: {
        base: "chip--warning",
      },
    },
    size: {
      lg: {
        base: "chip--lg",
      },
      md: {
        base: "chip--md",
      },
      sm: {
        base: "chip--sm",
      },
    },
    variant: {
      primary: {
        base: "chip--primary",
      },
      secondary: {
        base: "chip--secondary",
      },
      soft: {
        base: "chip--soft",
      },
      tertiary: {
        base: "chip--tertiary",
      },
    },
  },
});

export type ChipVariants = VariantProps<typeof chipVariants>;
