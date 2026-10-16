import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: dynamic items",
  summary: "Rows from data: items on the Tree, a nested Collection per row, disabledKeys, and renderEmptyState when the filter matches nothing.",
  tags: ["tree", "collections", "dynamic"],
  status: "experimental",
  frame: { height: 172, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#org-engineering", "aria-expanded", "true"] },
    { expect: ["#org-web", "Web"] },
    { attr: ["#org-mobile", "aria-disabled", "true"] },
    // Disabled rows are skipped by the arrow keys.
    { press: ["#org-web", "ArrowDown"] },
    { focused: "#org-design" },
    { click: "#org-design-chevron" },
    { expect: ["#org-brand", "Brand"] },
    // Emptying items renders the empty state inside the treegrid.
    { click: "#hide-all" },
    { attr: ["#org", "data-empty", "true"] },
    { expect: ["#org", "No teams"] },
    { click: "#hide-all" },
    { expect: ["#org-engineering", "Engineering"] },
  ],
});
