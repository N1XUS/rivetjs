// Ported from HeroUI v3.2.6 packages/styles/src/components/number-field/number-field.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/number-field.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const numberFieldVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "number-field",
    decrementButton: "number-field__decrement-button",
    group: "number-field__group",
    incrementButton: "number-field__increment-button",
    input: "number-field__input",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "number-field--full-width",
        group: "number-field__group--full-width",
      },
    },
    variant: {
      primary: {
        base: "number-field--primary",
      },
      secondary: {
        base: "number-field--secondary",
      },
    },
  },
});

export type NumberFieldVariants = VariantProps<typeof numberFieldVariants>;
