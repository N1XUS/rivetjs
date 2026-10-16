// Ported from HeroUI v3.2.6 packages/styles/src/components/kbd/kbd.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/kbd.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const kbdVariants = tv({
  defaultVariants: {},
  slots: {
    abbr: "kbd__abbr",
    base: "kbd",
    content: "kbd__content",
  },
  variants: {
    variant: {
      default: "kbd--default",
      light: "kbd--light",
    },
  },
});

export type KbdVariants = VariantProps<typeof kbdVariants>;
