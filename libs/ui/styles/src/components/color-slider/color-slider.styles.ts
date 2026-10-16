// Ported from HeroUI v3.2.6 packages/styles/src/components/color-slider/color-slider.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/color-slider.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const colorSliderVariants = tv({
  slots: {
    base: "color-slider",
    output: "color-slider__output",
    thumb: "color-slider__thumb",
    track: "color-slider__track",
  },
});

export type ColorSliderVariants = VariantProps<typeof colorSliderVariants>;
