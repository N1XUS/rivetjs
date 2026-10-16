// Ported from HeroUI v3.2.6 packages/styles/src/components/error-message/error-message.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/error-message.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const errorMessageVariants = tv({
  base: "error-message",
});

export type ErrorMessageVariants = VariantProps<typeof errorMessageVariants>;
