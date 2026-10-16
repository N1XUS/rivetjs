// Ported from HeroUI v3.2.6 packages/styles/src/components/date-input-group/date-input-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/date-input-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const dateInputGroupVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "date-input-group",
    input: "date-input-group__input",
    inputContainer: "date-input-group__input-container",
    prefix: "date-input-group__prefix",
    segment: "date-input-group__segment",
    suffix: "date-input-group__suffix",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "date-input-group--full-width",
      },
    },
    variant: {
      primary: {
        base: "date-input-group--primary",
      },
      secondary: {
        base: "date-input-group--secondary",
      },
    },
  },
});

export type DateInputGroupVariants = VariantProps<typeof dateInputGroupVariants>;
