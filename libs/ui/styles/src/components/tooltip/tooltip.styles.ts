// Ported from HeroUI v3.2.6 packages/styles/src/components/tooltip/tooltip.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/tooltip.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const tooltipVariants = tv({
  slots: {
    base: "tooltip",
    trigger: "tooltip__trigger",
  },
});

export type TooltipVariants = VariantProps<typeof tooltipVariants>;
