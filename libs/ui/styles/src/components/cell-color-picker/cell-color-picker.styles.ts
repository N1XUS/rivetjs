// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no cell color picker). Feature set inspired by HeroUI
// Pro's public Cell Color Picker docs (`variant` default / secondary on the trigger, `.cell-color-picker__*` parts); independent
// implementation on HeroUI tokens.
import "../../../out/cell-color-picker.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const cellColorPickerVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    base: "cell-color-picker",
    label: "cell-color-picker__label",
    popover: "cell-color-picker__popover",
    swatch: "cell-color-picker__swatch",
    trigger: "cell-color-picker__trigger",
    valueDisplay: "cell-color-picker__value-display",
  },
  variants: {
    variant: {
      default: {
        trigger: "cell-color-picker__trigger--default",
      },
      secondary: {
        trigger: "cell-color-picker__trigger--secondary",
      },
    },
  },
});

export type CellColorPickerVariants = VariantProps<typeof cellColorPickerVariants>;
