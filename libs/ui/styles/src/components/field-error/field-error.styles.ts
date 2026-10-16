// Ported from HeroUI v3.2.6 packages/styles/src/components/field-error/field-error.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/field-error.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const fieldErrorVariants = tv({
  base: "field-error",
});

export type FieldErrorVariants = VariantProps<typeof fieldErrorVariants>;
