// Ported from HeroUI v3.2.6 packages/styles/src/components/color-input-group/color-input-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/color-input-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const colorInputGroupVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "color-input-group",
    input: "color-input-group__input",
    prefix: "color-input-group__prefix",
    suffix: "color-input-group__suffix",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "color-input-group--full-width",
      },
    },
    variant: {
      primary: {
        base: "color-input-group--primary",
      },
      secondary: {
        base: "color-input-group--secondary",
      },
    },
  },
});

export type ColorInputGroupVariants = VariantProps<typeof colorInputGroupVariants>;
