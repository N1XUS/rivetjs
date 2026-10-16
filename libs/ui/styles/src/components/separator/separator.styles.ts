// Ported from HeroUI v3.2.6 packages/styles/src/components/separator/separator.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/separator.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

const separatorVariants = tv({
  base: "separator",
  defaultVariants: {
    orientation: "horizontal",
    variant: "default",
  },
  variants: {
    orientation: {
      horizontal: "separator--horizontal",
      vertical: "separator--vertical",
    },
    variant: {
      default: "separator--default",
      secondary: "separator--secondary",
      tertiary: "separator--tertiary",
    },
  },
});

export {separatorVariants};
export type SeparatorVariants = VariantProps<typeof separatorVariants>;
