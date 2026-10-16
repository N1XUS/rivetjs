// Ported from HeroUI v3.2.6 packages/styles/src/components/input-group/input-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/input-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const inputGroupVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "input-group",
    input: "input-group__input",
    prefix: "input-group__prefix",
    suffix: "input-group__suffix",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "input-group--full-width",
      },
    },
    variant: {
      primary: {
        base: "input-group--primary",
      },
      secondary: {
        base: "input-group--secondary",
      },
    },
  },
});

export type InputGroupVariants = VariantProps<typeof inputGroupVariants>;
