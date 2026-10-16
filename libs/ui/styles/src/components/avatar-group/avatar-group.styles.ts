// Ported from HeroUI v3.2.6 packages/styles/src/components/avatar-group/avatar-group.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/avatar-group.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const avatarGroupVariants = tv({
  defaultVariants: {
    isGrid: false,
    overlap: "clip",
  },
  slots: {
    base: "avatar-group",
    count: "avatar-group__count",
  },
  variants: {
    isGrid: {
      false: {},
      true: {
        base: "avatar-group--grid",
      },
    },
    overlap: {
      clip: {
        base: "avatar-group--clip",
      },
      ring: {
        base: "avatar-group--ring",
      },
    },
  },
});

export type AvatarGroupVariants = VariantProps<typeof avatarGroupVariants>;
