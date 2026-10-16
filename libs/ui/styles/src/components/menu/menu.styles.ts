// Ported from HeroUI v3.2.6 packages/styles/src/components/menu/menu.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/menu.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const menuVariants = tv({
  base: "menu",
});

export type MenuVariants = VariantProps<typeof menuVariants>;
