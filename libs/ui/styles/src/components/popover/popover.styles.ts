// Ported from HeroUI v3.2.6 packages/styles/src/components/popover/popover.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/popover.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const popoverVariants = tv({
  slots: {
    base: "popover",
    dialog: "popover__dialog",
    heading: "popover__heading",
    trigger: "popover__trigger",
  },
});

export type PopoverVariants = VariantProps<typeof popoverVariants>;
