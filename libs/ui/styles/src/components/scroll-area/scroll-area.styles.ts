// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no scroll area, only ScrollShadow): tv() slots of
// @rivetjs/ui/scroll-area in the vendored format. Behaviour + parts = Radix UI ScrollArea (@radix-ui/react-scroll-area
// 1.3.0, MIT, © 2022 WorkOS) via @rivetjs/cdk/scroll-area.
import "../../../out/scroll-area.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const scrollAreaVariants = tv({
  defaultVariants: {
    size: "md",
    variant: "hover",
  },
  slots: {
    base: "scroll-area",
    corner: "scroll-area__corner",
    scrollbar: "scroll-area__scrollbar",
    thumb: "scroll-area__thumb",
    viewport: "scroll-area__viewport",
  },
  variants: {
    size: {
      md: {
        base: "scroll-area--md",
      },
      sm: {
        base: "scroll-area--sm",
      },
    },
    variant: {
      always: {
        base: "scroll-area--always",
      },
      hover: {
        base: "scroll-area--hover",
      },
    },
  },
});

export type ScrollAreaVariants = VariantProps<typeof scrollAreaVariants>;
