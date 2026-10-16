// Ported from HeroUI v3.2.6 packages/styles/src/components/toolbar/toolbar.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/toolbar.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

const toolbarVariants = tv({
  base: "toolbar",
  defaultVariants: {
    isAttached: false,
    orientation: "horizontal",
  },
  variants: {
    isAttached: {
      true: "toolbar--attached",
    },
    orientation: {
      horizontal: "toolbar--horizontal",
      vertical: "toolbar--vertical",
    },
  },
});

export {toolbarVariants};
export type ToolbarVariants = VariantProps<typeof toolbarVariants>;
