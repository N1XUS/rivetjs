// Ported from HeroUI v3.2.6 packages/styles/src/components/disclosure-group/disclosure-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/disclosure.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const disclosureGroupVariants = tv({
  defaultVariants: {},
  slots: {
    base: "disclosure-group",
  },
  variants: {},
});

export type DisclosureGroupVariants = VariantProps<typeof disclosureGroupVariants>;
