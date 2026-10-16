// Ported from HeroUI v3.2.6 packages/styles/src/components/link/link.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/link.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const linkVariants = tv({
  slots: {
    base: "link",
    icon: "link__icon",
  },
});

// Render props that should be excluded from LinkVariants (framework-specific)
type LinkRenderPropsKeys =
  "isCurrent" | "isHovered" | "isPressed" | "isFocused" | "isFocusVisible" | "isDisabled";

export type LinkVariants = Omit<VariantProps<typeof linkVariants>, LinkRenderPropsKeys>;
