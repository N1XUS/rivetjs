// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no context menu). Feature set inspired by HeroUI Pro's
// public Context Menu docs (a right-click / long-press menu at the pointer); independent implementation on HeroUI tokens. The
// popover and menu also carry the vendored dropdown classes (same surface, list and motion).
import "../../../out/dropdown.css";
import "../../../out/context-menu.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const contextMenuVariants = tv({
  slots: {
    menu: "dropdown__menu context-menu__menu",
    popover: "dropdown__popover context-menu__popover",
    separator: "context-menu__separator",
    trigger: "context-menu__trigger",
  },
});

export type ContextMenuVariants = VariantProps<typeof contextMenuVariants>;
