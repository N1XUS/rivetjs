// Ported from HeroUI v3.2.6 packages/styles/src/components/dropdown/dropdown.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/dropdown.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const dropdownVariants = tv({
  slots: {
    menu: "dropdown__menu",
    popover: "dropdown__popover",
    root: "dropdown",
    trigger: "dropdown__trigger",
  },
});

export type DropdownVariants = VariantProps<typeof dropdownVariants>;
