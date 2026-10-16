// Ported from HeroUI v3.2.6 packages/styles/src/components/avatar/avatar.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
import "../../../out/avatar.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const avatarVariants = tv({
  defaultVariants: {
    color: "default",
    size: "md",
  },
  slots: {
    base: "avatar",
    fallback: "avatar__fallback",
    image: "avatar__image",
  },
  variants: {
    color: {
      accent: {
        fallback: "avatar__fallback--accent",
      },
      danger: {
        fallback: "avatar__fallback--danger",
      },
      default: {
        fallback: "avatar__fallback--default",
      },
      success: {
        fallback: "avatar__fallback--success",
      },
      warning: {
        fallback: "avatar__fallback--warning",
      },
    },
    size: {
      lg: {
        base: "avatar--lg",
      },
      md: {
        base: "avatar--md",
      },
      sm: {
        base: "avatar--sm",
      },
    },
    variant: {
      default: {},
      soft: {
        base: "avatar--soft",
      },
    },
  },
});

export type AvatarVariants = VariantProps<typeof avatarVariants>;
