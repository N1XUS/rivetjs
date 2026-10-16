// Ported from HeroUI v3.2.6 packages/styles/src/components/switch/switch.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/label.css";
import "../../../out/switch.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const switchVariants = tv({
  defaultVariants: {
    size: "md",
  },
  slots: {
    base: "switch",
    content: "switch__content",
    control: "switch__control",
    icon: "switch__icon",
    thumb: "switch__thumb",
  },
  variants: {
    size: {
      lg: {
        base: "switch--lg",
      },
      md: {
        base: "switch--md",
      },
      sm: {
        base: "switch--sm",
      },
    },
  },
});

export type SwitchVariants = VariantProps<typeof switchVariants>;
