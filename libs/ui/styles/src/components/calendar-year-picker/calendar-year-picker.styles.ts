// Ported from HeroUI v3.2.6 packages/styles/src/components/calendar-year-picker/calendar-year-picker.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/calendar-year-picker.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const calendarYearPickerVariants = tv({
  slots: {
    trigger: "calendar-year-picker__trigger",
    triggerHeading: "calendar-year-picker__trigger-heading",
    triggerIndicator: "calendar-year-picker__trigger-indicator",
    yearCell: "calendar-year-picker__year-cell",
    yearGrid: "calendar-year-picker__year-grid",
  },
});

export type CalendarYearPickerVariants = VariantProps<typeof calendarYearPickerVariants>;
