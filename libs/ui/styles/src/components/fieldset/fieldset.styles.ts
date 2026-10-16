// Ported from HeroUI v3.2.6 packages/styles/src/components/fieldset/fieldset.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/fieldset.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const fieldsetVariants = tv({
  slots: {
    actions: "fieldset__actions",
    base: "fieldset",
    description: "fieldset__description",
    fieldGroup: "fieldset__field-group",
    legend: "fieldset__legend",
  },
});

export type FieldsetVariants = VariantProps<typeof fieldsetVariants>;
