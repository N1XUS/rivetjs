// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no sheet): tv() slots of @rivetjs/ui/sheet in the
// vendored format, on HeroUI open-source tokens. Feature set inspired by HeroUI Pro's public Sheet docs; independent
// implementation (own class names).
// Rivet: loaded before this component's stylesheet: rules here override it at equal specificity (TWEAKS.md TW-121).
import "../../../out/close-button.css";
import "../../../out/sheet.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const sheetVariants = tv({
  defaultVariants: {
    placement: "bottom",
    variant: "opaque",
  },
  slots: {
    backdrop: "sheet__backdrop",
    body: "sheet__body",
    close: "sheet__close",
    closeTrigger: "sheet__close-trigger",
    content: "sheet__content",
    dialog: "sheet__dialog",
    footer: "sheet__footer",
    handle: "sheet__handle",
    header: "sheet__header",
    heading: "sheet__heading",
    trigger: "sheet__trigger",
  },
  variants: {
    isDetached: {
      true: {
        content: "sheet__content--detached",
        dialog: "sheet__dialog--detached",
      },
    },
    placement: {
      bottom: {
        content: "sheet__content--bottom",
        dialog: "sheet__dialog--bottom",
      },
      left: {
        content: "sheet__content--left",
        dialog: "sheet__dialog--left",
      },
      right: {
        content: "sheet__content--right",
        dialog: "sheet__dialog--right",
      },
      top: {
        content: "sheet__content--top",
        dialog: "sheet__dialog--top",
      },
    },
    variant: {
      blur: {
        backdrop: "sheet__backdrop--blur",
      },
      opaque: {
        backdrop: "sheet__backdrop--opaque",
      },
      transparent: {
        backdrop: "sheet__backdrop--transparent",
      },
    },
  },
});

export type SheetVariants = VariantProps<typeof sheetVariants>;
