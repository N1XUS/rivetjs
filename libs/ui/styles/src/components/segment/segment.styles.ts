// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no segmented control): tv() slots of @rivetjs/ui/segment in
// the vendored format. Feature set inspired by HeroUI Pro's public docs; independent implementation. Behaviour = RAC
// ToggleButtonGroup (single selection) + SelectionIndicator via @rivetjs/cdk.
import "../../../out/segment.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const segmentVariants = tv({
  defaultVariants: {
    size: "md",
    variant: "default",
  },
  slots: {
    base: "segment",
    indicator: "segment__indicator",
    item: "segment__item",
    label: "segment__label",
    separator: "segment__separator",
  },
  variants: {
    size: {
      lg: {
        base: "segment--lg",
      },
      md: {
        base: "segment--md",
      },
      sm: {
        base: "segment--sm",
      },
    },
    variant: {
      default: {
        base: "segment--default",
      },
      ghost: {
        base: "segment--ghost",
      },
    },
  },
});

export type SegmentVariants = VariantProps<typeof segmentVariants>;
