// Ported from HeroUI v3.2.6 packages/styles/src/components/date-picker/date-picker.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/date-picker.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const datePickerVariants = tv({
  slots: {
    base: "date-picker",
    popover: "date-picker__popover",
    trigger: "date-picker__trigger",
    triggerIndicator: "date-picker__trigger-indicator",
  },
});

export type DatePickerVariants = VariantProps<typeof datePickerVariants>;
