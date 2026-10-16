// Ported from HeroUI v3.2.6 packages/styles/src/components/autocomplete/autocomplete.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/morph-icon.css";
import "../../../out/list-box-item.css";
import "../../../out/autocomplete.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const autocompleteVariants = tv({
  defaultVariants: {
    fullWidth: false,
    variant: "primary",
  },
  slots: {
    base: "autocomplete",
    clearButton: "autocomplete__clear-button",
    filter: "autocomplete__filter",
    indicator: "autocomplete__indicator",
    popover: "autocomplete__popover",
    trigger: "autocomplete__trigger",
    value: "autocomplete__value",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "autocomplete--full-width",
        trigger: "autocomplete__trigger--full-width",
      },
    },
    variant: {
      primary: {
        base: "autocomplete--primary",
      },
      secondary: {
        base: "autocomplete--secondary",
      },
    },
  },
});

export type AutocompleteVariants = VariantProps<typeof autocompleteVariants>;
