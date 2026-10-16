// Ported from HeroUI v3.2.6 packages/styles/src/components/toggle-button-group/toggle-button-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/toggle-button-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const toggleButtonGroupVariants = tv({
  defaultVariants: {
    fullWidth: false,
    isDetached: false,
    orientation: "horizontal",
  },
  slots: {
    base: "toggle-button-group",
    separator: "toggle-button-group__separator",
  },
  variants: {
    fullWidth: {
      false: {},
      true: {
        base: "toggle-button-group--full-width",
      },
    },
    isDetached: {
      false: {},
      true: {
        base: "toggle-button-group--detached",
      },
    },
    orientation: {
      horizontal: {
        base: "toggle-button-group--horizontal",
      },
      vertical: {
        base: "toggle-button-group--vertical",
      },
    },
  },
});

export type ToggleButtonGroupVariants = VariantProps<typeof toggleButtonGroupVariants>;
