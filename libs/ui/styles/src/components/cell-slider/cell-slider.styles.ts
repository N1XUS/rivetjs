// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no cell slider). Feature set inspired by HeroUI Pro's
// public docs (CellSlider `variant` default / secondary); independent implementation on HeroUI tokens.
import "../../../out/cell-slider.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const cellSliderVariants = tv({
  defaultVariants: {
    variant: "default",
  },
  slots: {
    base: "cell-slider",
    fill: "cell-slider__fill",
    label: "cell-slider__label",
    output: "cell-slider__output",
    thumb: "cell-slider__thumb",
    track: "cell-slider__track",
  },
  variants: {
    variant: {
      default: {
        base: "cell-slider--default",
      },
      secondary: {
        base: "cell-slider--secondary",
      },
    },
  },
});

export type CellSliderVariants = VariantProps<typeof cellSliderVariants>;
