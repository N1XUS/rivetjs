// Ported from HeroUI v3.2.6 packages/styles/src/components/color-picker/color-picker.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/label.css";
import "../../../out/color-picker.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const colorPickerVariants = tv({
  slots: {
    base: "color-picker",
    popover: "color-picker__popover",
    trigger: "color-picker__trigger",
  },
});

export type ColorPickerVariants = VariantProps<typeof colorPickerVariants>;
