// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no time picker popover): TimeField + popover of iOS-style
// wheel drums (@rivetjs/cdk/time-wheels) on HeroUI tokens; trigger / popover mirror the DatePicker look.
import "../../../out/time-picker.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const timePickerVariants = tv({
  slots: {
    base: "time-picker",
    item: "time-picker__item",
    popover: "time-picker__popover",
    trigger: "time-picker__trigger",
    triggerIndicator: "time-picker__trigger-indicator",
    wheel: "time-picker__wheel",
    wheels: "time-picker__wheels",
  },
});

export type TimePickerVariants = VariantProps<typeof timePickerVariants>;
