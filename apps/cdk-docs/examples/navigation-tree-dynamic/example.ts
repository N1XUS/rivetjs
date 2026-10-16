import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NavigationTree: dynamic items",
  summary: "Items from data through items and an item renderer; Tab moves between items, arrow keys too (allowsArrowNavigation).",
  tags: ["navigation-tree", "tree", "dynamic"],
  status: "experimental",
  frame: { height: 120, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#sections-reports", "data-current", "true"] },
    { attr: ["#sections-reports a", "aria-current", "page"] },
    { attr: ["#sections-overview a", "href", "/overview"] },
    { attr: ["#sections-settings a", "href", "/settings"] },
    { click: "#sections-settings a" },
    { attr: ["#sections-settings", "data-current", "true"] },
    { attr: ["#sections-reports", "data-current", null] },
  ],
});
