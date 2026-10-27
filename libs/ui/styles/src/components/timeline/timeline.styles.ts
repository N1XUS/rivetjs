// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no timeline). Feature set inspired by HeroUI Pro's
// public Timeline docs (rail with markers and connectors; start or centered axis; content side / alternate; sizes;
// density; status tones); independent implementation on HeroUI tokens.
import "../../../out/timeline.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const timelineVariants = tv({
  defaultVariants: {
    axis: "start",
    density: "comfortable",
    placement: "end",
    size: "md",
  },
  slots: {
    base: "timeline",
    connector: "timeline__connector",
    content: "timeline__content",
    item: "timeline__item",
    marker: "timeline__marker",
    rail: "timeline__rail",
  },
  variants: {
    axis: {
      center: {base: "timeline--center"},
      start: {base: "timeline--start"},
    },
    density: {
      comfortable: {base: "timeline--comfortable"},
      compact: {base: "timeline--compact"},
    },
    placement: {
      alternate: {base: "timeline--placement-alternate"},
      end: {base: "timeline--placement-end"},
      start: {base: "timeline--placement-start"},
    },
    size: {
      lg: {base: "timeline--lg"},
      md: {base: "timeline--md"},
      sm: {base: "timeline--sm"},
    },
  },
});

export type TimelineVariants = VariantProps<typeof timelineVariants>;
