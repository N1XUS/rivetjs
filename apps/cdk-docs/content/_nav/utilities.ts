// Utilities, drag and drop, platform.
import type { NavGroup } from "@rivetjs/docs-kit/tools/nav.ts";

export const components: NavGroup[] = [
  { title: "Content", pages: ["components/heading", "components/separator", "components/keyboard", "components/scroll-area", "components/resizable"] },
];
export const foundations: NavGroup[] = [
  {
    title: "Utilities",
    pages: [
      "foundations/utilities",
      "foundations/slots",
      "foundations/props-and-values",
      "foundations/dom",
      "foundations/platform",
      "foundations/coercion",
      "foundations/clipboard",
      "foundations/keyboard-shortcuts",
      "foundations/layout",
      "foundations/observers",
      "foundations/overflow",
      "foundations/chat",
      "foundations/markdown",
      "foundations/highlight",
    ],
  },
  { title: "Internationalization", pages: ["foundations/i18n", "foundations/bidi", "foundations/dates"] },
];
