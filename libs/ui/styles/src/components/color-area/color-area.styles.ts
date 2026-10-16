// Ported from HeroUI v3.2.6 packages/styles/src/components/color-area/color-area.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/color-area.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const colorAreaVariants = tv({
  defaultVariants: {
    showDots: false,
  },
  slots: {
    base: "color-area",
    thumb: "color-area__thumb",
  },
  variants: {
    showDots: {
      false: {},
      true: {
        base: "color-area--show-dots",
      },
    },
  },
});

export type ColorAreaVariants = VariantProps<typeof colorAreaVariants>;
