// Ported from HeroUI v3.2.6 packages/styles/src/components/select/select.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/morph-icon.css";
import "../../../out/list-box-item.css";
import "../../../out/select.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const selectVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "select",
    clearButton: "select__clear-button",
    indicator: "select__indicator",
    popover: "select__popover",
    trigger: "select__trigger",
    value: "select__value",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "select--full-width",
        trigger: "select__trigger--full-width",
      },
    },
    variant: {
      primary: {
        base: "select--primary",
      },
      secondary: {
        base: "select--secondary",
      },
    },
  },
});

export type SelectVariants = VariantProps<typeof selectVariants>;
