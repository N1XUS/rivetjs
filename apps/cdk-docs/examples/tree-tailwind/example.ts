import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: Tailwind",
  summary: "Tailwind variants on the row data attributes (data-selected, data-expanded, data-level, focus-visible) and --tree-item-level indentation.",
  tags: ["tree", "styling", "tailwind"],
  status: "experimental",
  frame: { height: 186, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tw-tree", "data-selection-mode", "multiple"] },
    { attr: ["#tw-tree-src", "data-expanded", "true"] },
    { attr: ["#tw-tree-src", "data-level", "1"] },
    { attr: ["#tw-tree-app", "data-level", "2"] },
    { matches: "#tw-tree-src-chevron svg" },
    { click: "#tw-tree-app [slot=selection]" },
    { attr: ["#tw-tree-app", "data-selected", "true"] },
    { press: ["#tw-tree-app", "ArrowUp"] },
    { attr: ["#tw-tree-src", "data-focus-visible", "true"] },
  ],
});
