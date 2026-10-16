// Interactions, motion, focus, accessibility; carousel (drag + motion); drag and drop (Angular CDK).
import type { NavGroup } from "@rivetjs/docs-kit/tools/nav.ts";

export const components: NavGroup[] = [
  { title: "Media", pages: ["components/carousel", "components/lightbox", "components/compare"] },
  { title: "Drag and drop", pages: ["components/drag-and-drop"] },
];
export const foundations: NavGroup[] = [
  {
    title: "Interactions",
    pages: [
      "foundations/interactions",
      "foundations/focus-interactions",
      "foundations/dom-props",
      "foundations/motion",
      "foundations/flip",
      "foundations/sheet-motion",
    ],
  },
  { title: "Focus and accessibility", pages: ["foundations/focus", "foundations/announcements", "foundations/ids"] },
  { title: "Angular CDK a11y", pages: ["foundations/focus-trap", "foundations/focus-monitor", "foundations/key-manager", "foundations/a11y-services"] },
];
