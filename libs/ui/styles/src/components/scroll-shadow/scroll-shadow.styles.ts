// Ported from HeroUI v3.2.6 packages/styles/src/components/scroll-shadow/scroll-shadow.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/scroll-shadow.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const scrollShadowVariants = tv({
  defaultVariants: {
    hideScrollBar: false,
    orientation: "vertical",
    variant: "fade",
  },
  slots: {
    base: "scroll-shadow",
  },
  variants: {
    hideScrollBar: {
      false: {},
      true: {
        base: "scroll-shadow--hide-scrollbar",
      },
    },
    orientation: {
      horizontal: {
        base: "scroll-shadow--horizontal",
      },
      vertical: {
        base: "scroll-shadow--vertical",
      },
    },
    variant: {
      fade: {
        base: "scroll-shadow--fade",
      },
    },
  },
});

export type ScrollShadowVariants = VariantProps<typeof scrollShadowVariants>;
