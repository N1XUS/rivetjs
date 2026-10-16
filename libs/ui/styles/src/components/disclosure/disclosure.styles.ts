// Ported from HeroUI v3.2.6 packages/styles/src/components/disclosure/disclosure.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/disclosure.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const disclosureVariants = tv({
  defaultVariants: {},
  slots: {
    base: "disclosure",
    body: "disclosure__body",
    bodyInner: "disclosure__body-inner",
    content: "disclosure__content",
    heading: "disclosure__heading",
    indicator: "disclosure__indicator",
    trigger: "disclosure__trigger",
  },
  variants: {},
});

// Render props that should be excluded from DisclosureVariants (framework-specific)
type DisclosureRenderPropsKeys = "isExpanded" | "isDisabled" | "state";

export type DisclosureVariants = Omit<
  VariantProps<typeof disclosureVariants>,
  DisclosureRenderPropsKeys
>;
