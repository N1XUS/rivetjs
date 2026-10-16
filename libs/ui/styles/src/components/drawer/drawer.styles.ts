// Ported from HeroUI v3.2.6 packages/styles/src/components/drawer/drawer.styles.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: modified, see TWEAKS.md
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/close-button.css";
import "../../../out/drawer.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const drawerVariants = tv({
  defaultVariants: {
    placement: "bottom",
    variant: "opaque",
  },
  slots: {
    backdrop: "drawer__backdrop",
    body: "drawer__body",
    closeTrigger: "drawer__close-trigger",
    content: "drawer__content",
    dialog: "drawer__dialog",
    footer: "drawer__footer",
    handle: "drawer__handle",
    header: "drawer__header",
    heading: "drawer__heading",
    trigger: "drawer__trigger",
  },
  variants: {
    placement: {
      bottom: {
        content: "drawer__content--bottom",
        dialog: "drawer__dialog--bottom",
      },
      left: {
        content: "drawer__content--left",
        dialog: "drawer__dialog--left",
      },
      right: {
        content: "drawer__content--right",
        dialog: "drawer__dialog--right",
      },
      top: {
        content: "drawer__content--top",
        dialog: "drawer__dialog--top",
      },
    },
    variant: {
      blur: {
        backdrop: "drawer__backdrop--blur",
      },
      opaque: {
        backdrop: "drawer__backdrop--opaque",
      },
      transparent: {
        backdrop: "drawer__backdrop--transparent",
      },
    },
  },
});

export type DrawerVariants = VariantProps<typeof drawerVariants>;
