// Ported from HeroUI v3.2.6 packages/styles/src/components/combo-box/combo-box.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/morph-icon.css";
import "../../../out/list-box-item.css";
import "../../../out/input.css";
import "../../../out/combo-box.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const comboBoxVariants = tv({
  defaultVariants: {
    fullWidth: false,
  },
  slots: {
    base: "combo-box",
    inputGroup: "combo-box__input-group",
    popover: "combo-box__popover",
    trigger: "combo-box__trigger",
    value: "combo-box__value",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "combo-box--full-width",
        inputGroup: "combo-box__input-group--full-width",
      },
    },
  },
});

export type ComboBoxVariants = VariantProps<typeof comboBoxVariants>;
