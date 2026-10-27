// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no command palette). Feature set inspired by HeroUI
// Pro's public Command docs (a modal palette: search field, filtered command list, groups, header / footer; sizes sm / md /
// lg; backdrop opaque / blur / transparent); independent implementation on HeroUI tokens.
import "../../../out/command.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const commandVariants = tv({
  defaultVariants: {
    size: "md",
    variant: "opaque",
  },
  slots: {
    backdrop: "command__backdrop",
    clearButton: "command__input-group-clear-button",
    container: "command__container",
    dialog: "command__dialog",
    empty: "command__empty",
    footer: "command__footer",
    group: "command__group",
    groupHeading: "command__group-heading",
    header: "command__header",
    input: "command__input",
    inputGroup: "command__input-group",
    item: "command__item",
    list: "command__list",
    prefix: "command__input-group-prefix",
    separator: "command__separator",
    suffix: "command__input-group-suffix",
  },
  variants: {
    size: {
      lg: {dialog: "command__dialog--lg"},
      md: {dialog: "command__dialog--md"},
      sm: {dialog: "command__dialog--sm"},
    },
    variant: {
      blur: {backdrop: "command__backdrop--blur"},
      opaque: {backdrop: "command__backdrop--opaque"},
      transparent: {backdrop: "command__backdrop--transparent"},
    },
  },
});

export type CommandVariants = VariantProps<typeof commandVariants>;
