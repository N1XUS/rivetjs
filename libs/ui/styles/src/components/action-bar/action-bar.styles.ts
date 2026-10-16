// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no action bar): tv() slots of @rivetjs/ui/action-bar in
// the vendored format. Feature set inspired by HeroUI Pro's public docs; independent implementation. The pill surface is the
// vendored `toolbar` / `toolbar--attached` look (ui Toolbar).
import "../../../out/action-bar.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const actionBarVariants = tv({
  defaultVariants: {
    orientation: "horizontal",
  },
  slots: {
    base: "action-bar",
    content: "action-bar__content",
    label: "action-bar__label",
    prefix: "action-bar__prefix",
    suffix: "action-bar__suffix",
    wrapper: "action-bar__wrapper",
  },
  variants: {
    orientation: {
      horizontal: {
        base: "action-bar--horizontal",
      },
      vertical: {
        base: "action-bar--vertical",
      },
    },
  },
});

export type ActionBarVariants = VariantProps<typeof actionBarVariants>;
