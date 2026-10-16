// Ported from HeroUI v3.2.6 packages/styles/src/components/description/description.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/description.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const descriptionVariants = tv({
  base: "description",
});

export type DescriptionVariants = VariantProps<typeof descriptionVariants>;
