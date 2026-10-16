// Ported from HeroUI v3.2.6 packages/styles/src/components/menu-section/menu-section.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/menu.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const menuSectionVariants = tv({
  base: "menu-section",
});

export type MenuSectionVariants = VariantProps<typeof menuSectionVariants>;
