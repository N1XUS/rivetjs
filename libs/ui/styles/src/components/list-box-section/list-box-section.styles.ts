// Ported from HeroUI v3.2.6 packages/styles/src/components/list-box-section/list-box-section.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/list-box.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const listboxSectionVariants = tv({
  base: "list-box-section",
});

export type ListBoxSectionVariants = VariantProps<typeof listboxSectionVariants>;
