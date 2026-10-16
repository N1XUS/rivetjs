// Ported from HeroUI v3.2.6 packages/styles/src/components/date-range-picker/date-range-picker.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/date-range-picker.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const dateRangePickerVariants = tv({
  slots: {
    base: "date-range-picker",
    popover: "date-range-picker__popover",
    rangeSeparator: "date-range-picker__range-separator",
    trigger: "date-range-picker__trigger",
    triggerIndicator: "date-range-picker__trigger-indicator",
  },
});

export type DateRangePickerVariants = VariantProps<typeof dateRangePickerVariants>;
