// Ported from HeroUI v3.2.6 packages/styles/src/components/slider/slider.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/slider.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const sliderVariants = tv({
  slots: {
    base: "slider",
    fill: "slider__fill",
    marks: "slider__marks",
    output: "slider__output",
    thumb: "slider__thumb",
    track: "slider__track",
  },
});

export type SliderVariants = VariantProps<typeof sliderVariants>;
