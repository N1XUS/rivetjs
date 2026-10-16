// Ported from HeroUI v3.2.6 packages/styles/src/components/radio/radio.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/radio.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const radioVariants = tv({
  slots: {
    base: "radio",
    content: "radio__content",
    control: "radio__control",
    indicator: "radio__indicator",
  },
});

export type RadioVariants = VariantProps<typeof radioVariants>;
