import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: empty state",
  summary: "renderEmptyState renders inside the treegrid while the collection has no rows; the tree gets data-empty.",
  tags: ["tree", "empty state"],
  status: "experimental",
  frame: { height: 78, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#results", "data-empty", "true"] }, { expect: ["#results", "No results found."] }, { matches: "#results [role=row] [role=gridcell]" }],
});
