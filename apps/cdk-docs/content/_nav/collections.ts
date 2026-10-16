// Disclosure, tabs, lists, tables, trees, tags, selection, collections, scrolling.
import type { NavGroup } from "@rivetjs/docs-kit/tools/nav.ts";

export const components: NavGroup[] = [
  { title: "Navigation", pages: ["components/disclosure", "components/accordion", "components/tabs", "components/sidebar", "components/stepper"] },
  {
    title: "Collections",
    pages: [
      "components/listbox",
      "components/grid-list",
      "components/table",
      "components/data-grid",
      "components/masonry",
      "components/bento",
      "components/tree",
      "components/navigation-tree",
      "components/tag-group",
    ],
  },
];
export const foundations: NavGroup[] = [
  {
    title: "Collections and selection",
    pages: [
      "foundations/keyboard-navigation",
      "foundations/selection",
      "foundations/collections",
      "foundations/data",
      "foundations/virtualizer",
      "foundations/scrolling",
    ],
  },
];
